// Licence de l'application de bureau, conservée sur le PC (dossier de données de l'application),
// et dialogue avec le site Spacora (activation, contrôle). Uniquement dans l'édition « desktop ».
import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { KeyObject } from "node:crypto";
import { localOrganizationExists, syncLocalPlan } from "@/lib/db/desktop-local";
import { verifyGrant, type LicenceGrant } from "./licence-grant";
import { desktopVerifyingKey } from "./licence-keys";
import {
  clockMovedBack,
  licenceState,
  needsVerification,
  nextSeenAt,
  type LicenceState,
} from "./licence-policy";
import type { StoredLicence } from "./licence-types";

/** Site Spacora proposé par défaut pour l'activation (comptes clients, abonnements). */
export function accountServerUrl(): string {
  return (
    process.env.SPACORA_ACCOUNT_URL ?? "https://app.spacora.tech"
  ).replace(/\/+$/, "");
}

function licenceFile(): string {
  const dir = process.env.SPACORA_DATA_DIR;
  if (!dir)
    throw new Error(
      "SPACORA_DATA_DIR n'est pas défini (application de bureau)",
    );
  return path.join(dir, "licence.json");
}

export async function readStoredLicence(): Promise<StoredLicence | null> {
  try {
    return JSON.parse(await readFile(licenceFile(), "utf8")) as StoredLicence;
  } catch {
    return null;
  }
}

async function writeStoredLicence(stored: StoredLicence): Promise<void> {
  await mkdir(path.dirname(licenceFile()), { recursive: true });
  await writeFile(licenceFile(), JSON.stringify(stored, null, 2), "utf8");
}

export async function clearStoredLicence(): Promise<void> {
  await rm(licenceFile(), { force: true });
}

type ServerAnswer =
  | { status: "active"; grant: LicenceGrant; token: string }
  | {
      status:
        | "invalid"
        | "locked"
        | "no_subscription"
        | "revoked"
        | "offline"
        | "forged";
    };

async function callServer(
  baseUrl: string,
  route: string,
  body: unknown,
  key: KeyObject,
): Promise<ServerAnswer> {
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json()) as { status?: string; grant?: string };
    if (data.status === "active") {
      // Seule une attestation signée par le site Spacora est acceptée (un faux serveur ne peut pas en fabriquer)
      const grant =
        typeof data.grant === "string" ? verifyGrant(data.grant, key) : null;
      return grant
        ? { status: "active", grant, token: data.grant as string }
        : { status: "forged" };
    }
    if (
      data.status === "invalid" ||
      data.status === "locked" ||
      data.status === "no_subscription" ||
      data.status === "revoked"
    )
      return { status: data.status };
    return { status: "offline" };
  } catch {
    // Pas de réseau, site injoignable ou réponse illisible
    return { status: "offline" };
  }
}

/** Attestation du fichier, vérifiée (null si absente, modifiée ou signée par une autre clé). */
function verifiedGrant(
  stored: StoredLicence | null,
  key: KeyObject,
): LicenceGrant | null {
  return stored && typeof stored.grant === "string"
    ? verifyGrant(stored.grant, key)
    : null;
}

export type ActivationResult =
  | "active"
  | "invalid"
  | "locked"
  | "no_subscription"
  | "offline"
  | "unconfigured"
  | "forged"
  | "other_organization"
  | "clock";

/** Activation avec le compte client : enregistre la licence si l'abonnement est payé. */
export async function activateLicence(
  email: string,
  password: string,
  accountUrl: string = accountServerUrl(),
  now: Date = new Date(),
): Promise<ActivationResult> {
  const key = desktopVerifyingKey();
  if (!key) return "unconfigured";
  const baseUrl = accountUrl.replace(/\/+$/, "");
  const answer = await callServer(
    baseUrl,
    "/api/desktop/activation",
    { email, password },
    key,
  );
  if (answer.status === "revoked") return "no_subscription";
  if (answer.status !== "active") return answer.status;
  const previous = await readStoredLicence();
  const previousGrant = verifiedGrant(previous, key);
  // Les données de ce PC appartiennent à une entreprise : pas de bascule vers le compte d'une autre
  if (
    previousGrant &&
    previousGrant.licence.organizationId !==
      answer.grant.licence.organizationId &&
    (await localOrganizationExists())
  )
    return "other_organization";
  if (previous && previousGrant && clockMovedBack(previous, answer.grant, now))
    return "clock";
  await writeStoredLicence({
    grant: answer.token,
    status: "active",
    seenAt: now.toISOString(),
    accountUrl: baseUrl,
  });
  await syncLocalPlan(answer.grant.licence.plan);
  return "active";
}

/**
 * État de la licence, avec un contrôle auprès du site quand le dernier date de plus de 12 h.
 * Sans réseau, l'attestation signée fait foi jusqu'à sa fin de validité.
 */
export async function currentLicence(
  now: Date = new Date(),
): Promise<LicenceState> {
  const key = desktopVerifyingKey();
  if (!key) return { state: "unconfigured" };
  const stored = await readStoredLicence();
  const grant = verifiedGrant(stored, key);
  const state = licenceState(stored, grant, now);
  if (!stored || !grant || state.state === "clock") return state;
  if (state.state === "inactive") return state;
  if (needsVerification(grant, now)) {
    const answer = await callServer(
      stored.accountUrl ?? accountServerUrl(),
      "/api/desktop/verification",
      { grant: stored.grant },
      key,
    );
    if (answer.status === "active") {
      const updated: StoredLicence = {
        ...stored,
        grant: answer.token,
        seenAt: now.toISOString(),
      };
      await writeStoredLicence(updated);
      await syncLocalPlan(answer.grant.licence.plan);
      return licenceState(updated, answer.grant, now);
    }
    if (answer.status === "no_subscription" || answer.status === "revoked") {
      const blocked: StoredLicence = { ...stored, status: answer.status };
      await writeStoredLicence(blocked);
      return licenceState(blocked, grant, now);
    }
  }
  // Date constatée : une horloge remise en arrière plus tard sera détectée
  const seenAt = nextSeenAt(stored, now);
  if (seenAt) await writeStoredLicence({ ...stored, seenAt });
  return state;
}
