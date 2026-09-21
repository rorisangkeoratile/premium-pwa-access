import type { Priority } from "@/components/lesedi/data";
import { distanceKm } from "@/lib/geo";
import type { AutoTicket } from "@/lib/nodes";
import { isHomeOutage, stageNames, type Dispatch, type OutageReport } from "@/lib/reports";
import { createStore } from "@/lib/store";

/**
 * The public view of an incident.
 *
 * A *report* is private: it carries the reporter's name, contact, account, photos and a pin on their
 * home. A neighbour who is affected by the same fault must never see any of that. This module builds
 * the shareable half — area, status, crew progress — so residents can follow an outage without the
 * person who reported it losing their privacy.
 */

/** Followers per incident: incident id -> resident ids (their login email). */
export const followStore = createStore<Record<string, string[]>>("lesedilink.follows", {});

/** Locations shown to followers are snapped to this grid and drawn as a circle, never as a house pin. */
export const AREA_CELL = 0.005; // roughly 500 m
export const AREA_RADIUS_M = 500;
/** How far from a resident we look for outages they may be affected by. */
export const NEARBY_KM = 3;
/** A resident is told about outages this close to the centre of their home area, wherever they are right now. */
export const HOME_AREA_KM = NEARBY_KM;

const snap = (value: number) => Math.round(value / AREA_CELL) * AREA_CELL;

const ADMIN = /^(south africa|gauteng|city of tshwane|tshwane|.*metropolitan municipality|ward \d+.*)$/i;
const STREET = /(^|\s)(ave|avenue|st|street|rd|road|dr|drive|way|lane|ln|cres|crescent|blvd|boulevard|close)\.?$/i;

/** Suburb-level name from a full street address, so followers never see the reporter's street. */
export function areaLabel(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^\d/.test(part) && !/^[\d\s-]+$/.test(part));
  const areas = parts.filter((part) => !ADMIN.test(part) && !STREET.test(part));
  return areas[0] ?? parts.find((part) => !STREET.test(part)) ?? "your area";
}

export type PublicUpdate = { stage: number; at: number };

export type PublicIncident = {
  id: string;
  /** Suburb or area name only. */
  area: string;
  /** Snapped centre of the affected area, not the reporter's location. */
  lat: number;
  lng: number;
  radiusM: number;
  openedAt: number;
  /** -2 no crew yet, -1 assigned, 0–4 the technician's stages. */
  stage: number;
  status: string;
  /** Full name, used only to look up the crew's position. */
  techName?: string | undefined;
  /** First name, the only part shown to residents. */
  techFirst?: string | undefined;
  /** The crew's live position is shared from the moment they accept until the job is finished. */
  techVisible: boolean;
  /** True only while they are driving, when a route and an ETA are worth drawing. */
  techEnRoute: boolean;
  /** Stage changes only. The technician's free-text notes stay on the staff dashboards. */
  updates: PublicUpdate[];
  reports: number;
  followers: number;
  source: "citizen" | "auto";
  /** A fault at one property. The resident who reported it can track it, but it is never offered to neighbours to follow. */
  home: boolean;
  /** The sensor-network area, for outages the sensors detected. */
  areaId?: string | undefined;
  /** When it was resolved: a repair finished (reports) or the sensors saw power return (sensor outages). */
  closedAt?: number | undefined;
};

function statusLine(stage: number, first: string | undefined): string {
  if (stage === -2) return "Reported · waiting for a crew to be assigned";
  if (stage === -1) return `${first} has been assigned to this outage`;
  if (stage === 0) return `${first} accepted the job and is getting ready`;
  if (stage === 1) return `${first} is on the way`;
  if (stage === 2) return `${first} is on site`;
  if (stage === 3) return `${first} is repairing the fault`;
  return "Power restored";
}

function base(id: string, area: string, lat: number, lng: number, openedAt: number, dispatch: Dispatch | undefined, reports: number, followers: number, source: "citizen" | "auto", home = false): PublicIncident {
  const stage = dispatch ? (dispatch.stage ?? -1) : -2;
  const first = dispatch?.tech.split(" ")[0];
  return {
    id,
    area,
    lat: snap(lat),
    lng: snap(lng),
    radiusM: AREA_RADIUS_M,
    openedAt,
    stage,
    status: statusLine(stage, first),
    ...(dispatch ? { techName: dispatch.tech, techFirst: first } : {}),
    // Residents asked to see the crew all the way through, not just while driving. The position is the
    // crew's own device, which is theirs to share, and it stops the moment the job is closed.
    techVisible: stage >= 0 && stage <= 3,
    techEnRoute: stage === 1,
    updates: (dispatch?.updates ?? []).map((update) => ({ stage: update.stage, at: update.at })),
    reports,
    followers,
    source,
    home,
  };
}

