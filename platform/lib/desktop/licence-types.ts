// Licence de l'application de bureau telle que renvoyée par le serveur du site (partagée client / serveur).

export interface DesktopLicence {
  organizationId: string;
  organizationName: string;
  plan: string;
  planName: string;
  maxPeople: number;
  /** Fin de la période payée (ISO), null si inconnue. */
  validUntil: string | null;
  admin: { email: string; firstName: string; lastName: string };
}

/** Licence conservée sur le PC (fichier licence.json du dossier de données de l'application). */
export interface StoredLicence {
  token: string;
  licence: DesktopLicence;
  /** Dernière réponse du serveur : abonnement actif ou non. */
  status: "active" | "no_subscription" | "revoked";
  /** Dernier contrôle réussi auprès du serveur (ISO). */
  lastVerifiedAt: string;
  /** Site Spacora qui a délivré la licence (contrôles suivants). */
  accountUrl?: string;
}
