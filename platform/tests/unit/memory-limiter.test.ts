// Compteurs en mémoire (adresse IP, couple adresse + compte) et lecture de l'adresse du visiteur.
import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/auth/client-ip";
import { MemoryLimiter } from "@/lib/auth/memory-limiter";

const MIN = 60_000;

describe("compteur en mémoire", () => {
  it("bloque à la limite, pendant la durée prévue, puis repart de zéro", () => {
    const limiter = new MemoryLimiter({
      max: 3,
      windowMs: 15 * MIN,
      blockMs: 15 * MIN,
    });
    expect(limiter.hit("a", 0)).toBe(false);
    expect(limiter.hit("a", MIN)).toBe(false);
    expect(limiter.hit("a", 2 * MIN)).toBe(true);
    expect(limiter.isBlocked("a", 16 * MIN)).toBe(true);
    expect(limiter.isBlocked("b", 3 * MIN)).toBe(false);
    expect(limiter.isBlocked("a", 18 * MIN)).toBe(false);
    expect(limiter.hit("a", 18 * MIN)).toBe(false);
  });

  it("oublie les essais anciens (fenêtre écoulée) et s'efface sur demande", () => {
    const limiter = new MemoryLimiter({
      max: 2,
      windowMs: 15 * MIN,
      blockMs: MIN,
    });
    limiter.hit("a", 0);
    expect(limiter.hit("a", 16 * MIN)).toBe(false);
    limiter.clear("a");
    expect(limiter.hit("a", 17 * MIN)).toBe(false);
  });
});

describe("adresse du visiteur", () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it("prend l'adresse ajoutée par le proxy (la dernière), pas celles inventées par le visiteur", () => {
    expect(
      clientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" })),
    ).toBe("203.0.113.7");
    expect(clientIp(headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
    expect(clientIp(headers({}))).toBe("inconnue");
  });
});
