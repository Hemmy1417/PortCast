"use client";

/**
 * The world map every page uses: a real, zoomable map loaded in the browser
 * only, with a hull-navy block holding its place while it loads.
 */
import dynamic from "next/dynamic";

import type { MarketSummary } from "@/lib/types";

const LiveMap = dynamic(() => import("./LiveMap"), {
  ssr: false,
  loading: () => <div className="pulse h-[460px] w-full bg-hull" aria-label="Loading the map" />,
});

export function WorldMap(props: { markets: MarketSummary[]; selected?: string | null; onSelect?: (mid: string) => void; height?: number }) {
  return <div className="isolate overflow-hidden rounded-tab"><LiveMap {...props} /></div>;
}
