import type { MockUser, Priority } from "@/components/lesedi/data";
import { distanceKm } from "@/lib/geo";
import { HOME_AREA_KM, publicHistory } from "@/lib/incidents";
import { formatDuration } from "@/lib/metrics";
import { areas, type AutoTicket } from "@/lib/nodes";
import { isHomeOutage, stageNames, toIncident, type Dispatch, type OutageReport } from "@/lib/reports";
import { createStore } from "@/lib/store";

/**
 * Alerts, worked out from the shared simulation state rather than stored. Every open dashboard sees the same
 * state, so every dashboard reaches the same alerts at the same moment, and a tab opened later still shows
 * what it missed.
 *
 * A resident's alerts follow the home area on their account, not where their phone is right now, so a
 * Soshanguve resident visiting Mamelodi still hears about a Soshanguve outage. Residents are only ever
 * shown the public view of an incident (area, status, first name of the technician).
 */
export type Notice = { id: string; at: number; title: string; body: string; tone: "info" | "success" | "warn" | "danger" };

export type World = { reports: OutageReport[]; tickets: AutoTicket[]; dispatches: Record<string, Dispatch>; follows: Record<string, string[]> };

/** When each user last marked their alerts as read, keyed by email. */
export const noticeSeenStore = createStore<Record<string, number>>("lesedilink.notice-seen", {});

const MAX_NOTICES = 40;

export function markRead(email: string, notices: Notice[]) {
  const newest = notices.reduce((max, notice) => Math.max(max, notice.at), Date.now());
  noticeSeenStore.set({ ...noticeSeenStore.get(), [email]: newest });
}

function stageCopy(stage: number, first: string, area: string, source: "citizen" | "auto"): Pick<Notice, "title" | "body" | "tone"> {
  if (stage === -1) return { title: "Technician assigned", body: `${first} has been assigned to the outage in ${area}.`, tone: "info" };
  if (stage === 0) return { title: `${first} accepted the job`, body: `They are getting ready to head to ${area}.`, tone: "info" };
  if (stage === 1) return { title: `${first} is on the way`, body: "You can follow their live position on your dashboard.", tone: "info" };
  if (stage === 2) return { title: `${first} has arrived`, body: `The repair team is on site in ${area}.`, tone: "info" };
  if (stage === 3) return { title: "Repair in progress", body: `${first} is fixing the fault in ${area}.`, tone: "info" };
  return source === "auto"
    ? { title: `Repair finished in ${area}`, body: `${first} has completed the work. We will confirm once our sensors see the power return.`, tone: "success" }
    : { title: `Power restored in ${area}`, body: `${first} has completed the repair.`, tone: "success" };
}

function residentNotices(user: MockUser, world: World): Notice[] {
  const { reports, tickets, dispatches, follows } = world;
  const history = publicHistory(reports, tickets, dispatches, follows);
  const mine = reports.filter((report) => report.reporter === user.name);
  const ownMasters = new Set(mine.map((report) => report.duplicateOf ?? report.id));
  const home = user.areaId ? areas.find((area) => area.id === user.areaId) : undefined;
  const out: Notice[] = [];

  for (const incident of history) {
    const own = ownMasters.has(incident.id);
    const followed = Boolean(follows[incident.id]?.includes(user.email));
    // Sensor outages carry their area; a citizen report is placed by how close it is to the middle of the home area.
    const atHome = !incident.home && home !== undefined && (incident.areaId === home.id || (incident.areaId === undefined && distanceKm(home, incident) <= HOME_AREA_KM));
    if (!own && !followed && !atHome) continue;

    const area = incident.area;
    const first = incident.techFirst ?? "A technician";
    const push = (kind: string, at: number, copy: Pick<Notice, "title" | "body" | "tone">) => out.push({ id: `${incident.id}:${kind}:${at}`, at, ...copy });

    if (own) {
      push("opened", incident.openedAt, { title: "Report received", body: `We have your report ${incident.id}${incident.home ? "" : ` for ${area}`}. A crew will be assigned shortly.`, tone: "info" });
    } else if (incident.source === "auto") {
      push("opened", incident.openedAt, {
        title: `Power outage in ${area}`,
        body: atHome ? `Our sensors lost contact with the network in ${area}, your home area. A technician will be assigned. No report needed.` : `Our sensors lost contact with the network in ${area}. A technician will be assigned.`,
        tone: "danger",
      });
    } else {
      push("opened", incident.openedAt, { title: `Outage reported in ${area}`, body: atHome ? `A neighbour reported a fault in ${area}, your home area.` : `A fault was reported in ${area}.`, tone: "warn" });
    }
    for (const update of incident.updates) push(`stage${update.stage}`, update.at, stageCopy(update.stage, first, area, incident.source));
    if (incident.source === "auto" && incident.closedAt !== undefined) {
      push("restored", incident.closedAt, { title: `Power restored in ${area}`, body: `Our sensors confirm the power is back on${atHome ? " at your home area" : ""}.`, tone: "success" });
    }
  }

  // Moments in a home visit that need the resident to act, even if their dashboard is in another tab.
  for (const report of mine.filter((item) => isHomeOutage(item))) {
    const dispatch = dispatches[report.id];
    if (!dispatch) continue;
    const tech = dispatch.tech.split(" ")[0] ?? "The technician";
    if (dispatch.arrival && dispatch.pin) {
      out.push({ id: `${report.id}:pin:${dispatch.arrival.at}`, at: dispatch.arrival.at, title: `${tech} is at your gate`, body: "Your Visit PIN is ready on your dashboard. Read it out only to the technician in front of you.", tone: "warn" });
    }
    if (dispatch.completion) {
      out.push({ id: `${report.id}:confirm:${dispatch.completion.requestedAt}`, at: dispatch.completion.requestedAt, title: "Is your power back on?", body: `${tech} says the repair is finished. Please confirm on your dashboard.`, tone: "warn" });
    }
  }
  return out;
}

