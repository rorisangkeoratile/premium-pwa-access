import { useEffect } from "react";

import type { Incident, Priority } from "@/components/lesedi/data";
import { createStore } from "@/lib/store";
import { startTimer } from "@/lib/timer";
import { ago } from "@/lib/reports";

/**
 * Simulated sensor-node network.
 *
 * Every node sends a tiny "I'm alive" heartbeat every HEARTBEAT_MS. Nothing is ever reported *about* a
 * power cut: a node without power cannot speak, so the detector treats missing heartbeats as the signal.
 * In this prototype the "server" is a timer running in one open dashboard tab (see useNodeEngine); real
 * devices and a real backend belong to the pilot phase.
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
/** `people` is a rough estimate of how many residents lose power when the whole area goes dark. */
export type AreaDef = { id: string; name: string; lat: number; lng: number; people: number };

export const areas: AreaDef[] = [
  { id: "soshanguve", name: "Soshanguve Block H", lat: -25.488, lng: 28.098, people: 5240 },
  { id: "cbd", name: "Pretoria CBD", lat: -25.7461, lng: 28.1881, people: 1860 },
  { id: "hatfield", name: "Hatfield", lat: -25.7487, lng: 28.238, people: 920 },
  { id: "mamelodi", name: "Mamelodi East", lat: -25.7, lng: 28.36, people: 3100 },
  { id: "centurion", name: "Centurion", lat: -25.8603, lng: 28.1894, people: 680 },
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
/** What a person has switched off: whole areas without power, and single dead devices. The engine only reads this. */
export type NodeControl = { broken: string[]; cut: string[] };

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

export const controlStore = createStore<NodeControl>("lesedilink.node-control", { broken: [], cut: [] });
export const statusStore = createStore<NetworkStatus>("lesedilink.node-status", { at: 0, nodes: {}, areas: {} });
export const ticketStore = createStore<AutoTicket[]>("lesedilink.auto-tickets", []);

const streaks: Record<string, number> = {};
/**
 * When each node last "spoke". Only the tab that runs the engine needs it, so it stays in memory instead of
 * being written to the shared store every 2 s, where it used to overwrite a dispatcher's "Cut power" click.
 */
const lastSeen: Record<string, number> = {};

/** One server cycle: receive heartbeats, then apply the detection rule to every area. */
function tick() {
  const now = Date.now();
  const control = controlStore.get();

  // 1. Heartbeats: only nodes with power (and a working device) manage to send one.
  for (const node of nodeDefs) {
    if (!control.cut.includes(node.areaId) && !control.broken.includes(node.id)) lastSeen[node.id] = now;
  }

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

const ENGINE_LOCK = "lesedilink-node-engine";

function resetEngineMemory() {
  for (const key of Object.keys(streaks)) delete streaks[key];
  for (const key of Object.keys(lastSeen)) delete lastSeen[key];
}

/**
 * Runs the simulated node network and detector. Every dashboard calls this, but the browser's Web Locks
 * make sure only one open tab is the engine at a time. If that tab is closed, another tab takes over, so
 * the simulation keeps going as long as any LesediLink tab is open.
 */
export function useNodeEngine(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stopLeading: (() => void) | null = null;

    const lead = () =>
      new Promise<void>((resolve) => {
        resetEngineMemory();
        tick();
        const stopTimer = startTimer(tick, HEARTBEAT_MS);
        stopLeading = () => {
          stopTimer();
          resolve();
        };
      });

    if (typeof navigator !== "undefined" && navigator.locks) {
      void navigator.locks.request(ENGINE_LOCK, () => (cancelled ? undefined : lead())).catch(() => undefined);
    } else {
      void lead();
    }
    return () => {
      cancelled = true;
      stopLeading?.();
    };
  }, [enabled]);
}

/** Forget the sensors' short-term memory (used when the whole simulation is reset). */
export function resetEngine() {
  resetEngineMemory();
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
