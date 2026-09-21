import type { Priority } from "@/components/lesedi/data";
import { distanceKm } from "@/lib/geo";
import { followerCount } from "@/lib/incidents";
import { areas, type AreaDef, type AutoTicket } from "@/lib/nodes";
import { isHomeOutage, toIncident, type Dispatch, type OutageReport } from "@/lib/reports";

/** A crew should be on site within this long of an outage opening. */
export const SLA_RESPONSE_MS = 30 * 60 * 1000;

const firstAt = (dispatch: Dispatch | undefined, stage: number) => dispatch?.updates?.find((update) => update.stage === stage)?.at;
const lastAt = (dispatch: Dispatch | undefined, stage: number) => dispatch?.updates?.filter((update) => update.stage === stage).at(-1)?.at;
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
};

export function incidentRows(reports: OutageReport[], tickets: AutoTicket[], dispatches: Record<string, Dispatch>, follows: Record<string, string[]>): IncidentRow[] {
  const fromReports = reports
    .filter((report) => !report.duplicateOf)
    .map((report): IncidentRow => {
      const dispatch = dispatches[report.id];
      const linked = reports.filter((other) => other.duplicateOf === report.id).length;
      const followers = followerCount(report.id, follows);
      return {
        id: report.id,
        source: "citizen",
        home: isHomeOutage(report),
        place: report.address || "Pinned location",
        priority: toIncident(report, linked, followers).priority,
        openedAt: report.createdAt,
        respondedAt: firstAt(dispatch, 2),
        closedAt: dispatch?.stage === 4 ? (lastAt(dispatch, 4) ?? dispatch.at) : undefined,
        tech: dispatch?.tech,
        affected: 1 + linked + followers,
        areaId: nearestArea(report)?.id,
        flags: flagCount(dispatch),
      };
    });

  const fromTickets = tickets.map((ticket): IncidentRow => {
    const dispatch = dispatches[ticket.id];
    return {
      id: ticket.id,
      source: "auto",
      home: false,
      place: ticket.areaName,
      priority: ticket.priority,
      openedAt: ticket.openedAt,
      respondedAt: firstAt(dispatch, 2),
      closedAt: ticket.restoredAt ?? (dispatch?.stage === 4 ? lastAt(dispatch, 4) : undefined),
      tech: dispatch?.tech,
      affected: areas.find((area) => area.id === ticket.areaId)?.people ?? 0,
      areaId: ticket.areaId,
      flags: flagCount(dispatch),
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
  /** Share of responded incidents where the crew reached the site within the SLA target. */
  slaPct?: number | undefined;
  flagged: number;
};

const average = (values: number[]) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined);

export function summarise(rows: IncidentRow[], now = Date.now()): Summary {
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const open = rows.filter((row) => row.closedAt === undefined);
  const responded = rows.filter((row) => row.respondedAt !== undefined);
  const resolved = rows.filter((row) => row.closedAt !== undefined);
  const met = responded.filter((row) => (row.respondedAt ?? 0) - row.openedAt <= SLA_RESPONSE_MS).length;
  return {
    open: open.length,
    openedToday: rows.filter((row) => row.openedAt >= startOfDay).length,
    affected: open.reduce((sum, row) => sum + row.affected, 0),
    responded: responded.length,
    resolved: resolved.length,
    avgResponseMs: average(responded.map((row) => (row.respondedAt ?? 0) - row.openedAt)),
    avgResolutionMs: average(resolved.map((row) => (row.closedAt ?? 0) - row.openedAt)),
    slaPct: responded.length > 0 ? Math.round((100 * met) / responded.length) : undefined,
    flagged: rows.reduce((sum, row) => sum + row.flags, 0),
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
    if ((dispatch.stage ?? -1) === 4) done.push({ id: ticket.id, ticket, dispatch });
    else if (!ticket.restoredAt) open.push({ id: ticket.id, ticket, dispatch });
  }
  for (const report of reports) {
    const dispatch = dispatches[report.id];
    if (report.duplicateOf || dispatch?.tech !== name) continue;
    if ((dispatch.stage ?? -1) === 4) done.push({ id: report.id, report, dispatch });
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