const shortAddress = (address: string) => address.split(",").slice(0, 3).join(",").trim();

function describe(id: string, world: World): { place: string; priority: Priority; detail: string } | undefined {
  const ticket = world.tickets.find((item) => item.id === id);
  if (ticket) return { place: ticket.areaName, priority: ticket.priority, detail: ticket.clinicAffected ? "Sensor-detected outage · a clinic is affected" : "Sensor-detected outage" };
  const report = world.reports.find((item) => item.id === id);
  if (report) {
    const incident = toIncident(report);
    return { place: report.address ? shortAddress(report.address) : "Pinned location", priority: incident.priority, detail: incident.detail };
  }
  return undefined;
}

function technicianNotices(user: MockUser, world: World): Notice[] {
  const out: Notice[] = [];
  for (const [id, dispatch] of Object.entries(world.dispatches)) {
    if (dispatch.tech !== user.name) continue;
    const info = describe(id, world);
    if (!info) continue;
    for (const update of dispatch.updates ?? []) {
      if (update.actor === "control" || (update.stage === -1 && update.actor === undefined)) {
        out.push({ id: `${id}:assigned:${update.at}`, at: update.at, title: `New job · ${info.place}`, body: `${info.priority} priority · ${info.detail}`, tone: "warn" });
      } else if (update.actor === "resident") {
        const fixed = update.stage === 4;
        out.push({ id: `${id}:resident:${update.at}`, at: update.at, title: fixed ? "Resident confirmed the power is back" : "Resident says the power is still off", body: info.place, tone: fixed ? "success" : "danger" });
      }
    }
  }
  return out;
}

function dispatcherNotices(world: World): Notice[] {
  const out: Notice[] = [];
  for (const report of world.reports) {
    const info = describe(report.id, world);
    if (report.duplicateOf) {
      out.push({ id: `${report.id}:merged`, at: report.createdAt, title: `Duplicate report merged into ${report.duplicateOf}`, body: report.address ? shortAddress(report.address) : "Pinned location", tone: "info" });
    } else if (info) {
      out.push({ id: `${report.id}:new`, at: report.createdAt, title: `${isHomeOutage(report) ? "Home outage reported" : "New report"} · ${report.id}`, body: `${report.type} · ${info.place}`, tone: info.priority === "High" || info.priority === "Critical" ? "danger" : "warn" });
    }
  }
  for (const ticket of world.tickets) {
    out.push({ id: `${ticket.id}:detected`, at: ticket.openedAt, title: `Sensors detected an outage · ${ticket.areaName}`, body: `${ticket.priority} priority${ticket.clinicAffected ? " · a clinic is affected" : ""}`, tone: "danger" });
    if (ticket.restoredAt) out.push({ id: `${ticket.id}:restored`, at: ticket.restoredAt, title: `Sensors confirm power restored · ${ticket.areaName}`, body: `Closed ${formatDuration(ticket.restoredAt - ticket.openedAt)} after it opened.`, tone: "success" });
  }
  for (const [id, dispatch] of Object.entries(world.dispatches)) {
    const info = describe(id, world);
    if (!info) continue;
    for (const update of dispatch.updates ?? []) {
      const stage = update.stage < 0 ? "assigned" : (stageNames[update.stage] ?? "updated");
      if (update.flag) out.push({ id: `${id}:flag:${update.at}`, at: update.at, title: `Flag · ${update.flag}`, body: `${dispatch.tech} · ${info.place}`, tone: "danger" });
      else out.push({ id: `${id}:stage${update.stage}:${update.at}`, at: update.at, title: `${dispatch.tech.split(" ")[0]} ${update.stage < 0 ? "was assigned" : `is ${stage.toLowerCase()}`}`, body: `${id} · ${info.place}`, tone: update.stage === 4 ? "success" : "info" });
    }
  }
  return out;
}

