import { distanceKm, type GeoFix } from "@/lib/geo";
import { dispatchStore, patchDispatch, updateJob, type Dispatch, type VisitPin } from "@/lib/reports";

/*
 * Arrival and the Visit PIN.
 *
 * Every job: "On site" is only reachable when the technician's phone GPS puts them at the reported
 * location, so a job cannot be marked as visited from the couch.
 *
 * Home outages (a fault at one property) add a handshake with the resident, in both directions:
 *  - Arrival: the technician taps "I've arrived", the resident's app shows a 6-digit Visit PIN, the
 *    resident reads it out at the gate and the technician types it in. That proves the resident let them in.
 *  - Completion: the technician says the repair is done and the resident taps "Yes, my power is back".
 *    A tap is used instead of a second PIN because it also proves the fault is fixed, and "No" reopens the job.
 * If the resident cannot take part (nobody home, phone flat), the technician can carry on with a reason
 * and the step is flagged for the control centre.
 *
 * Prototype: the PIN lives in localStorage so the two demo tabs can both see it. In production it is
 * created and checked on the server, sent to the resident's app or SMS, and never reaches the technician's device.
 */

/**
 * How close the technician's phone must be to the reported spot. Phone GPS is usually within 10–30 m
 * outdoors, so 150 m leaves room for a long driveway or a big yard.
 */
export const ARRIVAL_RADIUS_M = 150;
/** A sensor-detected outage only has an area centre, not a house, so the technician just has to be in the area. */
export const AREA_ARRIVAL_RADIUS_M = 1000;
/** A fix vaguer than this proves nothing (common indoors or under heavy cloud). */
export const MAX_FIX_ACCURACY_M = 100;

export type ArrivalCheck =
  | { status: "ok"; distanceM: number }
  | { status: "far"; distanceM: number }
  | { status: "weak"; accuracy: number }
  | { status: "nofix" };

export function checkArrival(fix: GeoFix | null, target: { lat: number; lng: number }, radiusM: number): ArrivalCheck {
  if (!fix) return { status: "nofix" };
  const distanceM = Math.round(distanceKm(fix, target) * 1000);
  // Clearly somewhere else, whatever the GPS error.
  if (distanceM > radiusM + fix.accuracy) return { status: "far", distanceM };
  if (fix.accuracy > MAX_FIX_ACCURACY_M) return { status: "weak", accuracy: Math.round(fix.accuracy) };
  return { status: distanceM <= radiusM ? "ok" : "far", distanceM };
}

