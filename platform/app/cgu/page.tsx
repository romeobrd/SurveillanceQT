import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { TERMS_VERSION } from "@/features/signup/schemas";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `Conditions générales d'utilisation — ${fr.app.name}`,
};

export default function TermsPage() {
  const name = fr.app.name;
  return (
    <LegalPage
      title={`Conditions générales d'utilisation (version ${TERMS_VERSION})`}
      sections={[
        {
          title: "1. Objet",
          paragraphs: [
            `Les présentes conditions régissent l'utilisation du service ${name}, logiciel en ligne de gestion des locaux, des postes de travail, du stock, du matériel et des projets d'une entreprise (le « Client »), par ses utilisateurs autorisés.`,
          ],
        },
        {
          title: "2. Accès et comptes",
          paragraphs: [
            "L'inscription crée l'espace du Client et un premier compte administrateur. L'administrateur crée les comptes de ses collaborateurs et attribue leurs rôles. Chaque utilisateur garde son mot de passe confidentiel ; toute action faite avec son compte est réputée faite par lui.",
            "L'accès est réservé à un usage professionnel, conforme aux lois en vigueur et au droit du travail.",
          ],
        },
        {
          title: "3. Usages interdits",
          paragraphs: [
            "Il est interdit d'utiliser le service pour surveiller la localisation ou la présence des salariés, d'y saisir des données sensibles (santé, opinions, etc.), de tenter d'accéder aux données d'un autre client ou de perturber le service.",
          ],
        },
        {
          title: "4. Données",
          paragraphs: [
            `Le Client reste propriétaire de ses données. Pour les données personnelles de ses collaborateurs, le Client est responsable de traitement et l'éditeur de ${name} agit comme sous-traitant, selon l'accord de traitement des données (article 28 du RGPD) annexé aux CGV.`,
            "Le Client peut exporter ses données à tout moment. Elles sont supprimées à la fin du contrat, après un délai de [30] jours permettant leur récupération.",
          ],
        },
        {
          title: "5. Disponibilité et évolutions",
          paragraphs: [
            "L'éditeur met en œuvre les moyens raisonnables pour assurer la disponibilité du service, hors maintenance programmée. Le service peut évoluer ; aucune évolution ne réduit les garanties de protection des données.",
          ],
        },
        {
          title: "6. Responsabilité",
          paragraphs: [
            "La responsabilité de l'éditeur est limitée aux dommages directs et prouvés, dans la limite des sommes payées par le Client au cours des douze derniers mois. [Clause à valider par un juriste.]",
          ],
        },
        {
          title: "7. Durée, suspension, résiliation",
          paragraphs: [
            "Les conditions s'appliquent pendant toute la durée d'utilisation. En cas de manquement grave, l'accès peut être suspendu après mise en demeure restée sans effet.",
          ],
        },
        {
          title: "8. Droit applicable",
          paragraphs: [
            "Les présentes conditions sont soumises au droit français. Tout litige relève des tribunaux compétents de [ville], après tentative de règlement amiable.",
          ],
        },
      ]}
    />
  );
}
