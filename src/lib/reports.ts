import type { Incident, Priority } from "@/components/lesedi/data";
import { createStore } from "@/lib/store";

/**
 * What is wrong, in the resident's own words. It doubles as the scope of the fault: a home outage is
 * fixed at one property (so the technician may need to be let in), the other two are shared network faults.
 */
export const outageTypes = ["Home outage", "Street or area outage", "Damaged equipment or hazard"] as const;
export type OutageType = (typeof outageTypes)[number];
export const HOME_OUTAGE: OutageType = "Home outage";
export const isHomeOutage = (report: { type: string }) => report.type === HOME_OUTAGE;

/** A citizen's outage report. Location and media travel with it to every dashboard. */
export type OutageReport = {
  id: string;
  createdAt: number;
  /** The resident's name from their account. The report form does not ask for it again. */
  reporter: string;
  address: string;
  /** A landmark or house number typed to help the crew find the spot. */
  landmark?: string | undefined;
  /** Prepaid meter number or municipal account number. Only asked for a home outage, and optional. */
  account?: string | undefined;
  /** The cell number the crew should call: the one on the resident's account unless they changed it. */
  contact: string;
  type: OutageType;
  /** The resident's optional note. */
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
export type JobUpdate = {
  stage: number;
  at: number;
  note?: string | undefined;
  /** A warning for the control centre, e.g. the job moved on without the resident's PIN or confirmation. */
  flag?: string | undefined;
  /** Who caused the update. Missing on older saved jobs, which were all the technician's. */
  actor?: "control" | "technician" | "resident" | undefined;
};
/** GPS proof that the technician reached the reported location. */
export type Arrival = { at: number; distanceM: number };
/** The one-time PIN a resident gives the technician at the door of a home outage. See `visit.ts`. */
export type VisitPin = { code: string; issuedAt: number; expiresAt: number; attempts: number; issued: number; lockedAt?: number | undefined; usedAt?: number | undefined };
/** The technician says the repair is done. On a home outage the resident then confirms the power is back. */
export type CompletionCheck = { requestedAt: number; answer?: "yes" | "no" | undefined; answeredAt?: number | undefined };
export type Dispatch = { tech: string; at: number; stage?: number; updates?: JobUpdate[]; arrival?: Arrival; pin?: VisitPin; completion?: CompletionCheck };
export type CrewLocation = { lat: number; lng: number; accuracy: number; at: number };

export const reportStore = createStore<OutageReport[]>("lesedilink.reports", []);
/** What is remembered on the resident's device between reports: a changed contact number and the meter or account number. */
export type CustomerProfile = { phone: string; account: string };
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
  dispatchStore.set({ ...dispatchStore.get(), [id]: { tech, at, stage: -1, updates: [{ stage: -1, at, note: `Assigned to ${tech} by the control centre`, actor: "control" }] } });
}

/** A progress update. It is stored once and read by the customer, technician, dispatcher and manager dashboards. */
export function updateJob(id: string, stage: number, note?: string, flag?: string, actor: NonNullable<JobUpdate["actor"]> = "technician") {
  const all = dispatchStore.get();
  const current = all[id];
  if (!current) return;
  const update: JobUpdate = { stage, at: Date.now(), actor, ...(note ? { note } : {}), ...(flag ? { flag } : {}) };
  dispatchStore.set({ ...all, [id]: { ...current, stage, updates: [...(current.updates ?? []), update] } });
}

/** Change fields of a dispatch without adding a progress update (the visit PIN, the completion check). */
export function patchDispatch(id: string, patch: Partial<Dispatch>) {
  const all = dispatchStore.get();
  const current = all[id];
  if (!current) return;
  dispatchStore.set({ ...all, [id]: { ...current, ...patch } });
}

export function nextReportId() {
  const highest = reportStore.get().reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, ""))), 4829);
  return `#LL-${highest + 1}`;
}

export function addReport(report: OutageReport) {
  reportStore.set([report, ...reportStore.get()]);
}

const priorityByType: Record<OutageType, Priority> = { "Home outage": "Medium", "Street or area outage": "High", "Damaged equipment or hazard": "High" };

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
    detail: report.description ? `${report.type} · ${report.description}` : report.type,
    // Reports saved before the outage types changed keep their old type text, so fall back to Medium.
    priority: escalate(priorityByType[report.type] ?? "Medium", affected),
    people: `${affected} affected · ${linked + 1} report${linked === 0 ? "" : "s"}${followers > 0 ? ` · ${followers} following` : ""}`,
    age: ago(report.createdAt),
    lat: report.lat,
    lng: report.lng,
    source: "citizen",
  };
}

export const osmLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
export const directionsLink = (lat: number, lng: number) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${lat}%2C${lng}`;
