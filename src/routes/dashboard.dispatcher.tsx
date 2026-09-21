import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Gauge, Radio, Send, Siren, SlidersHorizontal, Users, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardShell, PageHeading, PriorityBadge, Stat } from "@/components/lesedi/shell";
import { LiveMap, crewMarkers, incidentMarkers } from "@/components/lesedi/live-map";
import { ReportEvidence } from "@/components/lesedi/report-evidence";
import { AutoTicketDetail, NodeNetworkPanel, nodeMarkers } from "@/components/lesedi/node-network";
import { mockUsers, technicians, type MockUser, type Priority } from "@/components/lesedi/data";
import { currentUser } from "@/lib/auth";
import { distanceKm } from "@/lib/geo";
import { JobFeed, LinkedReports } from "@/components/lesedi/job-progress";
import { assignJob, crewStore, dispatchStore, reportStore, stageNames, toIncident } from "@/lib/reports";
import { crewStatus, formatDuration, incidentRows, summarise } from "@/lib/metrics";
import { statusStore, ticketStore, ticketToIncident } from "@/lib/nodes";
import { followStore, followerCount } from "@/lib/incidents";
import { onlineEmails, useClock, usePresence } from "@/lib/presence";

export const Route = createFileRoute("/dashboard/dispatcher")({
  head: () => ({
    meta: [
      { title: "Dispatcher dashboard — LesediLink" },
      { name: "description", content: "Control-centre view of every Tshwane outage with priority queue, duplicate detection and crew dispatch." },
      { property: "og:title", content: "Dispatcher dashboard — LesediLink" },
      { property: "og:description", content: "Triage incidents and dispatch the nearest crew in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DispatcherDashboard,
});

const priorityRank: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const emailByName = new Map(mockUsers.map((user) => [user.name, user.email]));
/** A crew position older than this is treated as stale and the depot is used instead. */
const FRESH_GPS_MS = 2 * 60 * 1000;

function DispatcherDashboard() {
  const [me, setMe] = useState<MockUser | null>(null);
  useEffect(() => setMe(currentUser()), []);
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<string | null>(null);
  const reports = reportStore.use();
  const dispatches = dispatchStore.use();
  const crewLocations = crewStore.use();
  const tickets = ticketStore.use();
  const nodeStatus = statusStore.use();
  const follows = followStore.use();
  const presence = usePresence();
  const now = useClock(3000);
  const online = useMemo(() => onlineEmails(presence, now), [presence, now]);

  // Sensor-detected outages and citizen reports (with their GPS pin and media) share one queue, worst first.
  // Duplicates are merged: only master reports enter the queue, with a count of the reports linked to them.
  const entries = useMemo(
    () =>
      [
        ...tickets.filter((ticket) => !ticket.restoredAt).map((ticket) => ({ incident: ticketToIncident(ticket), openedAt: ticket.openedAt })),
        ...reports
          .filter((item) => !item.duplicateOf && dispatches[item.id]?.stage !== 4)
          .map((item) => ({ incident: toIncident(item, reports.filter((other) => other.duplicateOf === item.id).length, followerCount(item.id, follows)), openedAt: item.createdAt })),
      ].sort((a, b) => priorityRank[a.incident.priority] - priorityRank[b.incident.priority] || b.openedAt - a.openedAt),
    [tickets, reports, dispatches, follows],
  );
  const allIncidents = useMemo(() => entries.map((entry) => entry.incident), [entries]);
  const filtered = useMemo(() => (filter === "All" ? allIncidents : allIncidents.filter((item) => item.priority === filter)), [filter, allIncidents]);
  const selected = allIncidents.find((item) => item.id === selectedId) ?? allIncidents[0];
  const selectedReport = selected ? reports.find((item) => item.id === selected.id) : undefined;
  const selectedTicket = selected ? tickets.find((item) => item.id === selected.id && !item.restoredAt) : undefined;
  const linked = selected ? reports.filter((item) => item.duplicateOf === selected.id) : [];
  const dispatched = selected ? dispatches[selected.id] : undefined;

  const crew = useMemo(
    () =>
      technicians
        .map((tech) => ({ tech, ...crewStatus(tech.name, reports, tickets, dispatches), online: online.has(emailByName.get(tech.name) ?? "") }))
        .sort((a, b) => Number(b.online) - Number(a.online) || Number(a.status === "On job") - Number(b.status === "On job")),
    [reports, tickets, dispatches, online],
  );
  const summary = useMemo(() => summarise(incidentRows(reports, tickets, dispatches, follows), now), [reports, tickets, dispatches, follows, now]);
  const availableCount = crew.filter((item) => item.status === "Available").length;
  const crewOnline = crew.filter((item) => item.online).length;
  const dispatchersOnline = new Set([...online].map((email) => mockUsers.find((user) => user.email === email)).filter((user) => user?.role === "Dispatcher").map((user) => user!.name)).size;

  const markers = useMemo(
    () => [...nodeMarkers(nodeStatus.nodes), ...incidentMarkers(allIncidents), ...crewMarkers(crew.map((item) => ({ ...item.tech, status: `${item.status}${item.online ? " · online" : " · offline"}` })), crewLocations)],
    [nodeStatus.nodes, allIncidents, crewLocations, crew],
  );
  const focus = useMemo(() => (selected ? { lat: selected.lat, lng: selected.lng } : null), [selected?.lat, selected?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const crewDistance = (tech: (typeof technicians)[number]) => {
    if (!selected) return "—";
    const live = crewLocations[tech.name];
    const at = live && now - live.at < FRESH_GPS_MS ? live : tech;
    return `${distanceKm(at, selected).toFixed(1)} km`;
  };
  const assignedCrew = crew.find((item) => item.tech.name === assigned);

  function dispatch() {
    if (!assigned || !selected) return;
    assignJob(selected.id, assigned);
    setAssigned(null);
  }

  return (
    <DashboardShell home="/dashboard/dispatcher" user={me?.name ?? "Dispatcher"} role={me?.title ?? "Dispatcher"}>
      <PageHeading eyebrow="Dispatcher" title="Control centre" text="City-wide electricity response overview" action={<span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-extrabold text-primary"><Radio className="size-4" /> {crewOnline} of {crew.length} crews online · {dispatchersOnline} dispatcher{dispatchersOnline === 1 ? "" : "s"}</span>} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Live response metrics">
        <Stat label="Active outages" value={String(summary.open)} note={`${summary.openedToday} opened today`} icon={Siren} alert={summary.open > 0} />
        <Stat label="People affected" value={summary.affected.toLocaleString("en-ZA")} note="Estimate, open outages" icon={Users} />
        <Stat label="Avg. response" value={formatDuration(summary.avgResponseMs)} note={summary.responded > 0 ? `${summary.responded} crew arrival${summary.responded === 1 ? "" : "s"} so far` : "No crew on site yet"} icon={Clock3} />
        <Stat label="Crews available" value={`${availableCount} / ${crew.length}`} note={`${crewOnline} online now`} icon={Wrench} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,.75fr)]">
        <LiveMap markers={markers} focus={focus} onSelect={(id) => { if (allIncidents.some((item) => item.id === id)) setSelectedId(id); }} subtitle={`Tshwane metro · ${allIncidents.length} active incident${allIncidents.length === 1 ? "" : "s"}`} />
        <section className="rounded-md border border-border bg-card" aria-labelledby="queue-title">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div><h2 id="queue-title" className="font-extrabold text-navy">Priority queue</h2><p className="text-xs text-muted-foreground">Sorted by risk and service impact</p></div>
              <SlidersHorizontal className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex gap-1 overflow-x-auto">{["All", "Critical", "High", "Medium"].map((item) => <Button key={item} size="sm" variant={filter === item ? "default" : "ghost"} onClick={() => setFilter(item)}>{item}</Button>)}</div>
          </div>
          <div className="max-h-[310px] overflow-y-auto">
            {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">{allIncidents.length === 0 ? "All quiet. No open incidents. Cut power in an area below, or file a report as a resident, and it appears here instantly." : "No incidents at this priority."}</p>}
            {filtered.map((incident) => (
              <button key={incident.id} onClick={() => setSelectedId(incident.id)} className={`w-full border-b border-border p-4 text-left transition-colors hover:bg-secondary ${selected?.id === incident.id ? "bg-secondary" : "bg-card"}`}>
                <div className="flex items-center justify-between gap-2"><PriorityBadge value={incident.priority} /><span className="text-[11px] font-bold text-muted-foreground">{incident.age}</span></div>
                <p className="mt-2 font-extrabold text-navy">{incident.place}</p>
                <p className="text-xs text-muted-foreground">{incident.detail}</p>
                <div className="mt-2 flex items-center justify-between text-xs"><span><Users className="mr-1 inline size-3" />{incident.people}</span><span className="font-bold text-primary">{dispatches[incident.id] ? `${dispatches[incident.id]?.tech.split(" ")[0]} · ${(dispatches[incident.id]?.stage ?? -1) < 0 ? "Assigned" : stageNames[dispatches[incident.id]?.stage ?? 0]} · ` : ""}{incident.id}{incident.source === "citizen" && " · Citizen report"}{incident.source === "auto" && " · Auto-detected"}</span></div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5"><NodeNetworkPanel /></div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.7fr)]">
        <section className="rounded-md border border-border bg-card p-5">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-destructive">Immediate assignment</p>
                  <h2 className="mt-1 text-xl font-extrabold text-navy">{selected.place}</h2>
                  <p className="text-sm text-muted-foreground">{selected.id} · {selected.people}</p>
                </div>
                <PriorityBadge value={selected.priority} />
              </div>
              {selectedReport ? <div className="mt-4"><ReportEvidence report={selectedReport} /></div> : selectedTicket ? <div className="mt-4"><AutoTicketDetail ticket={selectedTicket} /></div> : null}
              {linked.length > 0 && <div className="mt-4"><LinkedReports reports={linked} /></div>}
              {dispatched && <div className="mt-4"><JobFeed dispatch={dispatched} /></div>}
              <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                {crew.map(({ tech, status, job, online: isOnline }) => (
                  <button key={tech.name} disabled={status !== "Available"} onClick={() => setAssigned(tech.name)} className={`rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${assigned === tech.name ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary"}`}>
                    <div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-extrabold text-primary">{tech.initials}</span><span className="min-w-0 truncate text-xs font-extrabold">{tech.name}</span><span title={isOnline ? "Online" : "Offline"} className={`ml-auto size-2.5 shrink-0 rounded-full ${isOnline ? "bg-success" : "bg-muted-foreground/40"}`} /></div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{tech.skill} · {crewDistance(tech)}</p>
                    <p className="text-[11px] text-muted-foreground">{status === "On job" ? `On job · ${job?.id ?? ""}` : isOnline ? "Available · online" : "Available · offline"}</p>
                  </button>
                ))}
              </div>
              {assignedCrew && !assignedCrew.online && <p role="status" className="mt-3 flex items-start gap-2 rounded-md bg-warning-soft p-3 text-xs"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {assignedCrew.tech.name} is offline right now. The job is saved and appears on their dashboard as soon as they sign in.</p>}
              <Button className="mt-4 w-full" disabled={!assigned} onClick={dispatch}><Send />{assigned ? `Dispatch ${assigned}` : "Select an available technician"}</Button>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Immediate assignment</p>
              <h2 className="mt-2 text-xl font-extrabold text-navy">Nothing to assign</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">There are no open incidents. When the sensors detect an outage or a resident reports one, it appears in the queue and you can dispatch a crew from here.</p>
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-md border border-border bg-navy-gradient p-5 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-extrabold uppercase text-primary-foreground/60">Service target</p><h2 className="mt-1 text-lg font-extrabold">Restore power safely, faster</h2></div>
              <Gauge className="size-7 text-accent" />
            </div>
            <div className="mt-6 flex items-end gap-3"><span className="text-5xl font-extrabold">{summary.slaPct === undefined ? "—" : `${summary.slaPct}%`}</span><span className="pb-1 text-sm text-primary-foreground/70">SLA compliance</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary-foreground/15"><div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${summary.slaPct ?? 0}%` }} /></div>
            <p className="mt-4 text-xs text-primary-foreground/70">{summary.responded > 0 ? `Crews reached the site within 30 minutes in ${summary.slaPct}% of ${summary.responded} response${summary.responded === 1 ? "" : "s"}.` : "Fills in as crews reach the first outage."}</p>
          </section>
          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="font-extrabold text-navy">Crew status board</h2>
            <div className="mt-3 max-h-80 divide-y divide-border overflow-y-auto">
              {crew.map(({ tech, status, job, online: isOnline }) => {
                const stage = job ? (job.dispatch.stage ?? -1) : undefined;
                return (
                  <div key={tech.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-bold"><span className={`size-2 shrink-0 rounded-full ${isOnline ? "bg-success" : "bg-muted-foreground/40"}`} />{tech.name}</p>
                      <p className="text-xs text-muted-foreground">{tech.skill} · {tech.depot}{selected ? ` · ${crewDistance(tech)} from selected` : ""}</p>
                      {job && <p className="text-xs font-bold text-primary">{job.id} · {stage === undefined || stage < 0 ? "Assigned" : stageNames[stage]}</p>}
                    </div>
                    <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${status === "Available" ? "bg-success-soft text-success" : "bg-warning-soft text-foreground"}`}>{status}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
