import { useEffect, useRef, useState } from "react";

import { distanceKm } from "@/lib/geo";

/**
 * Directions come from OSRM, an open-source routing engine that runs on OpenStreetMap data.
 * The public demo server is used here; it is fine for a prototype but should be replaced by your own
 * OSRM/GraphHopper instance (or a hosted provider) in production. It has no live traffic or voice guidance.
 */
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const MIN_INTERVAL_MS = 8000;

export type LatLng = { lat: number; lng: number };
export type RouteStep = { text: string; meters: number };
export type RouteInfo = {
  coords: [number, number][];
  distanceKm: number;
  minutes: number;
  steps: RouteStep[];
  /** "osrm" for a real road route, "estimate" for a straight-line fallback when routing is unavailable. */
  source: "osrm" | "estimate";
};

type OsrmStep = { distance: number; name: string; maneuver: { type: string; modifier?: string } };

function instruction(step: OsrmStep): string {
  const { type, modifier } = step.maneuver;
  const road = step.name ? ` onto ${step.name}` : "";
  if (type === "depart") return `Head out${step.name ? ` on ${step.name}` : ""}`;
  if (type === "arrive") return "Arrive at the outage location";
  if (type === "roundabout" || type === "rotary") return `At the roundabout, take the exit${road}`;
  const direction = modifier ?? "straight";
  return direction === "straight" ? `Continue straight${road}` : `Turn ${direction}${road}`;
}

function estimate(from: LatLng, to: LatLng): RouteInfo {
  const km = distanceKm(from, to) * 1.3;
  return {
    coords: [[from.lat, from.lng], [to.lat, to.lng]],
    distanceKm: km,
    minutes: Math.max(1, Math.round((km / 40) * 60)),
    steps: [{ text: "Head towards the outage location (road directions unavailable)", meters: km * 1000 }],
    source: "estimate",
  };
}

async function fetchRoute(from: LatLng, to: LatLng, signal: AbortSignal): Promise<RouteInfo> {
  const response = await fetch(`${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`, { signal });
  if (!response.ok) throw new Error(`Routing failed (${response.status})`);
  const data = (await response.json()) as {
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[];
  };
  const route = data.routes?.[0];
  if (!route) throw new Error("No route found");
  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    distanceKm: route.distance / 1000,
    minutes: Math.max(1, Math.round(route.duration / 60)),
    steps: route.legs.flatMap((leg) => leg.steps).map((step) => ({ text: instruction(step), meters: step.distance })),
    source: "osrm",
  };
}

/** Road route from `from` to `to`; refreshed when the origin moves about 100 m, at most every 8 seconds. */
export function useRoute(from: LatLng | null, to: LatLng | null): RouteInfo | null {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const lastFetch = useRef(0);
  const fromKey = from ? `${from.lat.toFixed(3)},${from.lng.toFixed(3)}` : "";
  const toKey = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : "";

  useEffect(() => {
    if (!from || !to) {
      setRoute(null);
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      lastFetch.current = Date.now();
      try {
        const next = await fetchRoute(from, to, controller.signal);
        if (!controller.signal.aborted) setRoute(next);
      } catch {
        if (!controller.signal.aborted) setRoute(estimate(from, to));
      }
    };
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastFetch.current));
    const timer = setTimeout(run, wait);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, toKey]);

  return route;
}
