import type { Incident, Priority } from "@/components/lesedi/data";
import { createStore } from "@/lib/store";

export const outageTypes = ["Total blackout", "Partial outage", "Equipment damage", "Other"] as const;
export type OutageType = (typeof outageTypes)[number];

/** A citizen's outage report. Location and media travel with it to every dashboard. */
export type OutageReport = {
  id: string;
  createdAt: number;
  reporter: string;
  /** Full name the resident entered on the form (the login name is kept in `reporter`). */
  fullName?: string | undefined;
  email?: string | undefined;
  altContact?: string | undefined;
  address: string;
  account: string;
  contact: string;
  type: OutageType;
  description: string;
  lat: number;
  lng: number;
  /** GPS accuracy in metres when the location was detected (absent when the pin was placed by hand). */
  accuracy?: number | undefined;
  photos: string[];
  hasVideo: boolean;
  /** Set when this report was recognised as a duplicate and linked to an existing incident (report or auto-detected ticket). */
  duplicateOf?: string | undefined;
};

/** Technician progress stages, in order. A dispatch that has not been accepted yet has stage -1. */
export const stageNames = ["Accepted", "En route", "On site", "In progress", "Complete"] as const;
export type JobUpdate = { stage: number; at: number; note?: string | undefined };
export type Dispatch = { tech: string; at: number; stage?: number; updates?: JobUpdate[] };
export type CrewLocation = { lat: number; lng: number; accuracy: number; at: number };

export const reportStore = createStore<OutageReport[]>("lesedilink.reports", []);
/** The resident's saved contact details, so they do not have to retype them for every report. */
export type CustomerProfile = { fullName: string; phone: string; email: string; altPhone: string; account: string };
export const profileStore = createStore<Record<string, CustomerProfile>>("lesedilink.customer-profiles", {});

export const dispatchStore = createStore<Record<string, Dispatch>>("lesedilink.dispatches", {});
export const crewStore = createStore<Record<string, CrewLocation>>("lesedilink.crews", {});

// Videos are too large for localStorage, so they live in memory for this browser session only.
const videos = new Map<string, string>();
export const setReportVideo = (id: string, url: string) => {
  videos.set(id, url);
};
export const getReportVideo = (id: string) => videos.get(id);

export const jobStage = (dispatch: Dispatch | undefined) => (dispatch ? (dispatch.stage ?? -1) : null);

export function assignJob(id: string, tech: string) {
  const at = Date.now();
  dispatchStore.set({ ...dispatchStore.get(), [id]: { tech, at, stage: -1, updates: [{ stage: -1, at, note: `Assigned to ${tech} by the control centre` }] } });
}

/** A technician's progress update. It is stored once and read by the customer and dispatcher dashboards. */
export function updateJob(id: string, stage: number, note?: string) {
  const all = dispatchStore.get();
  const current = all[id];
  if (!current) return;
  const update: JobUpdate = { stage, at: Date.now(), ...(note ? { note } : {}) };
  dispatchStore.set({ ...all, [id]: { ...current, stage, updates: [...(current.updates ?? []), update] } });
}

export function nextReportId() {
  const highest = reportStore.get().reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, ""))), 4829);
  return `#LL-${highest + 1}`;
}

export function addReport(report: OutageReport) {
  reportStore.set([report, ...reportStore.get()]);
}

const priorityByType: Record<OutageType, Priority> = { "Total blackout": "High", "Equipment damage": "High", "Partial outage": "Medium", Other: "Low" };

export function ago(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

/** More people affected than a single household raises the priority one level. */
const order: Priority[] = ["Low", "Medium", "High", "Critical"];
export const escalate = (priority: Priority, affected: number): Priority =>
  affected >= 5 ? (order[Math.min(order.length - 1, order.indexOf(priority) + 1)] ?? priority) : priority;

export function toIncident(report: OutageReport, linked = 0, followers = 0): Incident {
  const affected = 1 + linked + followers;
  return {
    id: report.id,
    place: report.address || "Pinned location",
    detail: `${report.type} · ${report.description}`,
    priority: escalate(priorityByType[report.type], affected),
    people: `${affected} affected · ${linked + 1} report${linked === 0 ? "" : "s"}${followers > 0 ? ` · ${followers} following` : ""}`,
    age: ago(report.createdAt),
    lat: report.lat,
    lng: report.lng,
    source: "citizen",
  };
}

export const osmLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
export const directionsLink = (lat: number, lng: number) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${lat}%2C${lng}`;
