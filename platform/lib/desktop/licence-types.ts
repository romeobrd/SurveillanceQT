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
  /** Attestation signée par le site : seule source de vérité (offre, entreprise, validité hors ligne). */
  grant: string;
  /** Dernière réponse du serveur : abonnement actif ou non. */
  status: "active" | "no_subscription" | "revoked";
  /** Date la plus récente constatée sur ce PC (ISO) : une horloge qui recule est détectée. */
  seenAt: string;
  /** Site Spacora qui a délivré la licence (contrôles suivants). */
  accountUrl?: string;
}
