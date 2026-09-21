import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, LayerGroup, Map as LeafletMap, Marker, Polyline } from "leaflet";

import type { Incident, Priority } from "@/components/lesedi/data";
import type { CrewLocation } from "@/lib/reports";

type LeafletLib = typeof import("leaflet");

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: "incident" | "crew" | "me" | "node";
  /** For sensor nodes: heartbeat health. */
  state?: "online" | "late" | "silent";
  label: string;
  detail?: string;
  priority?: Priority;
};

type LiveMapProps = {
  title?: string;
  subtitle?: string;
  markers?: MapMarker[];
  /** Tailwind height class for the map area. */
  heightClass?: string;
  /** Fly to this point when it changes. */
  focus?: { lat: number; lng: number } | null;
  onSelect?: (id: string) => void;
  /** A road route to draw as a line, as [lat, lng] pairs. */
  route?: [number, number][] | null;
  /** An affected area drawn as a shaded circle (used in place of an exact pin). */
  area?: { lat: number; lng: number; radiusM: number } | null;
  /**
   * Change this to re-frame the map so everything on it is in view. The map otherwise frames itself only
   * once, which would leave a technician who starts far away off-screen.
   */
  fitKey?: string;
  /** Picker mode: a draggable pin the user can place by tapping the map. */
  pin?: { lat: number; lng: number } | null;
  pinAccuracy?: number | undefined;
  onPin?: (position: { lat: number; lng: number }) => void;
};

const TSHWANE: [number, number] = [-25.7479, 28.2293];

const BOLT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>';
const PERSON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';
const CAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m3 13 2-6h14l2 6v6h-3v-2H6v2H3zm4.5 1a1.5 1.5 0 1 0 0 .01zm9 0a1.5 1.5 0 1 0 0 .01z"/></svg>';

