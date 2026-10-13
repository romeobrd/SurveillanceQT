// Erreurs métier des dépôts de données (messages techniques ; les textes affichés sont dans lib/i18n).

/** Un élément est encore utilisé ailleurs : il faut d'abord le détacher (jamais de perte silencieuse). */
export class InUseError extends Error {
  constructor(
    public readonly resource: string,
    public readonly usedBy: string,
  ) {
    super(`${resource} encore utilisé par : ${usedBy}`);
    this.name = "InUseError";
  }
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `Stock insuffisant : ${available} disponible(s), ${requested} demandé(s)`,
    );
    this.name = "InsufficientStockError";
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} introuvable`);
    this.name = "NotFoundError";
  }
}

export class InvalidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOperationError";
  }
}

/** Valeur déjà utilisée là où elle doit être unique (référence, numéro de série, nom d'équipe…). */
export class DuplicateError extends Error {
  constructor(public readonly field: string) {
    super(`Valeur déjà utilisée : ${field}`);
    this.name = "DuplicateError";
  }
}

/** Convertit la violation d'unicité Prisma (P2002) en DuplicateError ; relance toute autre erreur. */
export function rethrowUnique(error: unknown, field: string): never {
  if (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  ) {
    throw new DuplicateError(field);
  }
  throw error;
}

/** La carte active a changé depuis l'ouverture de l'éditeur : enregistrer écraserait le travail d'un autre. */
export class StaleLayoutError extends Error {
  constructor() {
    super("La carte a été modifiée depuis l'ouverture de l'éditeur");
    this.name = "StaleLayoutError";
  }
}

/** Mot de passe actuel incorrect lors d'un changement de mot de passe. */
export class WrongPasswordError extends Error {
  constructor() {
    super("Mot de passe actuel incorrect");
    this.name = "WrongPasswordError";
  }
}
