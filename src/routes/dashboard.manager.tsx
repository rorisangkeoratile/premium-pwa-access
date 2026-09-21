import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Download, ShieldCheck, Wallet, Wrench, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardShell, PageHeading, Stat } from "@/components/lesedi/shell";
import { LiveMap, crewMarkers, incidentMarkers } from "@/components/lesedi/live-map";
import { depotNames, mockUsers, technicians, type MockUser } from "@/components/lesedi/data";
import { currentUser } from "@/lib/auth";
import { followStore } from "@/lib/incidents";
import { crewStatus, formatDuration, incidentRows, jobsFor, summarise, SLA_RESPONSE_MS } from "@/lib/metrics";
import { areas, ticketStore, ticketToIncident } from "@/lib/nodes";
import { onlineEmails, useClock, usePresence } from "@/lib/presence";
import { crewStore, dispatchStore, reportStore, toIncident } from "@/lib/reports";

export const Route = createFileRoute("/dashboard/manager")({
  head: () => ({
    meta: [
      { title: "Department manager dashboard — LesediLink" },
      { name: "description", content: "Departmental oversight: SLA performance, recurring outage hotspots, budget tracking and workforce planning." },
      { property: "og:title", content: "Department manager dashboard — LesediLink" },
      { property: "og:description", content: "Track performance, spend and crew capacity across the electricity department." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManagerDashboard,
});

/** Sample history, shown so the charts have context. Everything marked live comes from the running simulation. */
const SAMPLE_RESPONSE_MINUTES = [34, 28, 31, 24, 26, 19];
const SAMPLE_HOTSPOTS: Record<string, number> = { soshanguve: 12, hatfield: 8, mamelodi: 6, cbd: 5, centurion: 3 };
const emailByName = new Map(mockUsers.map((user) => [user.name, user.email]));
const weekday = (time: number) => new Date(time).toLocaleDateString("en-ZA", { weekday: "short" });
const SLA_TARGET = 85;

function ManagerDashboard() {
  const [me, setMe] = useState<MockUser | null>(null);
  useEffect(() => setMe(currentUser()), []);
  const reports = reportStore.use();
  const dispatches = dispatchStore.use();
  const crewLocations = crewStore.use();
  const tickets = ticketStore.use();
  const follows = followStore.use();
  const presence = usePresence();
  const now = useClock(3000);
  const online = useMemo(() => onlineEmails(presence, now), [presence, now]);

  const rows = useMemo(() => incidentRows(reports, tickets, dispatches, follows), [reports, tickets, dispatches, follows]);
  const summary = useMemo(() => summarise(rows, now), [rows, now]);
  const crew = useMemo(
    () => technicians.map((tech) => ({ tech, ...crewStatus(tech.name, reports, tickets, dispatches), online: online.has(emailByName.get(tech.name) ?? ""), jobs: jobsFor(tech.name, reports, tickets, dispatches) })),
    [reports, tickets, dispatches, online],
  );

  const markers = useMemo(
    () => [
      ...incidentMarkers([...tickets.filter((ticket) => !ticket.restoredAt).map(ticketToIncident), ...reports.filter((report) => !report.duplicateOf && dispatches[report.id]?.stage !== 4).map((report) => toIncident(report))]),
      ...crewMarkers(crew.map((item) => ({ ...item.tech, status: `${item.status}${item.online ? " · online" : " · offline"}` })), crewLocations),
    ],
    [reports, tickets, dispatches, crewLocations, crew],
  );

  // Last seven days: six of sample history, then today from the live simulation.
  const todayMinutes = summary.avgResponseMs === undefined ? undefined : Math.round((summary.avgResponseMs / 60000) * 10) / 10;
  const trend = [...SAMPLE_RESPONSE_MINUTES.map((value, index) => ({ label: weekday(now - (6 - index) * 86400000), value: value as number | undefined, live: false })), { label: "Today", value: todayMinutes, live: true }];
  const trendMax = Math.max(40, ...trend.map((item) => item.value ?? 0));

  const hotspots = areas
    .map((area) => {
      const live = rows.filter((row) => row.areaId === area.id).length;
      return { name: area.name, sample: SAMPLE_HOTSPOTS[area.id] ?? 0, live };
    })
    .sort((a, b) => b.sample + b.live - (a.sample + a.live));
  const hotspotMax = Math.max(1, ...hotspots.map((item) => item.sample + item.live));

  const performance = [...crew].sort((a, b) => b.jobs.done.length - a.jobs.done.length || Number(b.online) - Number(a.online));
  const depots = depotNames.map((depot) => {
    const members = crew.filter((item) => item.tech.depot === depot);
    const busy = members.filter((item) => item.status === "On job").length;
    const share = busy / members.length;
    return { depot, total: members.length, busy, online: members.filter((item) => item.online).length, state: share >= 1 ? { label: "At capacity", tone: "bg-danger-soft text-destructive" } : share >= 0.5 ? { label: "Stretched", tone: "bg-warning-soft text-foreground" } : { label: "Spare capacity", tone: "bg-success-soft text-success" } };
  });

  function exportReport() {
    const minutes = (from: number, to: number | undefined) => (to === undefined ? "" : String(Math.round((to - from) / 600) / 100));
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const lines = [
      ["Incident", "Source", "Place", "Priority", "Opened", "Minutes to crew on site", "Minutes to resolution", "Technician", "Residents affected", "Flags"].map(cell).join(","),
      ...rows.map((row) => [row.id, row.source === "auto" ? "Sensor" : row.home ? "Resident (home)" : "Resident", row.place, row.priority, new Date(row.openedAt).toISOString(), minutes(row.openedAt, row.respondedAt), minutes(row.openedAt, row.closedAt), row.tech ?? "", row.affected, row.flags].map(cell).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `lesedilink-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell home="/dashboard/manager" user={me?.name ?? "Manager"} role={me?.title ?? "Department manager"}>
      <PageHeading eyebrow="Department manager" title="Network intelligence" text="Live performance from the running simulation, with sample history for context" action={<Button variant="outline" onClick={exportReport}><Download /> Export report (CSV)</Button>} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Live performance">
        <Stat label="Outages today" value={String(summary.openedToday)} note={`${summary.open} still open · live`} icon={Zap} alert={summary.open > 0} />
        <Stat label="Response time" value={formatDuration(summary.avgResponseMs)} note={`Target: under ${SLA_RESPONSE_MS / 60000} min · live`} icon={Clock3} />
        <Stat label="Resolution time" value={formatDuration(summary.avgResolutionMs)} note={summary.resolved > 0 ? `${summary.resolved} resolved · live` : "Nothing resolved yet · live"} icon={Wrench} />
        <Stat label="SLA compliance" value={summary.slaPct === undefined ? "—" : `${summary.slaPct}%`} note={`Target: ${SLA_TARGET}% · live`} icon={ShieldCheck} alert={summary.slaPct !== undefined && summary.slaPct < SLA_TARGET} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div><h2 className="font-extrabold text-navy">Response time trend</h2><p className="text-xs text-muted-foreground">Average minutes for a crew to reach the site · earlier days are sample history, today is live</p></div>
            <Activity className="size-5 text-primary" />
          </div>
          <div className="mt-8 flex h-56 items-end gap-3 border-b border-l border-border px-4">
            {trend.map((item, index) => (
              <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-bold">{item.value === undefined ? "—" : `${item.value}m`}</span>
                <div className={`w-full max-w-12 rounded-t transition-[height] duration-500 ${item.live ? "bg-accent" : "bg-primary"}`} style={{ height: `${((item.value ?? 0) / trendMax) * 85}%`, minHeight: item.value === undefined ? 0 : 3 }} />
                <span className={`text-[10px] ${item.live ? "font-extrabold text-primary" : "text-muted-foreground"}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </section>
        <LiveMap markers={markers} heightClass="h-64 xl:h-[280px]" subtitle={`${summary.open} open incident${summary.open === 1 ? "" : "s"} and ${crew.filter((item) => item.online).length} crews online across Tshwane`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Recurring hotspots</h2>
          <p className="text-xs text-muted-foreground">Sample history plus outages in this simulation</p>
          <div className="mt-4 space-y-4">
            {hotspots.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-xs"><span className="font-bold">{item.name}</span><span className="text-muted-foreground">{item.sample} past{item.live > 0 ? ` + ${item.live} live` : ""}</span></div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-accent" style={{ width: `${(item.sample / hotspotMax) * 100}%` }} />
                  <div className="h-full bg-destructive transition-[width] duration-500" style={{ width: `${(item.live / hotspotMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Technician performance</h2>
          <p className="text-xs text-muted-foreground">Live: jobs completed and time to reach the site</p>
          <div className="mt-3 max-h-80 divide-y divide-border overflow-y-auto">
            {performance.map((item, index) => {
              const arrivals = rows.filter((row) => row.tech === item.tech.name && row.respondedAt !== undefined);
              const average = arrivals.length > 0 ? arrivals.reduce((sum, row) => sum + ((row.respondedAt ?? 0) - row.openedAt), 0) / arrivals.length : undefined;
              return (
                <div key={item.tech.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <span className="text-xs font-extrabold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-bold"><span title={item.online ? "Online" : "Offline"} className={`size-2 shrink-0 rounded-full ${item.online ? "bg-success" : "bg-muted-foreground/40"}`} />{item.tech.name}</p>
                    <p className="text-xs text-muted-foreground">{item.jobs.done.length} completed · avg to site {formatDuration(average)}{item.job ? ` · on ${item.job.id}` : ""}</p>
                  </div>
                  <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${item.status === "Available" ? "bg-success-soft text-success" : "bg-warning-soft text-foreground"}`}>{item.status}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between"><h2 className="font-extrabold text-navy">Maintenance budget</h2><Wallet className="size-5 text-primary" /></div>
          <p className="text-xs text-muted-foreground">Sample figures. No finance system is connected yet.</p>
          <div className="mt-4 flex items-end gap-3"><span className="text-3xl font-extrabold text-navy">R 4.2m</span><span className="pb-1 text-xs text-muted-foreground">of R 6.0m spent this quarter</span></div>
          <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-full w-[70%] rounded-full bg-primary" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[["Emergency repairs", "R 1.9m"], ["Planned upgrades", "R 1.6m"], ["Overtime", "R 0.7m"]].map(([label, value]) => (
              <div key={label} className="rounded-md bg-secondary p-3"><p className="text-[10px] font-extrabold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-extrabold text-navy">{value}</p></div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Workforce planning</h2>
          <p className="mt-1 text-xs text-muted-foreground">Live crew capacity by depot</p>
          <div className="mt-4 space-y-3">
            {depots.map((item) => (
              <div key={item.depot} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border p-3">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{item.depot}</p><p className="text-xs text-muted-foreground">{item.total} crews · {item.busy} on a job · {item.online} online</p></div>
                <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${item.state.tone}`}>{item.state.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
