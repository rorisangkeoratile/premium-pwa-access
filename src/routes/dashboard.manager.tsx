import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Clock3, Download, ShieldCheck, Wallet, Wrench, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CityMap, DashboardShell, PageHeading, Stat } from "@/components/lesedi/shell";
import { technicians } from "@/components/lesedi/data";

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

function ManagerDashboard() {
  const [range, setRange] = useState("7 days");

  return (
    <DashboardShell home="/dashboard/manager" user="Kagiso Phiri" role="Department manager · Energy & Electricity">
      <PageHeading eyebrow="Department manager" title="Network intelligence" text="Performance, recurring faults, spend and resource planning" action={<Button variant="outline" onClick={() => alert("Report prepared for download.")}><Download /> Export report</Button>} />

      <div className="mb-5 flex gap-2">{["24 hours", "7 days", "30 days"].map((item) => <Button key={item} size="sm" variant={range === item ? "default" : "outline"} onClick={() => setRange(item)}>{item}</Button>)}</div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Outages today" value="45" note="↓ 8% week on week" icon={Zap} />
        <Stat label="Response time" value="22 min" note="Target: under 30 min" icon={Clock3} />
        <Stat label="Resolution time" value="1h 45m" note="18 min faster" icon={Wrench} />
        <Stat label="SLA compliance" value="87%" note="Target: 85%" icon={ShieldCheck} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div><h2 className="font-extrabold text-navy">Response time trend</h2><p className="text-xs text-muted-foreground">Average minutes to dispatch · {range}</p></div>
            <Activity className="size-5 text-primary" />
          </div>
          <div className="mt-8 flex h-56 items-end gap-3 border-b border-l border-border px-4">
            {[34, 28, 31, 24, 26, 19, 22].map((value, index) => (
              <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-bold">{value}m</span>
                <div className="w-full max-w-12 rounded-t bg-primary" style={{ height: `${value * 2.4}%` }} />
                <span className="text-[10px] text-muted-foreground">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span>
              </div>
            ))}
          </div>
        </section>
        <CityMap compact />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Recurring hotspots</h2>
          <div className="mt-4 space-y-4">
            {[["Soshanguve", "12 outages", "92%"], ["Hatfield", "8 outages", "67%"], ["Mamelodi", "6 outages", "48%"], ["Menlyn", "4 outages", "31%"]].map(([area, count, width]) => (
              <div key={area}>
                <div className="flex justify-between text-xs"><span className="font-bold">{area}</span><span className="text-muted-foreground">{count}</span></div>
                <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Technician performance</h2>
          <div className="mt-3 divide-y divide-border">
            {technicians.map((tech, index) => (
              <div key={tech.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
                <span className="text-xs font-extrabold text-muted-foreground">0{index + 1}</span>
                <div className="min-w-0"><p className="truncate text-sm font-bold">{tech.name}</p><p className="text-xs text-muted-foreground">{12 - index * 2} jobs completed</p></div>
                <span className="text-sm font-extrabold text-success">{96 - index * 3}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between"><h2 className="font-extrabold text-navy">Maintenance budget</h2><Wallet className="size-5 text-primary" /></div>
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
          <p className="mt-1 text-xs text-muted-foreground">Crew capacity against forecast demand</p>
          <div className="mt-4 space-y-3">
            {[["Soshanguve depot", "6 crews", "Understaffed", "bg-danger-soft text-destructive"], ["Pretoria central", "8 crews", "Balanced", "bg-success-soft text-success"], ["Centurion depot", "4 crews", "Spare capacity", "bg-warning-soft text-foreground"]].map(([depot, crews, status, tone]) => (
              <div key={depot} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border p-3">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{depot}</p><p className="text-xs text-muted-foreground">{crews} on shift</p></div>
                <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${tone}`}>{status}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-4 w-full">Approve additional shift</Button>
        </section>
      </div>
    </DashboardShell>
  );
}
