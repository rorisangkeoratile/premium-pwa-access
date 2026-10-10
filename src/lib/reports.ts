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

/**
 * What exactly is wrong, picked from a list instead of typed, so every report reads the same way to the
 * control centre and two reports of the same problem can be recognised as duplicates. Only "Something else"
 * asks for a short note.
 */
export const OTHER_COMPLAINT = "Something else";
export const OTHER_NOTE_MAX = 100;
export const complaintsByType: Record<OutageType, readonly string[]> = {
  "Home outage": [
    "No power in the whole house",
    "Some plugs or rooms have no power",
    "Prepaid meter shows an error or rejects tokens",
    "Main switch keeps tripping",
    "Lights dim or flicker",
    OTHER_COMPLAINT,
  ],
  "Street or area outage": [
    "The whole street has no power",
    "Several houses have no power",
    "Power keeps going off and on",
    "Low voltage: lights dim and appliances struggle",
    "Streetlights are off",
    OTHER_COMPLAINT,
  ],
  "Damaged equipment or hazard": [
    "Fallen or low-hanging power line",
    "Sparks, fire or smoke from equipment",
    "Damaged or leaning pole",
    "Mini-substation or meter box open or damaged",
    "Exposed or stolen cables",
    "Loud bang from a transformer",
    OTHER_COMPLAINT,
  ],
};

/**
 * Complaints that are the same fault seen from different houses. Neighbours on one feeder describe one fault
 * in different words ("the whole street" from one house, "several houses" from another), so for duplicates
 * these count as the same complaint. A complaint not listed here only matches itself.
 */
const faultGroups: Record<string, string> = {
  "The whole street has no power": "no supply",
  "Several houses have no power": "no supply",
  "Power keeps going off and on": "unstable supply",
  "Low voltage: lights dim and appliances struggle": "unstable supply",
  "Sparks, fire or smoke from equipment": "equipment failing",
  "Loud bang from a transformer": "equipment failing",
};
export const faultOf = (complaint: string) => faultGroups[complaint] ?? complaint;

/** The complaint in words: the chosen item, or the resident's short note for "Something else". Older reports only have the note. */
export const complaintText = (report: Pick<OutageReport, "complaint" | "description">) =>
  !report.complaint ? report.description : report.complaint === OTHER_COMPLAINT ? report.description || OTHER_COMPLAINT : report.complaint;

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
  /** The problem picked from `complaintsByType`. Missing on reports saved before the list existed. */
  complaint?: string | undefined;
  /** The resident's short note, only asked for when the complaint is "Something else". */
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

/**
 * Technician progress stages, in order. A dispatch that has not been accepted yet has stage -1.
 * "Awaiting parts" is optional: a job goes from "On site" either to it or straight to "Repairs in progress".
 * A job is finished for the technician at "Resolved"; it is "Closed" once the resident has given feedback
 * or the control centre closes it.
 */
export const stageNames = ["Accepted", "En route", "On site", "Awaiting parts", "Repairs in progress", "Testing", "Resolved", "Closed"] as const;
export const STAGE = { assigned: -1, accepted: 0, enRoute: 1, onSite: 2, awaitingParts: 3, repairing: 4, testing: 5, resolved: 6, closed: 7 } as const;
/** The fault is fixed: the power is back, whether or not the incident has been closed yet. */
export const isResolved = (stage: number | undefined) => (stage ?? -1) >= STAGE.resolved;
export type JobUpdate = {
  stage: number;
  at: number;
  /** The expected response time (ERT) set with this update: when the current phase should be finished. See `ert.ts`. */
  ertDue?: number | undefined;
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

// v2: the stages were renumbered when "Awaiting parts", "Testing", "Resolved" and "Closed" were added.
export const dispatchStore = createStore<Record<string, Dispatch>>("lesedilink.dispatches.v2", {});
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

/** A technician turned a job down before accepting it. The job goes back to the control centre's queue. */
export type JobDecline = { tech: string; at: number; reason: string };
/** Declines per incident id, oldest first. Kept after the job is reassigned, so the control centre sees the history. */
export const declineStore = createStore<Record<string, JobDecline[]>>("lesedilink.declines", {});
export const DECLINE_REASONS = [
  "Already busy on another job",
  "Too far away to get there in time",
  "Vehicle or equipment problem",
  "Not qualified for this type of fault",
  "End of shift",
  "Unsafe to attend right now",
] as const;

/**
 * Why a technician cannot answer a job any more, or null if they can. The dispatcher works in another tab, so
 * the job may have been withdrawn or reassigned since the technician's screen last showed it.
 */
function answerProblem(id: string, tech: string): string | null {
  const dispatch = dispatchStore.get()[id];
  if (!dispatch) return "This job is no longer assigned to you. The control centre may have withdrawn it.";
  if (dispatch.tech !== tech) return `The control centre has reassigned this job to ${dispatch.tech}.`;
  if ((dispatch.stage ?? STAGE.assigned) !== STAGE.assigned) return "You have already accepted this job.";
  return null;
}

/** The technician accepts a job assigned to them. Returns an error message when it can no longer be accepted. */
export function acceptJob(id: string, tech: string, note?: string): string | null {
  const problem = answerProblem(id, tech);
  if (problem) return problem;
  updateJob(id, STAGE.accepted, note || "Accepted the job");
  return null;
}

/**
 * The technician turns a job down, with a reason. The dispatch is withdrawn so the incident is back in the
 * queue for another crew. Returns an error message when the job can no longer be declined.
 */
export function declineJob(id: string, tech: string, reason: string): string | null {
  if (!reason.trim()) return "Choose a reason, so the control centre knows who to send instead.";
  const problem = answerProblem(id, tech);
  if (problem) return problem;
  const { [id]: _declined, ...rest } = dispatchStore.get();
  dispatchStore.set(rest);
  const declines = declineStore.get();
  declineStore.set({ ...declines, [id]: [...(declines[id] ?? []), { tech, at: Date.now(), reason: reason.trim() }] });
  return null;
}

/** A progress update. It is stored once and read by the customer, technician, dispatcher and manager dashboards. */
export function updateJob(id: string, stage: number, note?: string, flag?: string, actor: NonNullable<JobUpdate["actor"]> = "technician", ertDue?: number) {
  const all = dispatchStore.get();
  const current = all[id];
  if (!current) return;
  const update: JobUpdate = { stage, at: Date.now(), actor, ...(note ? { note } : {}), ...(flag ? { flag } : {}), ...(ertDue ? { ertDue } : {}) };
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
    place: report.address || "Outage location",
    detail: complaintText(report) ? `${report.type} · ${complaintText(report)}` : report.type,
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
