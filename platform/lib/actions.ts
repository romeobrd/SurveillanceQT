// Aides communes aux server actions : droits vérifiés côté serveur, erreurs métier traduites.
import "server-only";
import { ZodError } from "zod";
import { WRITE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { requirePermission, type SessionInfo } from "@/lib/auth/session";
import {
  DuplicateError,
  ForbiddenError,
  getRepositories,
  InsufficientStockError,
  InUseError,
  InvalidLayoutError,
  InvalidOperationError,
  NotFoundError,
  ReassignmentRequiredError,
  StaleLayoutError,
  WrongPasswordError,
  SubscriptionRequiredError,
  PlanLimitError,
  type Repositories,
} from "@/lib/db";
import { fr } from "@/lib/i18n/fr";

export type ActionState = { error: string | null };

/** Droit vérifié, puis refus de toute écriture quand l'entreprise est en lecture seule. */
async function requireWritable(permission: Permission): Promise<SessionInfo> {
  const session = await requirePermission(permission);
  if (session.access === "readonly" && WRITE_PERMISSIONS.has(permission))
    throw new SubscriptionRequiredError();
  return session;
}

export function actionErrorMessage(error: unknown): string | null {
  if (error instanceof ZodError) return fr.errors.invalid;
  if (error instanceof ForbiddenError) return fr.errors.forbidden;
  if (error instanceof NotFoundError) return fr.errors.notFound;
  if (error instanceof InUseError) return fr.errors.inUse;
  if (error instanceof InsufficientStockError)
    return fr.errors.insufficientStock;
  if (error instanceof DuplicateError) return fr.errors.duplicate;
  if (error instanceof InvalidOperationError) return fr.errors.invalidOperation;
  if (error instanceof ReassignmentRequiredError)
    return `${fr.errors.reassignment} (${error.blockers.join(", ")})`;
  if (error instanceof InvalidLayoutError) return fr.errors.invalidLayout;
  if (error instanceof StaleLayoutError) return fr.errors.stale;
  if (error instanceof WrongPasswordError) return fr.errors.wrongPassword;
  if (error instanceof SubscriptionRequiredError) return fr.errors.subscription;
  if (error instanceof PlanLimitError)
    return fr.errors.planLimit.replace("{limit}", String(error.limit));
  return null;
}

/**
 * Exécute une action après vérification du droit. Les erreurs métier deviennent un message ;
 * les erreurs inattendues sont relancées (page d'erreur) et jamais affichées en détail.
 */
export async function guarded(
  permission: Permission,
  run: (repos: Repositories, session: SessionInfo) => Promise<void>,
): Promise<ActionState> {
  try {
    const session = await requireWritable(permission);
    await run(getRepositories(session), session);
    return { error: null };
  } catch (error) {
    const message = actionErrorMessage(error);
    if (message === null) throw error;
    return { error: message };
  }
}

export function formObject(
  formData: FormData,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

/** Comme `guarded`, mais renvoie une valeur (aperçu d'impact, contenu d'une version…). */
export async function guardedValue<T>(
  permission: Permission,
  run: (repos: Repositories, session: SessionInfo) => Promise<T>,
): Promise<{ error: string | null; value?: T }> {
  try {
    const session = await requireWritable(permission);
    return { error: null, value: await run(getRepositories(session), session) };
  } catch (error) {
    const message = actionErrorMessage(error);
    if (message === null) throw error;
    return { error: message };
  }
}
