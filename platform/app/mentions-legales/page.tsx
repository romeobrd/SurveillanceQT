import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = {
  title: `Mentions légales — ${fr.app.name}`,
};

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      sections={[
        {
          title: "Éditeur",
          paragraphs: [
            `Le service ${fr.app.name} est édité par [raison sociale], [forme juridique] au capital de [montant] €, immatriculée au RCS de [ville] sous le numéro [SIREN], dont le siège est situé [adresse].`,
            "Numéro de TVA intracommunautaire : [numéro]. Directeur de la publication : [nom, qualité]. Contact : [adresse e-mail].",
          ],
        },
        {
          title: "Hébergement",
          paragraphs: [
            "Le service est hébergé dans l'Union européenne par [hébergeur, raison sociale], [adresse], [téléphone].",
          ],
        },
        {
          title: "Propriété intellectuelle",
          paragraphs: [
            `Le logiciel, la marque ${fr.app.name}, les textes et les visuels du site sont protégés. Toute reproduction sans autorisation est interdite.`,
          ],
        },
      ]}
    />
  );
}