function iconFor(L: LeafletLib, marker: Pick<MapMarker, "kind" | "priority" | "state">) {
  if (marker.kind === "node") return L.divIcon({ className: "ll-icon", html: `<span class="ll-node ll-node--${marker.state ?? "online"}"></span>`, iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] });
  const tone = marker.kind === "incident" ? (marker.priority === "Critical" || !marker.priority ? "" : ` ll-pin--${marker.priority.toLowerCase()}`) : ` ll-pin--${marker.kind}`;
  const glyph = marker.kind === "incident" ? BOLT : marker.kind === "crew" ? CAR : PERSON;
  return L.divIcon({ className: "ll-icon", html: `<span class="ll-pin${tone}">${glyph}</span>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17] });
}

function popupFor(marker: MapMarker) {
  const box = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = marker.label;
  box.append(title);
  if (marker.detail) {
    const line = document.createElement("div");
    line.textContent = marker.detail;
    box.append(line);
  }
  return box;
}

export function incidentMarkers(list: Incident[]): MapMarker[] {
  return list.map((item) => ({ id: item.id, lat: item.lat, lng: item.lng, kind: "incident", label: `${item.id} · ${item.place}`, detail: `${item.priority} · ${item.detail}`, priority: item.priority }));
}

export function crewMarkers(crews: { name: string; skill: string; status: string; lat: number; lng: number }[], live: Record<string, CrewLocation>): MapMarker[] {
  return crews.map((crew) => {
    const fix = live[crew.name];
    const tracked = fix && Date.now() - fix.at < 120000;
    return { id: `crew:${crew.name}`, lat: fix?.lat ?? crew.lat, lng: fix?.lng ?? crew.lng, kind: "crew", label: crew.name, detail: `${crew.skill} · ${crew.status} · ${tracked ? "Live GPS" : "Last known position"}` };
  });
}

export function LiveMap({ title = "LIVE NETWORK MAP", subtitle = "Tshwane metro", markers = [], heightClass = "h-[390px]", focus, onSelect, route, area, fitKey, pin, pinAccuracy, onPin }: LiveMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const lib = useRef<LeafletLib | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const pinMarker = useRef<Marker | null>(null);
  const pinCircle = useRef<Circle | null>(null);
  const routeLine = useRef<Polyline | null>(null);
  const areaCircle = useRef<Circle | null>(null);
  const pinFromMap = useRef(false);
  const fitted = useRef(false);
  const lastFitKey = useRef<string | undefined>(undefined);
  const onSelectRef = useRef(onSelect);
  const onPinRef = useRef(onPin);
  const [ready, setReady] = useState(false);

  onSelectRef.current = onSelect;
  onPinRef.current = onPin;

  // Create the map once, in the browser only (Leaflet needs `window`).
  useEffect(() => {
    let cancelled = false;
    let resizer: ResizeObserver | undefined;
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      lib.current = L;
      const instance = L.map(container.current, { center: TSHWANE, zoom: 11, scrollWheelZoom: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(instance);
      layer.current = L.layerGroup().addTo(instance);
      instance.on("click", (event) => {
        if (!onPinRef.current) return;
        pinFromMap.current = true;
        onPinRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      map.current = instance;
      resizer = new ResizeObserver(() => instance.invalidateSize());
      resizer.observe(container.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      resizer?.disconnect();
      map.current?.remove();
      map.current = null;
      layer.current = null;
      pinMarker.current = null;
      pinCircle.current = null;
      routeLine.current = null;
      areaCircle.current = null;
      fitted.current = false;
      setReady(false);
    };
  }, []);

  /** Frame everything the map is drawing: markers, the route line and the affected-area circle. */
  const frameAll = () => {
    const L = lib.current;
    if (!L || !map.current) return;
    const points: [number, number][] = markers.map((item) => [item.lat, item.lng]);
    if (route) points.push(...route);
    if (points.length === 0 && !area) return;
    const bounds = points.length > 0 ? L.latLngBounds(points) : L.latLngBounds([]);
    // A square around the affected-area circle. Leaflet's Circle.getBounds() needs the circle to be on a
    // map, so it cannot be used here.
    if (area) bounds.extend(L.latLng(area.lat, area.lng).toBounds(area.radiusM * 2));
    if (!bounds.isValid()) return;
    fitted.current = true;
    map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  // Draw incident, crew and GPS markers.
  useEffect(() => {
    const L = lib.current;
    if (!ready || !L || !map.current || !layer.current) return;
    layer.current.clearLayers();
    for (const item of markers) {
      const marker = L.marker([item.lat, item.lng], { icon: iconFor(L, item), title: item.label, keyboard: true }).bindPopup(popupFor(item));
      marker.on("click", () => onSelectRef.current?.(item.id));
      marker.addTo(layer.current);
    }
    if (!fitted.current && !pin && markers.length > 0) {
      fitted.current = true;
      map.current.fitBounds(L.latLngBounds(markers.map((item) => [item.lat, item.lng] as [number, number])), { padding: [40, 40], maxZoom: 13 });
      return;
    }
    // A marker can move a long way after the map framed itself: a technician's first real GPS reading
    // replaces their depot position, and then they drive. Re-frame only when one leaves the view, so the
    // map does not jump about while they are on screen.
    if (fitKey !== undefined && fitted.current && markers.length > 1 && !pin) {
      const view = map.current.getBounds();
      if (markers.some((item) => !view.contains([item.lat, item.lng]))) frameAll();
    }
  }, [ready, markers, pin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Affected area, drawn as a circle so no one's exact address is revealed.
  useEffect(() => {
    const L = lib.current;
    if (!ready || !L || !map.current) return;
    areaCircle.current?.remove();
    areaCircle.current = area ? L.circle([area.lat, area.lng], { radius: area.radiusM, className: "ll-area", weight: 2, fillOpacity: 0.15 }).addTo(map.current) : null;
    if (area && !fitted.current) {
      fitted.current = true;
      map.current.fitBounds(areaCircle.current!.getBounds(), { padding: [30, 30] });
    }
  }, [ready, area?.lat, area?.lng, area?.radiusM]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-frame everything when the caller says something important appeared, such as the technician's marker
  // and route arriving on a resident's tracker. Without this they would be drawn outside the current view.
  useEffect(() => {
    if (!ready || fitKey === undefined || fitKey === lastFitKey.current) return;
    lastFitKey.current = fitKey;
    frameAll();
  }, [ready, fitKey, markers, route, area]); // eslint-disable-line react-hooks/exhaustive-deps

  // Road route (e.g. technician to job), drawn under the markers.
  useEffect(() => {
    const L = lib.current;
    if (!ready || !L || !map.current) return;
    routeLine.current?.remove();
    routeLine.current = route && route.length > 1 ? L.polyline(route, { className: "ll-route", weight: 5, opacity: 0.85 }).addTo(map.current) : null;
  }, [ready, route]);

  useEffect(() => {
    if (ready && focus && map.current) map.current.flyTo([focus.lat, focus.lng], Math.max(map.current.getZoom(), 14), { duration: 0.8 });
  }, [ready, focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Picker pin: draggable, with an accuracy circle when the position came from GPS.
  useEffect(() => {
    const L = lib.current;
    if (!ready || !L || !map.current) return;
    if (!pin) {
      pinMarker.current?.remove();
      pinCircle.current?.remove();
      pinMarker.current = null;
      pinCircle.current = null;
      return;
    }
    const at: [number, number] = [pin.lat, pin.lng];
    if (pinMarker.current) {
      pinMarker.current.setLatLng(at);
    } else {
      const marker = L.marker(at, { icon: iconFor(L, { kind: "incident" }), draggable: true, title: "Outage location. Drag to adjust." }).addTo(map.current);
      marker.on("dragend", () => {
        const next = marker.getLatLng();
        pinFromMap.current = true;
        onPinRef.current?.({ lat: next.lat, lng: next.lng });
      });
      pinMarker.current = marker;
    }
    pinCircle.current?.remove();
    pinCircle.current = pinAccuracy ? L.circle(at, { radius: pinAccuracy, weight: 1, opacity: 0.6, fillOpacity: 0.12 }).addTo(map.current) : null;
    if (pinFromMap.current) pinFromMap.current = false;
    else map.current.setView(at, Math.max(map.current.getZoom(), 16));
  }, [ready, pin?.lat, pin?.lng, pinAccuracy]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div>
          <p className="text-xs font-extrabold text-navy">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <p className="flex items-center gap-3 text-[10px] font-bold">
          <span><i className="mr-1 inline-block size-2 rounded-full bg-destructive" />Outage</span>
          <span><i className="mr-1 inline-block size-2 rounded-full bg-success" />Crew</span>
          <span><i className="mr-1 inline-block size-2 rounded-full bg-primary" />You</span>
        </p>
      </div>
      <div ref={container} className={`isolate w-full bg-muted ${heightClass}`} role="application" aria-label={`${title}. Interactive OpenStreetMap.`} />
    </div>
  );
}
