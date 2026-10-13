import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { PLANS, TRIAL_DAYS } from "@/features/billing/plans";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `Conditions générales de vente — ${fr.app.name}`,
};

export default function SalesTermsPage() {
  const offers = Object.values(PLANS)
    .map(
      (plan) =>
        `${plan.name} : ${plan.monthlyPrice} € HT par mois ou ${plan.yearlyPrice} € HT par an, jusqu'à ${plan.maxPeople} collaborateurs actifs`,
    )
    .join(" ; ");
  return (
    <LegalPage
      title="Conditions générales de vente"
      sections={[
        {
          title: "1. Clients",
          paragraphs: [
            "Le service est vendu exclusivement à des professionnels (entreprises, associations, administrations). Le droit de rétractation des consommateurs ne s'applique pas.",
          ],
        },
        {
          title: "2. Offres et prix",
          paragraphs: [
            `Offres en vigueur : ${offers}. Les prix s'entendent hors taxes ; la TVA applicable est ajoutée sur la facture.`,
            "Si le nombre de collaborateurs actifs dépasse la limite de l'offre, l'ajout de nouveaux collaborateurs est bloqué jusqu'au passage à l'offre supérieure.",
          ],
        },
        {
          title: "3. Essai gratuit",
          paragraphs: [
            `Chaque nouvel espace bénéficie d'un essai gratuit de ${TRIAL_DAYS} jours, sans moyen de paiement. À la fin de l'essai sans souscription, l'espace passe en lecture seule : les données restent consultables et exportables.`,
          ],
        },
        {
          title: "4. Paiement et facturation",
          paragraphs: [
            "Le paiement est effectué par carte ou prélèvement via notre prestataire de paiement Stripe, qui traite les données bancaires ; l'éditeur n'y a jamais accès. Les factures sont disponibles dans l'espace de facturation.",
            "Tout retard de paiement entraîne des pénalités au taux de trois fois le taux d'intérêt légal et une indemnité forfaitaire de 40 € pour frais de recouvrement (article L441-10 du Code de commerce).",
          ],
        },
        {
          title: "5. Durée, renouvellement, résiliation",
          paragraphs: [
            "L'abonnement mensuel ou annuel est renouvelé automatiquement à chaque échéance. Le Client peut le résilier à tout moment depuis l'espace de facturation ; la résiliation prend effet à la fin de la période déjà payée, sans remboursement prorata temporis.",
          ],
        },
        {
          title: "6. Données et sous-traitance",
          paragraphs: [
            "Les engagements de l'éditeur en tant que sous-traitant (article 28 du RGPD) figurent dans l'accord de traitement des données : [lien vers le DPA]. Liste des sous-traitants ultérieurs : hébergeur [nom], Stripe (paiement).",
          ],
        },
        {
          title: "7. Droit applicable",
          paragraphs: ["Droit français. Tribunaux de commerce de [ville]."],
        },
      ]}
    />
  );
}
