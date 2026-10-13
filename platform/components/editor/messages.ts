import type { Feedback } from "@/features/editor/state";
import { fr } from "@/lib/i18n/fr";

const problemLabels: Record<string, string> = fr.editor.problems;

export function problemText(code: string | null | undefined): string {
  return code ? (problemLabels[code] ?? code) : "";
}

/** Texte annoncé aux lecteurs d'écran pour un retour de l'éditeur. */
export function feedbackText(feedback: Feedback | null): string {
  if (!feedback) return "";
  const template: string = fr.editor.feedback[feedback.code];
  const isProblem =
    feedback.code === "refused" ||
    feedback.code === "zone_refused" ||
    feedback.code === "edge_refused";
  const detail = isProblem
    ? problemText(feedback.detail)
    : (feedback.detail ?? "");
  return template.replace("{detail}", detail);
}
