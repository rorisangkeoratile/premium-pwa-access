import { CheckCircle2, Cross, PowerOff, Radio, RotateCcw, School, Store, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MapMarker } from "@/components/lesedi/live-map";
import {
  ELSEWHERE_ONLINE_SHARE, HEARTBEAT_MS, SILENT_SHARE, STREAK_NEEDED,
  areas, controlStore, cutPower, nodeDefs, restoreAllPower, restorePower, statusStore, ticketStore, toggleBrokenNode,
  type AutoTicket, type NodeState, type SiteType,
} from "@/lib/nodes";
import { ago } from "@/lib/reports";

const siteIcon: Record<SiteType, typeof Cross> = { Clinic: Cross, School, "Spaza shop": Store };
const stateStyle: Record<NodeState, string> = { online: "bg-success", late: "bg-warning", silent: "bg-destructive" };
const stateLabel: Record<NodeState, string> = { online: "Online", late: "Late", silent: "Silent" };

export function nodeMarkers(states: Record<string, NodeState>): MapMarker[] {
  return nodeDefs.map((node) => ({
    id: `node:${node.id}`,
    lat: node.lat,
    lng: node.lng,
    kind: "node",
    state: states[node.id] ?? "online",
    label: node.name,
    detail: `${node.site} sensor node · ${stateLabel[states[node.id] ?? "online"]}`,
  }));
}

/** Dispatcher panel: the simulated node fleet, the detection rule's live numbers and the demo controls. */
export function NodeNetworkPanel() {
  const status = statusStore.use();
  const control = controlStore.use();
  const tickets = ticketStore.use();
  const restored = tickets.filter((ticket) => ticket.restoredAt).slice(0, 3);

  return (
    <section className="rounded-md border border-border bg-card" aria-labelledby="nodes-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="max-w-2xl">
          <h2 id="nodes-title" className="flex items-center gap-2 font-extrabold text-navy"><Radio className="size-4 text-primary" /> Sensor node network <span className="rounded bg-warning-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-foreground">Simulated</span></h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {nodeDefs.length} nodes at clinics, schools and spaza shops send a heartbeat every {HEARTBEAT_MS / 1000} s. A node with no power cannot speak, so missing heartbeats are the signal. An outage ticket opens when at least {SILENT_SHARE * 100}% of an area&apos;s nodes are silent, at least {ELSEWHERE_ONLINE_SHARE * 100}% of the other nodes are still online, and the check matches {STREAK_NEEDED} times in a row. Real devices belong to the pilot phase.
          </p>
        </div>
        <Button variant="outline" size="sm" className="min-h-11" onClick={restoreAllPower}><RotateCcw /> Reset all nodes</Button>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => {
          const info = status.areas[area.id];
          const cut = control.cut.includes(area.id);
          const hasBroken = control.broken.some((id) => nodeDefs.find((node) => node.id === id)?.areaId === area.id);
          const open = tickets.find((ticket) => ticket.areaId === area.id && !ticket.restoredAt);
          const health = open ? "Outage" : info && info.silent > 0 ? "Degraded" : "Healthy";
          const healthStyle = open ? "bg-destructive text-destructive-foreground" : health === "Degraded" ? "bg-warning-soft text-foreground" : "bg-success-soft text-success";
          return (
            <div key={area.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-extrabold text-navy">{area.name}</p>
                <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${healthStyle}`}>{health}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {nodeDefs.filter((node) => node.areaId === area.id).map((node) => {
                  const state = status.nodes[node.id] ?? "online";
                  const Icon = siteIcon[node.site];
                  return (
                    <span key={node.id} title={`${node.name} · ${node.site} · ${stateLabel[state]}`} className={`grid size-8 place-items-center rounded text-primary-foreground ${stateStyle[state]}`}>
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="sr-only">{node.name}, {node.site}, {stateLabel[state]}</span>
                    </span>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {info ? `${info.silent} of ${info.total} silent · rest of network ${Math.round(info.elsewhereOnline * 100)}% online · match ${info.streak}/${STREAK_NEEDED}` : "Waiting for first check…"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {cut
                  ? <Button size="sm" className="min-h-11" onClick={() => restorePower(area.id)}><Zap /> Restore power</Button>
                  : <Button size="sm" variant="destructive" className="min-h-11" onClick={() => cutPower(area.id)}><PowerOff /> Cut power</Button>}
                <Button size="sm" variant="outline" className="min-h-11" disabled={cut} onClick={() => toggleBrokenNode(area.id)}>{hasBroken ? "Repair node" : "Break 1 node"}</Button>
              </div>
            </div>
          );
        })}
      </div>

      {restored.length > 0 && (
        <div className="border-t border-border p-4">
          <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Recently closed by the nodes</p>
          <ul className="mt-2 space-y-1 text-xs">
            {restored.map((ticket) => <li key={ticket.id} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /><strong>{ticket.id}</strong> {ticket.areaName} · restored, verified by nodes {ago(ticket.restoredAt ?? Date.now())} ago</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Detail block for an auto-detected ticket (replaces the citizen evidence block). */
export function AutoTicketDetail({ ticket }: { ticket: AutoTicket }) {
  const silent = ticket.silentNodes.map((id) => nodeDefs.find((node) => node.id === id)).filter((node) => node !== undefined);
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md bg-danger-soft p-3">
        <p className="font-extrabold text-destructive">Auto-detected · no resident report</p>
        <p className="mt-1 text-xs text-muted-foreground">Opened {ago(ticket.openedAt)} ago because {silent.length} of {nodeDefs.filter((node) => node.areaId === ticket.areaId).length} nodes in {ticket.areaName} stopped sending heartbeats while the rest of the network stayed online.</p>
        {ticket.clinicAffected && <p className="mt-2 text-xs font-bold text-destructive">Priority raised to Critical: a clinic is among the silent nodes.</p>}
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {silent.map((node) => {
          const Icon = siteIcon[node.site];
          return <li key={node.id} className="flex items-center gap-2 rounded-md bg-secondary p-2 text-xs"><Icon className="size-4 text-primary" aria-hidden="true" /><span className="min-w-0 truncate font-bold">{node.name}</span><span className="ml-auto text-muted-foreground">{node.site}</span></li>;
        })}
      </ul>
    </div>
  );
}
