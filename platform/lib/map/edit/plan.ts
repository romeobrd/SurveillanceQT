// Plan de réaffectation : ce que l'utilisateur décide pour ne perdre aucune donnée quand des postes ou des
// pièces disparaissent d'une carte (SPEC §6.4). Partagé par l'interface (saisie) et le serveur (application).
import { z } from "zod";

export const ReassignmentPlanSchema = z.object({
  /** Par identifiant d'élément « poste » retiré : libérer la personne ou la placer sur un autre poste. */
  workstations: z
    .record(
      z.string(),
      z.union([
        z.object({ action: z.literal("release") }),
        z.object({
          action: z.literal("move"),
          toElementKey: z.string().min(1),
        }),
      ]),
    )
    .default({}),
  /** Par identifiant de pièce retirée : détacher le stock et le matériel, ou les ranger dans une autre pièce. */
  zones: z
    .record(
      z.string(),
      z.union([
        z.object({ action: z.literal("unassign") }),
        z.object({ action: z.literal("move"), toZoneKey: z.string().min(1) }),
      ]),
    )
    .default({}),
});

export type ReassignmentPlan = z.infer<typeof ReassignmentPlanSchema>;

export const EMPTY_PLAN: ReassignmentPlan = { workstations: {}, zones: {} };

export interface LayoutImpact {
  /** Postes attribués qui disparaissent. */
  workstations: Array<{
    elementKey: string;
    label: string;
    zoneName: string;
    personName: string;
  }>;
  /** Pièces qui disparaissent et contiennent du stock ou du matériel. */
  zones: Array<{
    zoneKey: string;
    name: string;
    stockCount: number;
    assetCount: number;
  }>;
  /** Destinations possibles. */
  targets: {
    workstations: Array<{
      elementKey: string;
      label: string;
      zoneName: string;
    }>;
    zones: Array<{ key: string; name: string }>;
  };
}

export function isImpactEmpty(impact: LayoutImpact): boolean {
  return impact.workstations.length === 0 && impact.zones.length === 0;
}

/** Vrai quand chaque élément concerné a une décision valide. */
export function isPlanComplete(
  impact: LayoutImpact,
  plan: ReassignmentPlan,
): boolean {
  const targetStations = new Set(
    impact.targets.workstations.map((target) => target.elementKey),
  );
  const targetZones = new Set(impact.targets.zones.map((target) => target.key));
  const usedTargets = new Set<string>();
  for (const item of impact.workstations) {
    const choice = plan.workstations[item.elementKey];
    if (!choice) return false;
    if (choice.action === "move") {
      if (
        !targetStations.has(choice.toElementKey) ||
        usedTargets.has(choice.toElementKey)
      )
        return false;
      usedTargets.add(choice.toElementKey);
    }
  }
  for (const item of impact.zones) {
    const choice = plan.zones[item.zoneKey];
    if (!choice) return false;
    if (choice.action === "move" && !targetZones.has(choice.toZoneKey))
      return false;
  }
  return true;
}
