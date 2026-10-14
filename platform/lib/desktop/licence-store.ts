// Licence de l'application de bureau, conservée sur le PC (dossier de données de l'application),
// et dialogue avec le site Spacora (activation, contrôle). Uniquement dans l'édition « desktop ».
import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { syncLocalPlan } from "@/lib/db/desktop-local";
import {
  licenceState,
  needsVerification,
  type LicenceState,
} from "./licence-policy";
import type { DesktopLicence, StoredLicence } from "./licence-types";

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
  | { status: "active"; token?: string; licence: DesktopLicence }
  | {
      status: "invalid" | "locked" | "no_subscription" | "revoked" | "offline";
    };

async function callServer(
  baseUrl: string,
  route: string,
  body: unknown,
): Promise<ServerAnswer> {
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json()) as {
      status?: string;
      token?: string;
      licence?: DesktopLicence;
    };
    if (data.status === "active" && data.licence)
      return { status: "active", token: data.token, licence: data.licence };
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

/** Activation avec le compte client : enregistre la licence si l'abonnement est payé. */
export async function activateLicence(
  email: string,
  password: string,
  accountUrl: string = accountServerUrl(),
  now: Date = new Date(),
): Promise<"active" | "invalid" | "locked" | "no_subscription" | "offline"> {
  const baseUrl = accountUrl.replace(/\/+$/, "");
  const answer = await callServer(baseUrl, "/api/desktop/activation", {
    email,
    password,
  });
  if (answer.status === "revoked") return "no_subscription";
  if (answer.status !== "active") return answer.status;
  if (!answer.token) return "offline";
  await writeStoredLicence({
    token: answer.token,
    licence: answer.licence,
    status: "active",
    lastVerifiedAt: now.toISOString(),
    accountUrl: baseUrl,
  });
  await syncLocalPlan(answer.licence.plan);
  return "active";
}

/**
 * État de la licence, avec un contrôle auprès du site quand le dernier date de plus de 12 h.
 * Sans réseau, le dernier état connu fait foi pendant le délai hors ligne.
 */
export async function currentLicence(
  now: Date = new Date(),
): Promise<LicenceState> {
  const stored = await readStoredLicence();
  if (stored && stored.status === "active" && needsVerification(stored, now)) {
    const answer = await callServer(
      stored.accountUrl ?? accountServerUrl(),
      "/api/desktop/verification",
      { token: stored.token },
    );
    if (answer.status === "active") {
      const updated: StoredLicence = {
        ...stored,
        licence: answer.licence,
        lastVerifiedAt: now.toISOString(),
      };
      await writeStoredLicence(updated);
      await syncLocalPlan(answer.licence.plan);
      return licenceState(updated, now);
    }
    if (answer.status === "no_subscription" || answer.status === "revoked") {
      const blocked: StoredLicence = { ...stored, status: answer.status };
      await writeStoredLicence(blocked);
      return licenceState(blocked, now);
    }
  }
  return licenceState(stored, now);
}
