import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `Politique de confidentialité — ${fr.app.name}`,
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      sections={[
        {
          title: "Qui traite vos données ?",
          paragraphs: [
            "Pour les comptes clients, l'inscription et la facturation, l'éditeur [raison sociale] est responsable de traitement. Contact : [e-mail du référent RGPD].",
            "Pour les données des collaborateurs saisies par une entreprise cliente, c'est l'entreprise cliente qui est responsable de traitement ; l'éditeur agit pour son compte, comme sous-traitant.",
          ],
        },
        {
          title: "Quelles données, pour quoi faire ?",
          paragraphs: [
            "Inscription : nom de l'entreprise, nom, prénom et e-mail de l'administrateur, date d'acceptation des CGU (exécution du contrat et preuve de l'acceptation).",
            "Facturation : identifiants du client et de l'abonnement chez Stripe ; les coordonnées bancaires et de facturation sont recueillies directement par Stripe.",
            "Sécurité : journal d'audit (identifiants, sans contenu personnel), compteur de tentatives de connexion par empreinte d'e-mail (aucune adresse IP conservée).",
          ],
        },
        {
          title: "Combien de temps ?",
          paragraphs: [
            "Pendant la durée du contrat, puis [30] jours pour permettre l'export ; les pièces comptables sont conservées dix ans (obligation légale). Les durées propres aux données des collaborateurs sont réglées par chaque entreprise cliente.",
          ],
        },
        {
          title: "Destinataires et hébergement",
          paragraphs: [
            "Hébergement en France par OVH SAS. Paiement : Stripe (sous-traitant ; transferts encadrés par les clauses contractuelles types). Aucune donnée n'est vendue ni utilisée à des fins publicitaires.",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "Un seul cookie technique, indispensable à la connexion. Aucun cookie de mesure d'audience ni de publicité, aucun script tiers : aucun consentement n'est donc nécessaire.",
          ],
        },
        {
          title: "Vos droits",
          paragraphs: [
            "Accès, rectification, effacement, limitation, opposition, portabilité : écrivez à [e-mail]. Les collaborateurs d'une entreprise cliente exercent leurs droits depuis la page « Mes données » de l'application. Vous pouvez saisir la CNIL (www.cnil.fr).",
          ],
        },
      ]}
    />
  );
}
