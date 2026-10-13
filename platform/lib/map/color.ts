// Utilitaires de couleur (#rrggbb -> entier), purs.

export function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/** Éclaircit (factor > 1) ou assombrit (factor < 1) une couleur. */
export function shade(hex: string, factor: number): number {
  const value = hexToInt(hex);
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 0xff) * factor)));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Mélange deux couleurs #rrggbb (t = 0 : a, t = 1 : b) ; résultat en #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const va = hexToInt(a);
  const vb = hexToInt(b);
  const channel = (shift: number) =>
    Math.round(((va >> shift) & 0xff) * (1 - t) + ((vb >> shift) & 0xff) * t);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0")}`;
}
