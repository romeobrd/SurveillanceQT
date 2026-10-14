import type { NextConfig } from "next";
import { buildCsp } from "./lib/security/csp";

const isProduction = process.env.NODE_ENV === "production";
// Application de bureau : servie localement en http (127.0.0.1), ni HTTPS forcé ni HSTS
const desktop = process.env.SPACORA_EDITION === "desktop";

// En-têtes de sécurité posés sur toutes les réponses (voir lib/security/csp.ts pour la CSP)
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildCsp({ dev: !isProduction, local: desktop }),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    // Aucune API sensible n'est utilisée : géolocalisation, caméra et micro sont refusés explicitement
    value: "geolocation=(), camera=(), microphone=(), interest-cohort=()",
  },
  ...(isProduction && !desktop
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Export du site vitrine (scripts/export-vitrine.mjs) : construction séparée, la normale reste intacte
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Application de bureau (desktop/build.mjs) : serveur autonome embarqué dans l'installateur
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const }
    : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Server actions : origines autorisées derrière un proxy inverse (APP_ORIGIN = nom d'hôte public)
  experimental: {
    serverActions: {
      // Import CSV : fichier d'1 Mo au plus, plus l'enveloppe du formulaire
      bodySizeLimit: "2mb",
      ...(process.env.APP_ORIGIN
        ? { allowedOrigins: [process.env.APP_ORIGIN] }
        : {}),
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Modules natifs / pilotes : chargés tels quels côté serveur, jamais empaquetés
  serverExternalPackages: ["@node-rs/argon2", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
