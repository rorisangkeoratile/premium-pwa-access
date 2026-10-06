import type { Priority } from "@/components/lesedi/data";
import { distanceKm } from "@/lib/geo";
import { ERT_RESPONSE_MS, currentErt, nextReportDue, phaseRecord, reportingRecord } from "@/lib/ert";
import type { Feedback } from "@/lib/feedback";
import { followerCount, resolvedAt } from "@/lib/incidents";
import { areas, type AreaDef, type AutoTicket } from "@/lib/nodes";
import { STAGE, isHomeOutage, isResolved, toIncident, type Dispatch, type OutageReport } from "@/lib/reports";

/** A crew should be on site within the expected response time (ERT) of an outage being logged. */
export const SLA_RESPONSE_MS = ERT_RESPONSE_MS;

const firstAt = (dispatch: Dispatch | undefined, stage: number) => dispatch?.updates?.find((update) => update.stage === stage)?.at;
const flagCount = (dispatch: Dispatch | undefined) => dispatch?.updates?.filter((update) => update.flag).length ?? 0;

/** The sensor-network area a point belongs to, if it is within 8 km of one. */
export function nearestArea(point: { lat: number; lng: number }): AreaDef | undefined {
  let best: AreaDef | undefined;
  let bestKm = 8;
  for (const area of areas) {
    const km = distanceKm(point, area);
    if (km <= bestKm) {
      best = area;
      bestKm = km;
    }
  }
  return best;
}

/** One line per incident (duplicates are merged into their master), open or closed. */
export type IncidentRow = {
  id: string;
  source: "citizen" | "auto";
  home: boolean;
  place: string;
  priority: Priority;
  openedAt: number;
  /** When a technician reached the site. */
  respondedAt?: number | undefined;
  closedAt?: number | undefined;
  tech?: string | undefined;
  affected: number;
  areaId?: string | undefined;
  flags: number;
  /** -2 before a crew is assigned, then the technician's stage. */
  stage: number;
  /** The ERT in force while the incident is open. */
  ertDue?: number | undefined;
  /** When the technician's next status report is due, while the job is open. */
  reportDue?: number | undefined;
  reportsOnTime: number;
  reportsLate: number;
  phasesMet: number;
  phasesMissed: number;
  extensions: number;
  /** Residents' feedback on this incident (their own and merged reports). */
  ratings: number[];
};

function timing(dispatch: Dispatch | undefined, openedAt: number, open: boolean, now: number) {
  const reporting = reportingRecord(dispatch, now);
  const phases = phaseRecord(dispatch, now);
  return {
    stage: dispatch ? (dispatch.stage ?? STAGE.assigned) : -2,
    ...(open ? { ertDue: currentErt(openedAt, dispatch), reportDue: nextReportDue(dispatch) } : {}),
    reportsOnTime: reporting.onTime,
    reportsLate: reporting.late,
    phasesMet: phases.met,
    phasesMissed: phases.missed,
    extensions: phases.extended,
  };
}

export function incidentRows(reports: OutageReport[], tickets: AutoTicket[], dispatches: Record<string, Dispatch>, follows: Record<string, string[]>, feedback: Record<string, Feedback> = {}, now = Date.now()): IncidentRow[] {
  const ratingsFor = (id: string) => Object.values(feedback).filter((item) => item.incidentId === id).map((item) => item.rating);
  const fromReports = reports
    .filter((report) => !report.duplicateOf)
    .map((report): IncidentRow => {
      const dispatch = dispatches[report.id];
      const linked = reports.filter((other) => other.duplicateOf === report.id).length;
      const followers = followerCount(report.id, follows);
      const closedAt = isResolved(dispatch?.stage) ? resolvedAt(dispatch) : undefined;
      return {
        id: report.id,
        source: "citizen",
        home: isHomeOutage(report),
        place: report.address || "Outage location",
        priority: toIncident(report, linked, followers).priority,
        openedAt: report.createdAt,
        respondedAt: firstAt(dispatch, STAGE.onSite),
        closedAt,
        tech: dispatch?.tech,
        affected: 1 + linked + followers,
        areaId: nearestArea(report)?.id,
        flags: flagCount(dispatch),
        ...timing(dispatch, report.createdAt, closedAt === undefined, now),
        ratings: ratingsFor(report.id),
      };
    });

  const fromTickets = tickets.map((ticket): IncidentRow => {
    const dispatch = dispatches[ticket.id];
    const closedAt = ticket.restoredAt ?? (isResolved(dispatch?.stage) ? resolvedAt(dispatch) : undefined);
    return {
      id: ticket.id,
      source: "auto",
      home: false,
      place: ticket.areaName,
      priority: ticket.priority,
      openedAt: ticket.openedAt,
      respondedAt: firstAt(dispatch, STAGE.onSite),
      closedAt,
      tech: dispatch?.tech,
      affected: areas.find((area) => area.id === ticket.areaId)?.people ?? 0,
      areaId: ticket.areaId,
      flags: flagCount(dispatch),
      ...timing(dispatch, ticket.openedAt, closedAt === undefined, now),
      ratings: ratingsFor(ticket.id),
    };
  });

  return [...fromTickets, ...fromReports].sort((a, b) => b.openedAt - a.openedAt);
}

