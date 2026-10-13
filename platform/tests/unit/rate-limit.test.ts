import { describe, expect, it } from "vitest";
import {
  attemptKey,
  isLocked,
  LOCK_MINUTES,
  MAX_FAILURES,
  stateAfterFailure,
  type AttemptState,
} from "@/lib/auth/rate-limit";

const now = new Date("2026-01-01T10:00:00Z");

describe("limitation des tentatives", () => {
  it("ne conserve pas l'adresse e-mail et ignore la casse et les espaces", () => {
    const key = attemptKey("  Jean.Dupont@Exemple.fr ");
    expect(key).toBe(attemptKey("jean.dupont@exemple.fr"));
    expect(key).not.toContain("jean");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verrouille après MAX_FAILURES échecs, pas avant", () => {
    let state: AttemptState | null = null;
    for (let i = 1; i < MAX_FAILURES; i++) {
      state = stateAfterFailure(state, now);
      expect(isLocked(state, now)).toBe(false);
    }
    state = stateAfterFailure(state, now);
    expect(isLocked(state, now)).toBe(true);
    expect(state.lockedUntil!.getTime() - now.getTime()).toBe(
      LOCK_MINUTES * 60_000,
    );
  });

  it("se déverrouille à l'échéance et le compteur repart de zéro", () => {
    const locked = {
      failures: MAX_FAILURES,
      lockedUntil: new Date(now.getTime() + 60_000),
    };
    const later = new Date(now.getTime() + 61_000);
    expect(isLocked(locked, later)).toBe(false);
    expect(stateAfterFailure(locked, later)).toEqual({
      failures: 1,
      lockedUntil: null,
    });
  });

  it("n'est pas verrouillé sans historique", () => {
    expect(isLocked(null, now)).toBe(false);
  });
});
