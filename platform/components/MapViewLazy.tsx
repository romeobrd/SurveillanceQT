"use client";

import dynamic from "next/dynamic";
import { fr } from "@/lib/i18n/fr";

/** La carte PixiJS n'existe que dans le navigateur (jamais rendue côté serveur). */
const MapViewLazy = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <p className="flex h-full items-center justify-center bg-slate-800 text-slate-200">
      {fr.map.loading}
    </p>
  ),
});

export default MapViewLazy;
