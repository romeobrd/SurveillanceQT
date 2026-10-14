// Adresse IP du visiteur, pour limiter les tentatives répétées. Code pur, testé.
// Derrière le proxy (Caddy), l'adresse réelle est la DERNIÈRE de X-Forwarded-For : celle ajoutée par le proxy,
// les précédentes pouvant être inventées par le visiteur. Jamais enregistrée en base.

type HeaderSource = { get(name: string): string | null };

export function clientIp(headers: HeaderSource): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) return last.slice(0, 64);
  }
  return headers.get("x-real-ip")?.trim().slice(0, 64) || "inconnue";
}