export type Summary = {
  open: number;
  openedToday: number;
  /** Residents without power in the open incidents (an estimate for sensor-detected outages). */
  affected: number;
  responded: number;
  resolved: number;
  avgResponseMs?: number | undefined;
  avgResolutionMs?: number | undefined;
  /** Share of incidents where the crew reached the site within the 2-hour ERT. */
  slaPct?: number | undefined;
  flagged: number;
  /** Open incidents past their ERT, and open jobs whose technician's status report is overdue. */
  ertOverdue: number;
  reportsOverdue: number;
  awaitingParts: number;
  /** Share of parts and repair deadlines met (measured on the deadline first given). */
  phasePct?: number | undefined;
  extensions: number;
  /** Share of 30-minute (or phase) status reports that arrived on time. */
  reportsPct?: number | undefined;
  /** Average resident rating out of 5, and how many residents rated. */
  avgRating?: number | undefined;
  ratings: number;
  /** Share of ratings of 4 or 5. */
  satisfiedPct?: number | undefined;
};

const average = (values: number[]) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined);

export function summarise(rows: IncidentRow[], now = Date.now()): Summary {
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const open = rows.filter((row) => row.closedAt === undefined);
  const responded = rows.filter((row) => row.respondedAt !== undefined);
  const resolved = rows.filter((row) => row.closedAt !== undefined);
  // An open incident with no crew on site past its 2-hour ERT has already missed it, so it counts against compliance.
  const missedOpen = open.filter((row) => row.respondedAt === undefined && now - row.openedAt > SLA_RESPONSE_MS).length;
  const met = responded.filter((row) => (row.respondedAt ?? 0) - row.openedAt <= SLA_RESPONSE_MS).length;
  const measured = responded.length + missedOpen;
  const phasesMet = rows.reduce((sum, row) => sum + row.phasesMet, 0);
  const phasesAll = phasesMet + rows.reduce((sum, row) => sum + row.phasesMissed, 0);
  const reportsOnTime = rows.reduce((sum, row) => sum + row.reportsOnTime, 0);
  const reportsAll = reportsOnTime + rows.reduce((sum, row) => sum + row.reportsLate, 0);
  const ratings = rows.flatMap((row) => row.ratings);
  return {
    open: open.length,
    openedToday: rows.filter((row) => row.openedAt >= startOfDay).length,
    affected: open.reduce((sum, row) => sum + row.affected, 0),
    responded: responded.length,
    resolved: resolved.length,
    avgResponseMs: average(responded.map((row) => (row.respondedAt ?? 0) - row.openedAt)),
    avgResolutionMs: average(resolved.map((row) => (row.closedAt ?? 0) - row.openedAt)),
    slaPct: measured > 0 ? Math.round((100 * met) / measured) : undefined,
    flagged: rows.reduce((sum, row) => sum + row.flags, 0),
    ertOverdue: open.filter((row) => row.ertDue !== undefined && now > row.ertDue).length,
    reportsOverdue: open.filter((row) => row.reportDue !== undefined && now > row.reportDue).length,
    awaitingParts: open.filter((row) => row.stage === STAGE.awaitingParts).length,
    phasePct: phasesAll > 0 ? Math.round((100 * phasesMet) / phasesAll) : undefined,
    extensions: rows.reduce((sum, row) => sum + row.extensions, 0),
    reportsPct: reportsAll > 0 ? Math.round((100 * reportsOnTime) / reportsAll) : undefined,
    avgRating: ratings.length > 0 ? Math.round((10 * ratings.reduce((sum, value) => sum + value, 0)) / ratings.length) / 10 : undefined,
    ratings: ratings.length,
    satisfiedPct: ratings.length > 0 ? Math.round((100 * ratings.filter((value) => value >= 4).length) / ratings.length) : undefined,
  };
}

/** "42 s", "3 min 05 s", "18 min", "1 h 05". A dash when there is nothing to average yet. */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "—";
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 10) return `${minutes} min ${String(seconds % 60).padStart(2, "0")} s`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** A job dispatched to a technician, with the incident it belongs to. */
export type Job = { id: string; report?: OutageReport; ticket?: AutoTicket; dispatch: Dispatch };

/**
 * A technician's jobs. `open` are the ones still to do (oldest assignment first); `done` are finished.
 * A job whose outage the sensors already closed is neither: there is nothing left to do.
 */
export function jobsFor(name: string, reports: OutageReport[], tickets: AutoTicket[], dispatches: Record<string, Dispatch>): { open: Job[]; done: Job[] } {
  const open: Job[] = [];
  const done: Job[] = [];
  for (const ticket of tickets) {
    const dispatch = dispatches[ticket.id];
    if (dispatch?.tech !== name) continue;
    if (isResolved(dispatch.stage)) done.push({ id: ticket.id, ticket, dispatch });
    else if (!ticket.restoredAt) open.push({ id: ticket.id, ticket, dispatch });
  }
  for (const report of reports) {
    const dispatch = dispatches[report.id];
    if (report.duplicateOf || dispatch?.tech !== name) continue;
    if (isResolved(dispatch.stage)) done.push({ id: report.id, report, dispatch });
    else open.push({ id: report.id, report, dispatch });
  }
  open.sort((a, b) => a.dispatch.at - b.dispatch.at);
  return { open, done };
}

export type CrewStatus = { status: "Available" | "On job"; job?: Job };

export function crewStatus(name: string, reports: OutageReport[], tickets: AutoTicket[], dispatches: Record<string, Dispatch>): CrewStatus {
  const job = jobsFor(name, reports, tickets, dispatches).open[0];
  return job ? { status: "On job", job } : { status: "Available" };
}
