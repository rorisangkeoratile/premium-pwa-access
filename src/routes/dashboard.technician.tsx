import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Camera, Check, CheckCircle2, ClipboardList, Clock3, HardHat, Navigation, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CityMap, DashboardShell, Info, PageHeading, PriorityBadge, Stat } from "@/components/lesedi/shell";

export const Route = createFileRoute("/dashboard/technician")({
  head: () => ({
    meta: [
      { title: "Technician dashboard — LesediLink" },
      { name: "description", content: "Field technician job queue with navigation, progress stages, safety checks and photo evidence." },
      { property: "og:title", content: "Technician dashboard — LesediLink" },
      { property: "og:description", content: "Work your assigned outages and update the control centre in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TechnicianDashboard,
});

const stages = ["Accepted", "En route", "On site", "In progress", "Complete"];
const queue = [
  { id: "#LL-4821", place: "Soshanguve Block H", priority: "Critical" as const, eta: "12 min" },
  { id: "#LL-4819", place: "Pretoria CBD", priority: "High" as const, eta: "34 min" },
  { id: "#LL-4808", place: "Centurion", priority: "Low" as const, eta: "1 h 05" },
];
const safetyChecks = ["Isolation confirmed", "PPE worn", "Area barricaded", "Earth applied"];

function TechnicianDashboard() {
  const [stage, setStage] = useState(1);
  const [photo, setPhoto] = useState(false);
  const [checked, setChecked] = useState<string[]>(["Isolation confirmed"]);

  function toggle(item: string) {
    setChecked((current) => current.includes(item) ? current.filter((c) => c !== item) : [...current, item]);
  }

  return (
    <DashboardShell home="/dashboard/technician" user="Thabo Molefe" role="Field technician · High voltage">
      <PageHeading eyebrow="Technician" title="Active job · #LL-4821" text="Soshanguve Block H · Primary transformer failure" action={<span className="rounded-full bg-warning-soft px-3 py-2 text-xs font-extrabold">GPS ACTIVE</span>} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Shift summary">
        <Stat label="Jobs today" value="3 open" note="2 completed this shift" icon={ClipboardList} />
        <Stat label="Current ETA" value="12 min" note="5.2 km via M17" icon={Navigation} />
        <Stat label="Time on job" value="01:14" note="Assigned 01:14 ago" icon={Clock3} />
        <Stat label="Safety checks" value={`${checked.length} / 4`} note="Complete before energising" icon={HardHat} alert={checked.length < 4} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_.7fr]">
        <section className="space-y-5">
          <CityMap compact />
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <PriorityBadge value="Critical" />
                <h2 className="mt-3 text-xl font-extrabold text-navy">Main transformer · Block H</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sparks reported near the eastern enclosure. 5,240 residents affected.</p>
              </div>
              <Navigation className="size-7 shrink-0 text-primary" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><Info label="Distance" value="5.2 km" /><Info label="ETA" value="12 min" /><Info label="Assigned" value="01:14" /></div>
          </div>
          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="font-extrabold text-navy">My job queue</h2>
            <div className="mt-3 divide-y divide-border">
              {queue.map((job) => (
                <div key={job.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-bold">{job.place}</p><p className="text-xs text-muted-foreground">{job.id} · ETA {job.eta}</p></div>
                  <PriorityBadge value={job.priority} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Update job progress</h2>
          <p className="mt-1 text-xs text-muted-foreground">The citizen and control centre update instantly.</p>
          <div className="mt-5 space-y-2">
            {stages.map((item, index) => (
              <button key={item} onClick={() => setStage(index)} className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-3 text-left ${index === stage ? "border-primary bg-secondary" : index < stage ? "border-success bg-success-soft" : "border-border"}`}>
                <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${index < stage ? "bg-success text-primary-foreground" : index === stage ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < stage ? <Check className="size-4" /> : index + 1}</span>
                <span className="text-sm font-bold">{item}</span>
                {index === stage && <span className="ml-auto text-[10px] font-extrabold uppercase text-primary">Current</span>}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-extrabold text-navy">Safety checklist</p>
            <div className="mt-3 space-y-2">
              {safetyChecks.map((item) => {
                const done = checked.includes(item);
                return (
                  <button key={item} onClick={() => toggle(item)} aria-pressed={done} className={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 text-left text-sm font-bold ${done ? "border-success bg-success-soft" : "border-border"}`}>
                    <span className={`grid size-5 place-items-center rounded border ${done ? "border-success bg-success text-primary-foreground" : "border-input"}`}>{done && <Check className="size-3" />}</span>
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <Label htmlFor="work-notes">Work notes</Label>
            <Textarea id="work-notes" className="mt-2 min-h-24" placeholder="Describe the inspection or repair" />
            <Button variant="outline" className="mt-3 w-full" onClick={() => setPhoto(!photo)}><Camera />{photo ? "Photo attached" : "Add site photo"}</Button>
            <Button className="mt-3 w-full" onClick={() => setStage(Math.min(4, stage + 1))}>{stage === 4 ? <><CheckCircle2 /> Job complete</> : <><ArrowRight /> Save and continue</>}</Button>
            <Button variant="ghost" className="mt-2 w-full"><Zap /> Request additional crew</Button>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
