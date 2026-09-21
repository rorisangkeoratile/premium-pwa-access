import { distanceKm } from "@/lib/geo";
import type { AutoTicket } from "@/lib/nodes";
import type { Dispatch, OutageReport } from "@/lib/reports";

/**
 * A new report this close to an open citizen report is treated as the same fault.
 * 40 m is tuned for a live demonstration: two reports from the same street corner or the same house
 * merge, while a report a block away does not. A real deployment would widen it (around 150–250 m),
 * because phone GPS is often only accurate to 10–30 m outdoors and worse indoors.
 */
export const REPORT_RADIUS_KM = 0.04;

/** A new report this close to an area's centre while a node-detected outage is open joins that outage. */
export const TICKET_RADIUS_KM = 3;

export type DuplicateMatch = { id: string; kind: "report" | "auto"; label: string };

/**
 * Deduplication: before a report is stored, look for an open incident that already covers it.
 * Auto-detected outages take precedence (they cover a whole area); otherwise the nearest open citizen report wins.
 * Only master incidents are candidates, so duplicates never chain onto each other.
 */
export function findDuplicate(
  point: { lat: number; lng: number },
  reports: OutageReport[],
  tickets: AutoTicket[],
  dispatches: Record<string, Dispatch>,
): DuplicateMatch | null {
  const ticket = tickets
    .filter((item) => !item.restoredAt && distanceKm(point, item) <= TICKET_RADIUS_KM)
    .sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0];
  if (ticket) return { id: ticket.id, kind: "auto", label: `${ticket.areaName} outage detected by our sensors` };

  const report = reports
    .filter((item) => !item.duplicateOf && dispatches[item.id]?.stage !== 4 && distanceKm(point, item) <= REPORT_RADIUS_KM)
    .sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0];
  if (report) return { id: report.id, kind: "report", label: `Report ${report.id} nearby` };

  return null;
}