export const followerCount = (id: string, follows: Record<string, string[]>) => follows[id]?.length ?? 0;
export const isFollowing = (id: string, resident: string, follows: Record<string, string[]>) => Boolean(follows[id]?.includes(resident));

export function follow(id: string, resident: string) {
  const all = followStore.get();
  if (all[id]?.includes(resident)) return;
  followStore.set({ ...all, [id]: [...(all[id] ?? []), resident] });
}

export function unfollow(id: string, resident: string) {
  const all = followStore.get();
  followStore.set({ ...all, [id]: (all[id] ?? []).filter((item) => item !== resident) });
}

/**
 * Every incident in its public form, open or closed. Closed ones are kept so residents can be told
 * "power restored", which is the alert they most want to receive.
 */
export function publicHistory(
  reports: OutageReport[],
  tickets: AutoTicket[],
  dispatches: Record<string, Dispatch>,
  follows: Record<string, string[]>,
): PublicIncident[] {
  const fromReports = reports
    .filter((report) => !report.duplicateOf)
    .map((report) => {
      const dispatch = dispatches[report.id];
      const closedAt = dispatch?.stage === 4 ? ((dispatch.updates ?? []).filter((update) => update.stage === 4).at(-1)?.at ?? dispatch.at) : undefined;
      return {
        ...base(
          report.id,
          areaLabel(report.address),
          report.lat,
          report.lng,
          report.createdAt,
          dispatch,
          1 + reports.filter((other) => other.duplicateOf === report.id).length,
          followerCount(report.id, follows),
          "citizen",
          isHomeOutage(report),
        ),
        ...(closedAt !== undefined ? { closedAt } : {}),
      };
    });

  const fromTickets = tickets.map((ticket) => ({
    ...base(ticket.id, ticket.areaName, ticket.lat, ticket.lng, ticket.openedAt, dispatches[ticket.id], 0, followerCount(ticket.id, follows), "auto"),
    areaId: ticket.areaId,
    ...(ticket.restoredAt ? { closedAt: ticket.restoredAt } : {}),
  }));

  return [...fromTickets, ...fromReports];
}

/** Every incident a resident may follow: open citizen reports (masters only) and open node-detected outages. */
export const publicIncidents = (reports: OutageReport[], tickets: AutoTicket[], dispatches: Record<string, Dispatch>, follows: Record<string, string[]>): PublicIncident[] =>
  publicHistory(reports, tickets, dispatches, follows).filter((incident) => incident.closedAt === undefined);

export const nearbyIncidents = (all: PublicIncident[], point: { lat: number; lng: number }) =>
  all.filter((incident) => !incident.home && distanceKm(point, incident) <= NEARBY_KM).sort((a, b) => distanceKm(point, a) - distanceKm(point, b));

/** The home page only shows outages this close to the visitor. */
export const FEED_RADIUS_KM = 10;

export type FeedItem = { id: string; place: string; status: string; km: number; priority: Priority };

/**
 * Outages within FEED_RADIUS_KM of a point, nearest first, for the public home page.
 * It uses the public view only: the suburb, never a street address, and no reporter details.
 */
export function feedNear(
  point: { lat: number; lng: number },
  reports: OutageReport[],
  tickets: AutoTicket[],
  dispatches: Record<string, Dispatch>,
  follows: Record<string, string[]>,
): FeedItem[] {
  const live = publicIncidents(reports, tickets, dispatches, follows).filter((incident) => !incident.home).map((incident) => ({
    id: incident.id,
    place: incident.area,
    status: incident.status,
    lat: incident.lat,
    lng: incident.lng,
    priority: (incident.source === "auto" ? "High" : "Medium") as Priority,
  }));
  return live
    .map((item) => ({ id: item.id, place: item.place, status: item.status, priority: item.priority, km: distanceKm(point, item) }))
    .filter((item) => item.km <= FEED_RADIUS_KM)
    .sort((a, b) => a.km - b.km);
}

export const stageLabel = (stage: number) => (stage < 0 ? "Technician assigned" : (stageNames[stage] ?? "Update"));
