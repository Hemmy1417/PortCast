"use client";

/**
 * The real world, as tiles: Esri's dark grey canvas with its place names,
 * zoomable and draggable. Shipping corridors are dashed lines, chokepoints
 * and major ports small marks, and every market a pin coloured by its state.
 * Browser-only (Leaflet needs the window), so the page loads it on the client.
 */
import "leaflet/dist/leaflet.css";

import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";

import { LANES, PORTS, unwrap } from "@/lib/places";
import type { MarketSummary } from "@/lib/types";

const PIN: Record<string, string> = {
  OPEN: "#ffcf33",
  RECORDED: "#e2531f",
  RESOLVED: "#e2531f",
  APPEALED: "#e2531f",
  FINAL: "#f5f6f3",
  VOID: "#5d6b7a",
};

export default function LiveMap({ markets, selected, onSelect, height = 460 }: {
  markets: MarketSummary[];
  selected?: string | null;
  onSelect?: (mid: string) => void;
  height?: number;
}) {
  return (
    <MapContainer center={[20, 20]} zoom={1.6} zoomSnap={0.2} minZoom={1} maxZoom={9} worldCopyJump scrollWheelZoom={false}
      style={{ height, width: "100%", background: "#0e1b2c" }} attributionControl>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community"
        maxNativeZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
      />
      {LANES.map((l) => (
        <Polyline key={l.name} positions={unwrap(l.pts).map(([lon, lat]) => [lat, lon])}
          pathOptions={{ color: "#f5f6f3", opacity: 0.35, weight: 1.4, dashArray: "4 6" }}>
          <Tooltip sticky>{l.name}</Tooltip>
        </Polyline>
      ))}
      {PORTS.map((p) => (
        <CircleMarker key={p.name} center={[p.lat, p.lon]} radius={p.chokepoint ? 4 : 3}
          pathOptions={p.chokepoint
            ? { color: "#f5f6f3", weight: 1.4, fillOpacity: 0, opacity: 0.8 }
            : { color: "#f5f6f3", weight: 0, fillColor: "#f5f6f3", fillOpacity: 0.55 }}>
          <Tooltip>{p.name}{p.chokepoint ? " (chokepoint)" : ""}</Tooltip>
        </CircleMarker>
      ))}
      {markets.map((m) => {
        const on = selected === m.market_id;
        return (
          <CircleMarker key={m.market_id} center={[Number(m.lat), Number(m.lon)]} radius={on ? 11 : 8}
            pathOptions={{ color: "#0e1b2c", weight: 2.5, fillColor: PIN[m.state] ?? "#ffcf33", fillOpacity: 1 }}
            eventHandlers={{ click: () => onSelect?.(m.market_id) }}>
            <Tooltip direction="top" offset={[0, -8]}>{m.question}</Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
