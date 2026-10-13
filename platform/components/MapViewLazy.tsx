"use client";

import dynamic from "next/dynamic";
import { fr } from "@/lib/i18n/fr";

/** La carte 3D n'existe que dans le navigateur (jamais rendue côté serveur). */
const MapViewLazy = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <p className="bg-map flex h-full items-center justify-center text-slate-600">
      {fr.map.loading}
    </p>
  ),
});

export default MapViewLazy;
