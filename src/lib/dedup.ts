import { distanceKm } from "@/lib/geo";
import type { AutoTicket } from "@/lib/nodes";
import { OTHER_COMPLAINT, faultOf, isHomeOutage, isResolved, type Dispatch, type OutageReport, type OutageType } from "@/lib/reports";

/**
 * A new report of the same complaint (same type, and the same fault on the drop list) within this distance of
 * an open citizen report is treated as the same fault and merged into it.
 */
export const REPORT_RADIUS_KM = 1;

/** A new area outage report this close to an area's centre while a node-detected outage is open joins that outage. */
export const TICKET_RADIUS_KM = 3;

/** `complaint` is what the matched report said, which may be worded differently from the new one. */
export type DuplicateMatch = { id: string; kind: "report" | "auto"; label: string; complaint?: string | undefined };

/** The nearest open sensor-detected outage around a point, if any. */
export function nearbyTicket(point: { lat: number; lng: number }, tickets: AutoTicket[]): AutoTicket | undefined {
  return tickets.filter((item) => !item.restoredAt && distanceKm(point, item) <= TICKET_RADIUS_KM).sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0];
}

/**
 * Deduplication: before a report is stored, look for an open incident that already covers it.
 * Auto-detected outages take precedence (they cover a whole area); otherwise the nearest open citizen report
 * with the same complaint wins, preferring one worded exactly the same. Only master incidents are candidates,
 * so duplicates never chain onto each other.
 *
 * - "The same complaint" means the same fault: "the whole street has no power" and "several houses have no
 *   power" are one fault reported from different houses (see `faultOf`).
 * - A home outage is a fault at one property ("neighbours still have power"), so it is never merged and never
 *   becomes the master that other reports merge into.
 * - A sensor outage only stands in for "my street or area has no power". Damage and hazards are reported on
 *   their own, because the crew needs to know about them (see `nearbyTicket` for linking them).
 * - "Something else" is free text, so two of them are never assumed to be the same problem.
 *
 * Leave `type` and `complaint` out while the resident has not chosen yet: only a sensor outage can match then.
 */
export function findDuplicate(
  point: { lat: number; lng: number },
  reports: OutageReport[],
  tickets: AutoTicket[],
  dispatches: Record<string, Dispatch>,
  type?: OutageType | null,
  complaint?: string | null,
): DuplicateMatch | null {
  if (type && isHomeOutage({ type })) return null;

  if (!type || type === "Street or area outage") {
    const ticket = nearbyTicket(point, tickets);
    if (ticket) return { id: ticket.id, kind: "auto", label: `${ticket.areaName} outage detected by our sensors` };
  }

  if (!type || !complaint || complaint === OTHER_COMPLAINT) return null;
  const fault = faultOf(complaint);
  const report = reports
    .filter((item) => item.type === type && item.complaint && faultOf(item.complaint) === fault && !item.duplicateOf && !isResolved(dispatches[item.id]?.stage) && distanceKm(point, item) <= REPORT_RADIUS_KM)
    .sort((a, b) => Number(a.complaint !== complaint) - Number(b.complaint !== complaint) || distanceKm(point, a) - distanceKm(point, b))[0];
  if (report) return { id: report.id, kind: "report", label: `Report ${report.id} · ${report.complaint}`, complaint: report.complaint };

  return null;
}
