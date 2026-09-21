import { followStore } from "@/lib/incidents";
import { controlStore, cutPower, resetEngine, statusStore, ticketStore } from "@/lib/nodes";
import { noticeSeenStore } from "@/lib/notifications";
import { crewStore, dispatchStore, reportStore } from "@/lib/reports";

/**
 * Wipes everything the simulation produced (reports, jobs, sensor tickets, follows, crew positions and alert
 * read-marks) in every open tab, so a presentation can start from a quiet city. Accounts, sign-ups and each
 * resident's saved meter number are kept.
 */
export function resetSimulation() {
  reportStore.reset();
  dispatchStore.reset();
  crewStore.reset();
  followStore.reset();
  ticketStore.reset();
  controlStore.reset();
  statusStore.reset();
  noticeSeenStore.reset();
  resetEngine();
}

/** A storm knocks out three areas at once. The sensors notice on their own, a few seconds later. */
export const STORM_AREAS = ["soshanguve", "cbd", "hatfield"] as const;

export function stormScenario() {
  for (const areaId of STORM_AREAS) cutPower(areaId);
}
