/** The map's fixed geography: main shipping corridors, chokepoints and major ports. */

/** Corridors as waypoint lists [lon, lat]: a chart's sketch, not a route plan. */
export const LANES: { name: string; pts: [number, number][] }[] = [
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
  { name: "Hamburg", lon: 9.98, lat: 53.54 },
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

/** Longitudes made continuous, so a lane across the date line is drawn the short way. */
export function unwrap(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let shift = 0;
  pts.forEach(([lon, lat], i) => {
    if (i > 0) {
      const prev = pts[i - 1]![0];
      if (lon - prev > 180) shift -= 360;
      else if (prev - lon > 180) shift += 360;
    }
    out.push([lon + shift, lat]);
  });
  return out;
}