function managerNotices(world: World): Notice[] {
  const out: Notice[] = [];
  for (const ticket of world.tickets) {
    if (ticket.priority === "Critical" || ticket.priority === "High") out.push({ id: `${ticket.id}:priority`, at: ticket.openedAt, title: `${ticket.priority}-priority outage · ${ticket.areaName}`, body: ticket.clinicAffected ? "A clinic is among the affected sites." : "Detected by the sensor network.", tone: "danger" });
    if (ticket.restoredAt) out.push({ id: `${ticket.id}:resolved`, at: ticket.restoredAt, title: `Resolved · ${ticket.areaName}`, body: `Power back ${formatDuration(ticket.restoredAt - ticket.openedAt)} after the outage opened.`, tone: "success" });
  }
  for (const report of world.reports) {
    if (report.duplicateOf) continue;
    const info = describe(report.id, world);
    if (info && !isHomeOutage(report) && (info.priority === "High" || info.priority === "Critical")) out.push({ id: `${report.id}:priority`, at: report.createdAt, title: `${info.priority}-priority report · ${report.id}`, body: info.place, tone: "danger" });
    const dispatch = world.dispatches[report.id];
    if (dispatch?.stage === 4) {
      const closedAt = dispatch.updates?.filter((update) => update.stage === 4).at(-1)?.at ?? dispatch.at;
      out.push({ id: `${report.id}:resolved`, at: closedAt, title: `Resolved · ${report.id}`, body: `${info?.place ?? "Pinned location"} · ${formatDuration(closedAt - report.createdAt)} from report to repair.`, tone: "success" });
    }
  }
  for (const [id, dispatch] of Object.entries(world.dispatches)) {
    const info = describe(id, world);
    if (!info) continue;
    for (const update of dispatch.updates ?? []) {
      if (update.flag) out.push({ id: `${id}:flag:${update.at}`, at: update.at, title: `Flag · ${update.flag}`, body: `${dispatch.tech} · ${info.place}`, tone: "danger" });
    }
  }
  return out;
}

/** The alerts for one signed-in user, newest first. */
export function noticesFor(user: MockUser, world: World): Notice[] {
  const list =
    user.role === "Customer" ? residentNotices(user, world) : user.role === "Technician" ? technicianNotices(user, world) : user.role === "Dispatcher" ? dispatcherNotices(world) : managerNotices(world);
  return list.sort((a, b) => b.at - a.at).slice(0, MAX_NOTICES);
}

/* Device alerts: the browser's own notifications, shown even while the tab is in the background. */

export const canAlertDevice = () => typeof window !== "undefined" && "Notification" in window;
export const devicePermission = (): NotificationPermission | "unsupported" => (canAlertDevice() ? Notification.permission : "unsupported");

export async function askDevicePermission(): Promise<NotificationPermission | "unsupported"> {
  return canAlertDevice() ? Notification.requestPermission() : "unsupported";
}

/** Show one alert as a device notification. Uses the service worker when there is one (Android needs it). */
export function alertDevice(notice: Notice) {
  if (!canAlertDevice() || Notification.permission !== "granted") return;
  const options: NotificationOptions = { body: notice.body, tag: notice.id, icon: "/icon-192.png" };
  const fallback = () => {
    try {
      new Notification(notice.title, options);
    } catch {
      /* this browser only allows notifications from a service worker */
    }
  };
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistration().then((registration) => (registration ? registration.showNotification(notice.title, options) : fallback())).catch(fallback);
  } else {
    fallback();
  }
}
