import { technicians } from "@/components/lesedi/data";
import { isResolved, type CrewLocation, type Dispatch } from "@/lib/reports";
import { createStore } from "@/lib/store";

/*
 * Additional crew. A technician on a job asks for help; every other technician is alerted and can accept or
 * decline. Those who accept get directions and an ETA to the job, and the requester and the control centre see
 * who is coming. A request ends when the requester cancels it or the job is resolved.
 */

/** Why more crew is needed, picked from a list so the alert is short and clear. */
export const CREW_REASONS = [
  "The fault is bigger than expected",
  "Heavy lifting or more equipment needed",
  "Safety: a second person must be present",
  "Specialist skills needed",
  "Traffic or crowd control needed",
] as const;
export const MAX_CREW = 3;

export type CrewResponse = { answer: "accepted" | "declined"; at: number; arrivedAt?: number | undefined; distanceM?: number | undefined; leftAt?: number | undefined };
export type CrewRequest = {
  id: string;
  jobId: string;
  /** The technician asking for help. */
  by: string;
  at: number;
  reason: string;
  /** How many extra technicians are needed. */
  needed: number;
  /** Answers, keyed by technician name. */
  responses: Record<string, CrewResponse>;
  /** Cancelled by the requester. */
  closedAt?: number | undefined;
};

export const crewRequestStore = createStore<Record<string, CrewRequest>>("lesedilink.crew-requests", {});

/** A crew position older than this is stale, so the depot is used instead. */
const FRESH_GPS_MS = 2 * 60 * 1000;

/** Where a technician is: their live GPS while it is fresh, otherwise their depot. */
export function crewPosition(name: string, live: Record<string, CrewLocation>, now = Date.now()): { lat: number; lng: number } | null {
  const fix = live[name];
  if (fix && now - fix.at < FRESH_GPS_MS) return { lat: fix.lat, lng: fix.lng };
  const base = technicians.find((tech) => tech.name === name);
  return base ? { lat: base.lat, lng: base.lng } : null;
}

/** Technicians who accepted and have not left. */
export const helpersOf = (request: CrewRequest) =>
  Object.entries(request.responses).filter(([, response]) => response.answer === "accepted" && !response.leftAt).map(([name, response]) => ({ name, ...response }));
export const declinedBy = (request: CrewRequest) => Object.entries(request.responses).filter(([, response]) => response.answer === "declined").map(([name]) => name);
export const isFilled = (request: CrewRequest) => helpersOf(request).length >= request.needed;
/** Still live: not cancelled, and the job it is for is still being worked. */
export const isOpen = (request: CrewRequest, dispatches: Record<string, Dispatch>) => !request.closedAt && Boolean(dispatches[request.jobId]) && !isResolved(dispatches[request.jobId]?.stage);

export const openRequestFor = (jobId: string, requests: Record<string, CrewRequest>, dispatches: Record<string, Dispatch>) =>
  Object.values(requests).filter((request) => request.jobId === jobId && isOpen(request, dispatches)).sort((a, b) => b.at - a.at)[0];

/** Requests waiting for this technician's answer, oldest first. */
export const pendingFor = (name: string, requests: Record<string, CrewRequest>, dispatches: Record<string, Dispatch>) =>
  Object.values(requests)
    .filter((request) => request.by !== name && !request.responses[name] && isOpen(request, dispatches) && !isFilled(request))
    .sort((a, b) => a.at - b.at);

/** Jobs this technician agreed to help with and is still helping on. */
export const supportingFor = (name: string, requests: Record<string, CrewRequest>, dispatches: Record<string, Dispatch>) =>
  Object.values(requests)
    .filter((request) => request.responses[name]?.answer === "accepted" && !request.responses[name]?.leftAt && isOpen(request, dispatches))
    .sort((a, b) => a.at - b.at);

function patch(id: string, change: (request: CrewRequest) => CrewRequest | null) {
  const all = crewRequestStore.get();
  const current = all[id];
  if (!current) return false;
  const next = change(current);
  if (!next) return false;
  crewRequestStore.set({ ...all, [id]: next });
  return true;
}

export function requestCrew(jobId: string, by: string, reason: string, needed: number) {
  const at = Date.now();
  const id = `CR-${at.toString(36).toUpperCase()}`;
  crewRequestStore.set({ ...crewRequestStore.get(), [id]: { id, jobId, by, at, reason, needed: Math.min(MAX_CREW, Math.max(1, needed)), responses: {} } });
}

/** Accept or decline. Refused (false) once the request is full or ended, or if this technician already answered. */
export function respondToCrew(id: string, tech: string, answer: CrewResponse["answer"]) {
  return patch(id, (request) => {
    if (request.closedAt || request.by === tech || request.responses[tech]) return null;
    if (answer === "accepted" && isFilled(request)) return null;
    return { ...request, responses: { ...request.responses, [tech]: { answer, at: Date.now() } } };
  });
}

/** The helper reached the job. `distanceM` is -1 when it was confirmed without GPS. */
export function crewArrived(id: string, tech: string, distanceM: number) {
  patch(id, (request) => {
    const response = request.responses[tech];
    if (response?.answer !== "accepted" || response.arrivedAt) return null;
    return { ...request, responses: { ...request.responses, [tech]: { ...response, arrivedAt: Date.now(), distanceM } } };
  });
}

/** The helper can no longer help. Their place opens up again for someone else. */
export function leaveCrew(id: string, tech: string) {
  patch(id, (request) => {
    const response = request.responses[tech];
    if (response?.answer !== "accepted" || response.leftAt) return null;
    return { ...request, responses: { ...request.responses, [tech]: { ...response, leftAt: Date.now() } } };
  });
}

export function cancelCrewRequest(id: string) {
  patch(id, (request) => (request.closedAt ? null : { ...request, closedAt: Date.now() }));
}
