"use client";

/**
 * The world as a chart: land in hull-soft on hull water, the main shipping
 * corridors as dashed lanes, the chokepoints and major ports as small marks,
 * and every market as a pin coloured by its state. A pin is a button; the
 * page decides what choosing one does.
 */
import { geoEqualEarth, geoPath, geoGraticule10 } from "d3-geo";
import { useMemo } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";

import type { MarketSummary } from "@/lib/types";

const W = 960;
const H = 470;

/** Corridors as waypoint lists [lon, lat]: a chart's sketch, not a route plan. */
const LANES: { name: string; pts: [number, number][] }[] = [
  { name: "Asia to Europe via Suez", pts: [[121.5, 31.2], [114, 22], [104, 1.3], [80, 6], [57, 13], [43.5, 12.6], [32.5, 29.9], [32.3, 31.3], [15, 36], [-5.6, 36], [-9, 43], [4, 51.9]] },
  { name: "Transpacific", pts: [[121.5, 31.2], [140, 35], [170, 42], [-150, 42], [-118.2, 33.7]] },
  { name: "Asia to US East Coast via Panama", pts: [[121.5, 31.2], [150, 25], [-150, 15], [-100, 10], [-79.9, 9.1], [-75, 20], [-74, 40.6]] },
  { name: "Transatlantic", pts: [[4, 51.9], [-20, 48], [-50, 43], [-74, 40.6]] },
  { name: "Around the Cape", pts: [[104, 1.3], [60, -20], [18.4, -34.4], [0, -10], [-15, 20], [-9, 43]] },
];

export const PORTS: { name: string; lon: number; lat: number; chokepoint?: boolean }[] = [
  { name: "Shanghai", lon: 121.5, lat: 31.2 },
  { name: "Ningbo-Zhoushan", lon: 121.55, lat: 29.87 },
  { name: "Singapore", lon: 103.8, lat: 1.26 },
  { name: "Rotterdam", lon: 4.0, lat: 51.95 },
  { name: "Los Angeles / Long Beach", lon: -118.2, lat: 33.74 },
  { name: "Naples", lon: 14.27, lat: 40.84 },
  { name: "Yokohama", lon: 139.64, lat: 35.45 },
  { name: "Santos", lon: -46.3, lat: -23.96 },
  { name: "Suez Canal", lon: 32.35, lat: 30.6, chokepoint: true },
  { name: "Panama Canal", lon: -79.68, lat: 9.08, chokepoint: true },
  { name: "Strait of Hormuz", lon: 56.4, lat: 26.6, chokepoint: true },
  { name: "Bab el-Mandeb", lon: 43.4, lat: 12.6, chokepoint: true },
  { name: "Strait of Malacca", lon: 100.5, lat: 3.2, chokepoint: true },
];

const PIN: Record<string, string> = {
  OPEN: "#ffcf33",
  RECORDED: "#e2531f",
  RESOLVED: "#e2531f",
  APPEALED: "#e2531f",
  FINAL: "#f5f6f3",
  VOID: "#5d6b7a",
};

export function WorldMap({ markets, selected, onSelect }: {
  markets: MarketSummary[];
  selected?: string | null;
  onSelect?: (mid: string) => void;
}) {
  const { landPath, grid, project, lanes } = useMemo(() => {
    const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
    const land = feature(topo, topo.objects.land);
    const projection = geoEqualEarth().fitExtent([[8, 8], [W - 8, H - 8]], { type: "Sphere" });
    const path = geoPath(projection).digits(1);
    return {
      landPath: path(land) ?? "",
      grid: path(geoGraticule10()) ?? "",
      // Rounded, so the server's and the browser's numbers print identically.
      project: (lon: number, lat: number) => (projection([lon, lat]) ?? [0, 0]).map((v) => Math.round(v * 10) / 10) as [number, number],
      lanes: LANES.map((l) => ({ name: l.name, d: path({ type: "LineString", coordinates: l.pts }) ?? "" })),
    };
  }, []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Markets on a world map">
      <path d={grid} fill="none" stroke="#f5f6f3" strokeOpacity="0.06" strokeWidth="0.6" />
      <path d={landPath} fill="#24405f" stroke="#33557a" strokeWidth="0.6" />
      {lanes.map((l) => (
        <path key={l.name} d={l.d} fill="none" stroke="#f5f6f3" strokeOpacity="0.28" strokeWidth="1.1" strokeDasharray="4 5">
          <title>{l.name}</title>
        </path>
      ))}
      {PORTS.map((p) => {
        const [x, y] = project(p.lon, p.lat);
        return p.chokepoint ? (
          <rect key={p.name} x={x - 3} y={y - 3} width="6" height="6" transform={`rotate(45 ${x} ${y})`} fill="none" stroke="#f5f6f3" strokeOpacity="0.7" strokeWidth="1.2">
            <title>{p.name}</title>
          </rect>
        ) : (
          <circle key={p.name} cx={x} cy={y} r="2.2" fill="#f5f6f3" fillOpacity="0.55"><title>{p.name}</title></circle>
        );
      })}
      {markets.map((m) => {
        const [x, y] = project(Number(m.lon), Number(m.lat));
        const on = selected === m.market_id;
        const colour = PIN[m.state] ?? "#ffcf33";
        return (
          <g key={m.market_id} role="button" tabIndex={0} aria-label={m.question} className="cursor-pointer"
            onClick={() => onSelect?.(m.market_id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(m.market_id); }}>
            {m.state === "OPEN" ? <circle cx={x} cy={y} r="6" fill={colour} className="ping" /> : null}
            <circle cx={x} cy={y} r={on ? 9 : 6.5} fill={colour} stroke="#0e1b2c" strokeWidth="2" />
            <title>{m.question}</title>
          </g>
        );
      })}
    </svg>
  );
}
