import { useEffect } from "react";

import type { Incident, Priority } from "@/components/lesedi/data";
import { createStore } from "@/lib/store";
import { ago } from "@/lib/reports";

/**
 * Simulated sensor-node network.
 *
 * Every node sends a tiny "I'm alive" heartbeat every HEARTBEAT_MS. Nothing is ever reported *about* a
 * power cut: a node without power cannot speak, so the detector treats missing heartbeats as the signal.
 * In this prototype the "server" is a timer running in the dispatcher's browser tab; real devices and a
 * real backend belong to the pilot phase.
 */

export const HEARTBEAT_MS = 2000;
/** A heartbeat older than this is "late" (amber). Slightly under 2 beats to tolerate timer jitter. */
export const LATE_MS = 3500;
/** A heartbeat older than this counts as "silent" (about 6 seconds without a message). */
export const SILENT_MS = 5500;
/** Share of an area's nodes that must be silent for the rule to match. */
export const SILENT_SHARE = 0.75;
/** Share of nodes outside the area that must still be online, otherwise it looks like a network/server fault. */
export const ELSEWHERE_ONLINE_SHARE = 0.5;
/** Consecutive matching checks needed before a ticket opens (filters out glitches). */
export const STREAK_NEEDED = 2;
/** An open ticket closes once fewer than this share of the area's nodes are silent. */
const RESTORED_BELOW = 0.25;

export type SiteType = "Clinic" | "School" | "Spaza shop";
export type NodeDef = { id: string; areaId: string; name: string; site: SiteType; lat: number; lng: number };
export type AreaDef = { id: string; name: string; lat: number; lng: number };

export const areas: AreaDef[] = [
  { id: "soshanguve", name: "Soshanguve Block H", lat: -25.488, lng: 28.098 },
  { id: "cbd", name: "Pretoria CBD", lat: -25.7461, lng: 28.1881 },
  { id: "hatfield", name: "Hatfield", lat: -25.7487, lng: 28.238 },
  { id: "mamelodi", name: "Mamelodi East", lat: -25.7, lng: 28.36 },
  { id: "centurion", name: "Centurion", lat: -25.8603, lng: 28.1894 },
];

const offsets: [number, number][] = [[0.004, 0.002], [-0.003, 0.005], [0.001, -0.006], [-0.005, -0.002], [0.006, -0.004]];

const sites: Record<string, [string, SiteType][]> = {
  soshanguve: [["Block H Clinic", "Clinic"], ["Block H Primary", "School"], ["Mthembu Spaza", "Spaza shop"], ["Corner Spaza", "Spaza shop"], ["Sikhulile High", "School"]],
  cbd: [["Church St Clinic", "Clinic"], ["Central Primary", "School"], ["Bosman Spaza", "Spaza shop"], ["Paul Kruger Spaza", "Spaza shop"], ["Vermeulen Spaza", "Spaza shop"]],
  hatfield: [["Hatfield Primary", "School"], ["Burnett Spaza", "Spaza shop"], ["Festival Spaza", "Spaza shop"], ["Arcadia High", "School"], ["Duncan Spaza", "Spaza shop"]],
  mamelodi: [["Mamelodi East Clinic", "Clinic"], ["Tsutsumani Primary", "School"], ["Vusi Spaza", "Spaza shop"], ["Station Spaza", "Spaza shop"], ["Lehlabile High", "School"]],
  centurion: [["Lyttelton Primary", "School"], ["Rabie Spaza", "Spaza shop"], ["Kloof Spaza", "Spaza shop"], ["Irene High", "School"], ["Embankment Spaza", "Spaza shop"]],
};

export const nodeDefs: NodeDef[] = areas.flatMap((area) =>
  (sites[area.id] ?? []).map(([name, site], index) => ({
    id: `${area.id}-${index + 1}`,
    areaId: area.id,
    name,
    site,
    lat: area.lat + (offsets[index]?.[0] ?? 0),
    lng: area.lng + (offsets[index]?.[1] ?? 0),
  })),
);

export type NodeState = "online" | "late" | "silent";
export type AreaStatus = { total: number; online: number; late: number; silent: number; streak: number; elsewhereOnline: number };
export type NetworkStatus = { at: number; nodes: Record<string, NodeState>; areas: Record<string, AreaStatus> };
export type NodeControl = { lastSeen: Record<string, number>; broken: string[]; cut: string[] };

export type AutoTicket = {
  id: string;
  areaId: string;
  areaName: string;
  lat: number;
  lng: number;
  openedAt: number;
  restoredAt?: number | undefined;
  priority: Priority;
  silentNodes: string[];
  clinicAffected: boolean;
};

export const controlStore = createStore<NodeControl>("lesedilink.node-control", { lastSeen: {}, broken: [], cut: [] });
export const statusStore = createStore<NetworkStatus>("lesedilink.node-status", { at: 0, nodes: {}, areas: {} });
export const ticketStore = createStore<AutoTicket[]>("lesedilink.auto-tickets", []);

