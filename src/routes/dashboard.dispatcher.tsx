import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, Gauge, Radio, Send, Siren, SlidersHorizontal, Users, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CityMap, DashboardShell, PageHeading, PriorityBadge, Stat } from "@/components/lesedi/shell";
import { incidents, primaryIncident, technicians } from "@/components/lesedi/data";

export const Route = createFileRoute("/dashboard/dispatcher")({
  head: () => ({
    meta: [
      { title: "Dispatcher dashboard — LesediLink" },
      { name: "description", content: "Control-centre view of every Tshwane outage with priority queue, duplicate detection and crew dispatch." },
      { property: "og:title", content: "Dispatcher dashboard — LesediLink" },
      { property: "og:description", content: "Triage incidents and dispatch the nearest available crew in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DispatcherDashboard,
});

function DispatcherDashboard() {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(primaryIncident);
  const [assigned, setAssigned] = useState<string | null>(null);
  const filtered = useMemo(() => filter === "All" ? incidents : incidents.filter((item) => item.priority === filter), [filter]);

  return (
    <DashboardShell home="/dashboard/dispatcher" user="Naledi Mokoena" role="Senior dispatcher">
      <PageHeading eyebrow="Dispatcher" title="Control centre" text="City-wide electricity response overview" action={<Button><Radio /> Live operations</Button>} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Live response metrics">
        <Stat label="Active outages" value="21" note="4 since last hour" icon={Siren} alert />
        <Stat label="People affected" value="8,430" note="Across 7 service areas" icon={Users} />
        <Stat label="Avg. response" value="18 min" note="↓ 12% from last week" icon={Clock3} />
        <Stat label="Crews available" value="12 / 18" note="67% field capacity" icon={Wrench} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,.75fr)]">
        <CityMap />
        <section className="rounded-md border border-border bg-card" aria-labelledby="queue-title">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div><h2 id="queue-title" className="font-extrabold text-navy">Priority queue</h2><p className="text-xs text-muted-foreground">Sorted by risk and service impact</p></div>
              <SlidersHorizontal className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex gap-1 overflow-x-auto">{["All", "Critical", "High", "Medium"].map((item) => <Button key={item} size="sm" variant={filter === item ? "default" : "ghost"} onClick={() => setFilter(item)}>{item}</Button>)}</div>
          </div>
          <div className="max-h-[310px] overflow-y-auto">
            {filtered.map((incident) => (
              <button key={incident.id} onClick={() => setSelected(incident)} className={`w-full border-b border-border p-4 text-left transition-colors hover:bg-secondary ${selected.id === incident.id ? "bg-secondary" : "bg-card"}`}>
                <div className="flex items-center justify-between gap-2"><PriorityBadge value={incident.priority} /><span className="text-[11px] font-bold text-muted-foreground">{incident.age}</span></div>
                <p className="mt-2 font-extrabold text-navy">{incident.place}</p>
                <p className="text-xs text-muted-foreground">{incident.detail}</p>
                <div className="mt-2 flex items-center justify-between text-xs"><span><Users className="mr-1 inline size-3" />{incident.people} affected</span><span className="font-bold text-primary">{incident.id}</span></div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.7fr)]">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase text-destructive">Immediate assignment</p>
              <h2 className="mt-1 text-xl font-extrabold text-navy">{selected.place}</h2>
              <p className="text-sm text-muted-foreground">{selected.id} · {selected.people} consumers affected</p>
            </div>
            <PriorityBadge value={selected.priority} />
          </div>
          <div className="mt-4 rounded-md bg-danger-soft p-3 text-sm"><AlertTriangle className="mr-2 inline size-4 text-destructive" /><strong>Possible duplicate:</strong> report #LL-4818 logged 420m away.</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {technicians.map((tech) => (
              <button key={tech.name} disabled={tech.status !== "Available"} onClick={() => setAssigned(tech.name)} className={`rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${assigned === tech.name ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary"}`}>
                <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-secondary text-[10px] font-extrabold text-primary">{tech.initials}</span><span className="text-xs font-extrabold">{tech.name}</span></div>
                <p className="mt-2 text-[11px] text-muted-foreground">{tech.skill} · {tech.distance}</p>
              </button>
            ))}
          </div>
          <Button className="mt-4 w-full" disabled={!assigned} onClick={() => setAssigned(null)}><Send />{assigned ? `Dispatch ${assigned}` : "Select an available technician"}</Button>
        </section>

        <div className="space-y-5">
          <section className="rounded-md border border-border bg-navy p-5 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-extrabold uppercase text-primary-foreground/60">Service target</p><h2 className="mt-1 text-lg font-extrabold">Restore power safely, faster</h2></div>
              <Gauge className="size-7 text-accent" />
            </div>
            <div className="mt-6 flex items-end gap-3"><span className="text-5xl font-extrabold">87%</span><span className="pb-1 text-sm text-primary-foreground/70">SLA compliance</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary-foreground/15"><div className="h-full w-[87%] bg-accent" /></div>
            <p className="mt-4 text-xs text-primary-foreground/70">14 of 16 resolved incidents met today's response target.</p>
          </section>
          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="font-extrabold text-navy">Crew status board</h2>
            <div className="mt-3 divide-y divide-border">
              {technicians.map((tech) => (
                <div key={tech.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-bold">{tech.name}</p><p className="text-xs text-muted-foreground">{tech.skill} · {tech.distance}</p></div>
                  <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${tech.status === "Available" ? "bg-success-soft text-success" : "bg-warning-soft text-foreground"}`}>{tech.status}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
