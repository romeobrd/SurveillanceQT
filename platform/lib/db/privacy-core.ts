// Départ et anonymisation d'un collaborateur (SPEC §8.5). Sert aux actions de l'administrateur ET à la purge
// planifiée. Chaque requête filtre explicitement sur l'entreprise : jamais d'identifiant pris sans son organizationId.
import "server-only";
import { attemptKey } from "@/lib/auth/rate-limit";
import { rawPrisma } from "./client";
import { InvalidOperationError, NotFoundError } from "./errors";
import { recordAssignmentChange } from "./repositories/asset-history";

type Tx = Parameters<Parameters<typeof rawPrisma.$transaction>[0]>[0];

/** Valeur qu'aucun mot de passe ne peut vérifier : le compte anonymisé ne peut plus se connecter. */
export const UNUSABLE_PASSWORD_HASH = "!anonymise";

export const ANONYMOUS = {
  firstName: "Ancien",
  lastName: "Collaborateur",
  jobTitle: "Anonymisé",
} as const;

/** Libère poste et matériel (historique conservé) et désactive le compte de connexion. */
async function release(
  tx: Tx,
  organizationId: string,
  personId: string,
  now: Date,
): Promise<void> {
  await tx.workstation.updateMany({
    where: { organizationId, personId },
    data: { personId: null },
  });
  const assets = await tx.asset.findMany({
    where: { organizationId, personId },
    select: { id: true, zoneId: true },
  });
  for (const asset of assets) {
    await tx.asset.update({
      where: { id: asset.id },
      data: { personId: null },
    });
    await recordAssignmentChange(tx, organizationId, asset.id, {
      personId: null,
      zoneId: asset.zoneId,
    });
  }
  await tx.user.updateMany({
    where: { organizationId, personId, disabledAt: null },
    data: { disabledAt: now },
  });
}

/** Départ : statut « parti », poste libéré, matériel restitué, connexion désactivée. Les données restent jusqu'à l'anonymisation. */
export async function departPerson(
  organizationId: string,
  personId: string,
  now: Date = new Date(),
): Promise<void> {
  await rawPrisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({
      where: { id: personId, organizationId },
      select: { status: true },
    });
    if (!person) throw new NotFoundError("Collaborateur");
    if (person.status === "DEPARTED")
      throw new InvalidOperationError("Collaborateur déjà parti");
    await tx.person.update({
      where: { id: personId },
      data: { status: "DEPARTED", departedAt: now },
    });
    await release(tx, organizationId, personId, now);
  });
}

export interface AnonymizationResult {
  personId: string;
  alreadyAnonymized: boolean;
}

/**
 * Anonymise les données personnelles d'un collaborateur : identité remplacée, compte rendu inutilisable,
 * présence supprimée, demandes vidées de leur texte libre. L'historique du stock et du matériel est conservé
 * sous forme non nominative (les lignes restent, sans lien avec une personne identifiable).
 */
export async function anonymizePerson(
  organizationId: string,
  personId: string,
  now: Date = new Date(),
): Promise<AnonymizationResult> {
  return rawPrisma.$transaction(async (tx) => {
    const person = await tx.person.findFirst({
      where: { id: personId, organizationId },
      select: { status: true, departedAt: true, anonymizedAt: true },
    });
    if (!person) throw new NotFoundError("Collaborateur");
    if (person.anonymizedAt) return { personId, alreadyAnonymized: true };

    await tx.person.update({
      where: { id: personId },
      data: {
        ...ANONYMOUS,
        workEmail: `anonyme-${personId}@anonymise.invalid`,
        status: "DEPARTED",
        departedAt: person.departedAt ?? now,
        anonymizedAt: now,
      },
    });
    await release(tx, organizationId, personId, now);

    // Historique d'affectation : plus aucun lien avec la personne
    await tx.assetAssignment.updateMany({
      where: { organizationId, personId },
      data: { personId: null },
    });
    await tx.presenceStatus.deleteMany({ where: { organizationId, personId } });

    const users = await tx.user.findMany({
      where: { organizationId, personId },
      select: { id: true, email: true },
    });
    for (const user of users) {
      await tx.loginAttempt.deleteMany({
        where: { emailKey: attemptKey(user.email) },
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `anonyme-${user.id}@anonymise.invalid`,
          passwordHash: UNUSABLE_PASSWORD_HASH,
          disabledAt: now,
        },
      });
      await tx.privacyRequest.updateMany({
        where: { organizationId, requesterId: user.id },
        data: { details: "" },
      });
    }
    return { personId, alreadyAnonymized: false };
  });
}