const streaks: Record<string, number> = {};

/** One server cycle: receive heartbeats, then apply the detection rule to every area. */
function tick() {
  const now = Date.now();
  const control = controlStore.get();

  // 1. Heartbeats: only nodes with power (and a working device) manage to send one.
  const lastSeen = { ...control.lastSeen };
  for (const node of nodeDefs) {
    if (!control.cut.includes(node.areaId) && !control.broken.includes(node.id)) lastSeen[node.id] = now;
  }
  controlStore.set({ ...control, lastSeen });

  // 2. Classify each node by how old its last heartbeat is.
  const nodes: Record<string, NodeState> = {};
  for (const node of nodeDefs) {
    const age = now - (lastSeen[node.id] ?? 0);
    nodes[node.id] = age >= SILENT_MS ? "silent" : age >= LATE_MS ? "late" : "online";
  }

  // 3. The rule, per area.
  const tickets = [...ticketStore.get()];
  let ticketsChanged = false;
  const areaStatus: Record<string, AreaStatus> = {};

  for (const area of areas) {
    const inside = nodeDefs.filter((node) => node.areaId === area.id);
    const outside = nodeDefs.filter((node) => node.areaId !== area.id);
    const silent = inside.filter((node) => nodes[node.id] === "silent");
    const late = inside.filter((node) => nodes[node.id] === "late").length;
    const elsewhereOnline = outside.filter((node) => nodes[node.id] === "online").length / Math.max(1, outside.length);

    const matches = silent.length / inside.length >= SILENT_SHARE && elsewhereOnline >= ELSEWHERE_ONLINE_SHARE;
    streaks[area.id] = matches ? (streaks[area.id] ?? 0) + 1 : 0;

    const open = tickets.find((ticket) => ticket.areaId === area.id && !ticket.restoredAt);

    if ((streaks[area.id] ?? 0) >= STREAK_NEEDED && !open) {
      const clinicAffected = silent.some((node) => node.site === "Clinic");
      const number = tickets.reduce((max, ticket) => Math.max(max, Number(ticket.id.replace(/\D/g, ""))), 1000) + 1;
      tickets.unshift({
        id: `#AD-${number}`,
        areaId: area.id,
        areaName: area.name,
        lat: area.lat,
        lng: area.lng,
        openedAt: now,
        priority: clinicAffected ? "Critical" : "High",
        silentNodes: silent.map((node) => node.id),
        clinicAffected,
      });
      ticketsChanged = true;
    } else if (open && silent.length / inside.length < RESTORED_BELOW) {
      open.restoredAt = now;
      ticketsChanged = true;
    }

    areaStatus[area.id] = { total: inside.length, online: inside.length - silent.length - late, late, silent: silent.length, streak: streaks[area.id] ?? 0, elsewhereOnline };
  }

  if (ticketsChanged) ticketStore.set(tickets);
  statusStore.set({ at: now, nodes, areas: areaStatus });
}

/** Runs the simulated node network + detector while the calling dashboard is mounted. */
export function useNodeEngine() {
  useEffect(() => {
    for (const key of Object.keys(streaks)) delete streaks[key];
    tick();
    const timer = setInterval(tick, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, []);
}

export function cutPower(areaId: string) {
  const control = controlStore.get();
  if (!control.cut.includes(areaId)) controlStore.set({ ...control, cut: [...control.cut, areaId] });
}

export function restorePower(areaId: string) {
  const control = controlStore.get();
  controlStore.set({ ...control, cut: control.cut.filter((id) => id !== areaId) });
}

export function restoreAllPower() {
  controlStore.set({ ...controlStore.get(), cut: [], broken: [] });
}

/** Breaks one working node in an area (a dead device, not a power cut) or repairs the broken ones. */
export function toggleBrokenNode(areaId: string) {
  const control = controlStore.get();
  const inArea = nodeDefs.filter((node) => node.areaId === areaId).map((node) => node.id);
  const broken = control.broken.filter((id) => inArea.includes(id));
  if (broken.length > 0) {
    controlStore.set({ ...control, broken: control.broken.filter((id) => !inArea.includes(id)) });
    return;
  }
  const target = inArea.find((id) => nodeDefs.find((node) => node.id === id)?.site !== "Clinic");
  if (target) controlStore.set({ ...control, broken: [...control.broken, target] });
}

export function ticketToIncident(ticket: AutoTicket): Incident {
  return {
    id: ticket.id,
    place: ticket.areaName,
    detail: `Auto-detected, no resident report · ${ticket.silentNodes.length} nodes silent${ticket.clinicAffected ? " · clinic affected" : ""}`,
    priority: ticket.priority,
    people: "Area-wide",
    age: ago(ticket.openedAt),
    lat: ticket.lat,
    lng: ticket.lng,
    source: "auto",
  };
}
