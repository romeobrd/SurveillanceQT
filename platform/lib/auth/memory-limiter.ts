// Compteurs de tentatives en mémoire (par adresse IP, par couple adresse IP + compte, par entreprise…).
// Rien n'est écrit en base : aucune adresse IP n'est conservée, tout disparaît au redémarrage. Code pur, testé.

export interface LimitRule {
  /** Nombre d'essais autorisés dans la fenêtre, au-delà : refus jusqu'à la fin du blocage. */
  max: number;
  windowMs: number;
  blockMs: number;
}

interface Entry {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

/** Garde-fou mémoire : au-delà, les entrées les plus anciennes sont oubliées. */
const MAX_ENTRIES = 50_000;

export class MemoryLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly rule: LimitRule) {}

  isBlocked(key: string, now: number): boolean {
    const entry = this.entries.get(key);
    return entry !== undefined && entry.blockedUntil > now;
  }

  /** Enregistre un essai ; vrai si la limite est désormais atteinte (bloqué). */
  hit(key: string, now: number): boolean {
    let entry = this.entries.get(key);
    if (
      !entry ||
      (entry.blockedUntil <= now &&
        now - entry.windowStart >= this.rule.windowMs)
    ) {
      entry = { count: 0, windowStart: now, blockedUntil: 0 };
    }
    entry.count += 1;
    if (entry.count >= this.rule.max)
      entry.blockedUntil = now + this.rule.blockMs;
    // Réinsertion : l'ordre de la Map suit l'ancienneté de la dernière activité
    this.entries.delete(key);
    this.entries.set(key, entry);
    if (this.entries.size > MAX_ENTRIES) this.evict(now);
    return entry.blockedUntil > now;
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  private evict(now: number): void {
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= MAX_ENTRIES * 0.9) break;
      if (entry.blockedUntil <= now || this.entries.size > MAX_ENTRIES)
        this.entries.delete(key);
    }
  }
}