export const formatDistance = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`);

export function arrivalProblem(check: Exclude<ArrivalCheck, { status: "ok" }>, radiusM: number): string {
  if (check.status === "nofix") return "Your phone has not given a GPS position yet. Allow location access and try again.";
  if (check.status === "weak") return `Your GPS signal is too weak (about ±${check.accuracy} m). Step outside, away from buildings, and try again.`;
  return `You are about ${formatDistance(check.distanceM)} from the reported location. Get within ${formatDistance(radiusM)} and try again.`;
}

export const VISIT_PIN_LENGTH = 6;
export const VISIT_PIN_TTL_MS = 30 * 60 * 1000;
export const VISIT_PIN_MAX_ATTEMPTS = 3;
/** A PIN can be sent again when it expires or locks, but only this many times per job. */
export const VISIT_PIN_MAX_ISSUES = 3;

/** Why a technician may carry on without the resident. Each one is flagged for the control centre. */
export const OVERRIDE_REASONS = ["Nobody answered at the gate", "The resident's phone is off, flat or has no signal", "The work is outside the property", "Other (explained in the work notes)"] as const;

/** Why a technician may confirm arrival without a GPS check. Each one is flagged for the control centre. */
export const ARRIVAL_OVERRIDE_REASONS = ["My phone has no GPS signal here", "GPS is putting me in the wrong place", "I am working from a laptop (demo)", "Other (explained in the work notes)"] as const;

const joinNotes = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");

function randomPin() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0]! % 10 ** VISIT_PIN_LENGTH).padStart(VISIT_PIN_LENGTH, "0");
}

export type PinState = "none" | "active" | "expired" | "locked" | "used";

export function pinState(pin: VisitPin | undefined, now = Date.now()): PinState {
  if (!pin) return "none";
  if (pin.usedAt) return "used";
  if (pin.lockedAt) return "locked";
  return now > pin.expiresAt ? "expired" : "active";
}

export const canSendAnotherPin = (pin: VisitPin | undefined) => (pin?.issued ?? 0) < VISIT_PIN_MAX_ISSUES;
export const formatPin = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** Create a fresh PIN for the resident. Returns false when the job is unknown or the re-send limit is used up. */
export function issueVisitPin(id: string): boolean {
  const job = dispatchStore.get()[id];
  if (!job || !canSendAnotherPin(job.pin)) return false;
  const now = Date.now();
  patchDispatch(id, { pin: { code: randomPin(), issuedAt: now, expiresAt: now + VISIT_PIN_TTL_MS, attempts: 0, issued: (job.pin?.issued ?? 0) + 1 } });
  return true;
}

/** The technician's GPS placed them at the job. A home outage now waits for the resident's PIN; any other job goes straight to "On site". */
export function recordArrival(id: string, distanceM: number, needsEntry: boolean, note?: string) {
  patchDispatch(id, { arrival: { at: Date.now(), distanceM } });
  if (needsEntry) {
    issueVisitPin(id);
    return;
  }
  updateJob(id, 2, joinNotes(`Arrived. GPS puts the technician ${formatDistance(distanceM)} from the reported location.`, note));
}

/**
 * Arrival without a usable GPS reading. The job carries on and the step is flagged, because the phone's
 * position could not back it up. A home outage still asks the resident for their Visit PIN afterwards,
 * so the resident's own confirmation is never skipped by this.
 */
export function recordManualArrival(id: string, needsEntry: boolean, reason: string, note?: string) {
  patchDispatch(id, { arrival: { at: Date.now(), distanceM: -1 } });
  if (needsEntry) {
    issueVisitPin(id);
    return;
  }
  updateJob(id, 2, joinNotes(`Arrived. Confirmed by the technician without a GPS check: ${reason}.`, note), "Arrival not confirmed by GPS");
}

export type PinResult = { status: "ok" } | { status: "wrong"; attemptsLeft: number } | { status: "locked" } | { status: "expired" } | { status: "none" };

/** Check the PIN the resident read out. Three wrong tries lock it; a correct one is used up and moves the job to "On site". */
export function verifyVisitPin(id: string, code: string, note?: string): PinResult {
  const job = dispatchStore.get()[id];
  const pin = job?.pin;
  const state = pinState(pin);
  if (!job || !pin || state === "none" || state === "used") return { status: "none" };
  if (state === "locked") return { status: "locked" };
  if (state === "expired") return { status: "expired" };
  if (code !== pin.code) {
    const attempts = pin.attempts + 1;
    if (attempts >= VISIT_PIN_MAX_ATTEMPTS) {
      patchDispatch(id, { pin: { ...pin, attempts, lockedAt: Date.now() } });
      return { status: "locked" };
    }
    patchDispatch(id, { pin: { ...pin, attempts } });
    return { status: "wrong", attemptsLeft: VISIT_PIN_MAX_ATTEMPTS - attempts };
  }
  patchDispatch(id, { pin: { ...pin, usedAt: Date.now() } });
  const gps = job.arrival && job.arrival.distanceM >= 0 ? `GPS puts the technician ${formatDistance(job.arrival.distanceM)} from the reported location.` : undefined;
  updateJob(id, 2, joinNotes("Arrival confirmed with the resident's Visit PIN.", gps, note));
  return { status: "ok" };
}

/** The resident cannot give the PIN. The job carries on, flagged, and the PIN stops working. */
export function startWithoutPin(id: string, reason: string, note?: string) {
  const pin = dispatchStore.get()[id]?.pin;
  if (pin && !pin.usedAt) patchDispatch(id, { pin: { ...pin, usedAt: Date.now() } });
  updateJob(id, 2, joinNotes(`Started without the resident's PIN: ${reason}.`, note), "Started without the resident's PIN");
}

/** Home outage: the technician says the repair is done and asks the resident to confirm the power is back. */
export function requestCompletion(id: string) {
  patchDispatch(id, { completion: { requestedAt: Date.now() } });
}

/** The resident's answer. "Yes" completes the job; "No" leaves it in progress and flags it. */
export function answerCompletion(id: string, answer: "yes" | "no") {
  const job = dispatchStore.get()[id];
  const completion = job?.completion;
  if (!job || !completion || completion.answer || (job.stage ?? -1) !== 3) return;
  patchDispatch(id, { completion: { ...completion, answer, answeredAt: Date.now() } });
  if (answer === "yes") updateJob(id, 4, "The resident confirmed the power is back on.", undefined, "resident");
  else updateJob(id, 3, "The resident says the power is still off.", "Resident says the power is still off", "resident");
}

/** The resident cannot confirm. The job is closed with a reason, flagged for the control centre to follow up. */
export function completeWithoutConfirmation(id: string, reason: string, note?: string) {
  updateJob(id, 4, joinNotes(`Closed without the resident's confirmation: ${reason}.`, note), "Closed without the resident's confirmation");
}

/** One line on where the resident handshake stands, for the control centre. Null when there is nothing waiting. */
export function visitStatus(dispatch: Dispatch): string | null {
  const stage = dispatch.stage ?? -1;
  if (stage === 1 && dispatch.arrival) {
    const state = pinState(dispatch.pin);
    if (state === "active") return "At the property · waiting for the resident's Visit PIN";
    if (state === "locked" || state === "expired") return `Visit PIN ${state} · the technician can send a new one`;
  }
  if (stage === 3 && dispatch.completion) {
    if (!dispatch.completion.answer) return "Repair finished · waiting for the resident to confirm the power is back";
    if (dispatch.completion.answer === "no") return "The resident says the power is still off";
  }
  return null;
}
