import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Camera, Check, CheckCircle2, ClipboardList, Clock3, ExternalLink, HardHat, Navigation, Play, Square, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardShell, Info, PageHeading, PriorityBadge, Stat } from "@/components/lesedi/shell";
import { LiveMap, incidentMarkers, type MapMarker } from "@/components/lesedi/live-map";
import { ReportEvidence } from "@/components/lesedi/report-evidence";
import { LinkedReports } from "@/components/lesedi/job-progress";
import { AutoTicketDetail } from "@/components/lesedi/node-network";
import { primaryIncident, technicians, type Incident } from "@/components/lesedi/data";
import { useWatchPosition } from "@/lib/geo";
import { useRoute } from "@/lib/routing";
import { ago, crewStore, dispatchStore, reportStore, stageNames, toIncident, updateJob, type OutageReport } from "@/lib/reports";
import { ticketStore, ticketToIncident, type AutoTicket } from "@/lib/nodes";

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

const ME = "Thabo Molefe";
const queue = [
  { id: "#LL-4819", place: "Pretoria CBD", priority: "High" as const, eta: "34 min" },
  { id: "#LL-4808", place: "Centurion", priority: "Low" as const, eta: "1 h 05" },
];
const safetyChecks = ["Isolation confirmed", "PPE worn", "Area barricaded", "Earth applied"];

type Job = { incident: Incident; report?: OutageReport; ticket?: AutoTicket };

function TechnicianDashboard() {
  const [localStage, setLocalStage] = useState(1);
  const [photo, setPhoto] = useState(false);
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState<string[]>(["Isolation confirmed"]);
  const [simulating, setSimulating] = useState(false);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulatingRef = useRef(false);

  // Real GPS: the device position is tracked continuously and shared with the control centre and the customer.
  const { fix, error: gpsError } = useWatchPosition(true);
  const reports = reportStore.use();
  const dispatches = dispatchStore.use();
  const tickets = ticketStore.use();
  const crewLocations = crewStore.use();
  const lastShared = useRef(0);

  useEffect(() => {
    if (!fix || simulatingRef.current || Date.now() - lastShared.current < 3000) return;
    lastShared.current = Date.now();
    crewStore.set({ ...crewStore.get(), [ME]: { ...fix, at: Date.now() } });
  }, [fix]);

  useEffect(() => () => { if (simTimer.current) clearInterval(simTimer.current); }, []);

  // Jobs the dispatcher assigned to me. Duplicate reports are merged into their master incident.
  const jobs = useMemo<Job[]>(() => [
    ...tickets.filter((ticket) => dispatches[ticket.id]?.tech === ME && !ticket.restoredAt).map((ticket) => ({ incident: ticketToIncident(ticket), ticket })),
    ...reports.filter((report) => !report.duplicateOf && dispatches[report.id]?.tech === ME).map((report) => ({ incident: toIncident(report), report })),
  ], [tickets, reports, dispatches]);
  const openJobs = jobs.filter((job) => (dispatches[job.incident.id]?.stage ?? -1) < 4).sort((a, b) => (dispatches[a.incident.id]?.at ?? 0) - (dispatches[b.incident.id]?.at ?? 0));
  const active = openJobs[0];
  const activeDispatch = active ? dispatches[active.incident.id] : undefined;
  const stage = active ? (activeDispatch?.stage ?? -1) : localStage;
  const target = active ? active.incident : primaryIncident;

  const shared = crewLocations[ME];
  const position = shared ?? (fix ? { lat: fix.lat, lng: fix.lng } : { lat: technicians[0]!.lat, lng: technicians[0]!.lng });
  const route = useRoute(position, target);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = incidentMarkers(active ? openJobs.map((job) => job.incident) : [primaryIncident]);
    list.push({ id: "me", lat: position.lat, lng: position.lng, kind: "me", label: "You are here", detail: fix && !simulating ? `GPS accuracy ±${Math.round(fix.accuracy)} m` : simulating ? "Simulated drive (demo)" : "Last known position" });
    return list;
  }, [position.lat, position.lng, openJobs.length, active?.incident.id, fix, simulating]); // eslint-disable-line react-hooks/exhaustive-deps

  const distanceLabel = route ? `${route.distanceKm.toFixed(1)} km` : "…";
  const etaLabel = route ? `${route.minutes} min` : "…";

  function stopSimulation() {
    if (simTimer.current) clearInterval(simTimer.current);
    simTimer.current = null;
    simulatingRef.current = false;
    setSimulating(false);
  }

  // Demo aid for desktops with no moving GPS: drive the marker along the real road route so the
  // customer's live-tracking map can be seen moving. On a phone, real GPS does this automatically.
  function startSimulation() {
    const path = route?.coords;
    if (!path || path.length < 2) return;
    simulatingRef.current = true;
    setSimulating(true);
    const stepSize = Math.max(1, Math.ceil(path.length / 45));
    let index = 0;
    simTimer.current = setInterval(() => {
      index = Math.min(path.length - 1, index + stepSize);
      const [lat, lng] = path[index]!;
      crewStore.set({ ...crewStore.get(), [ME]: { lat, lng, accuracy: 8, at: Date.now() } });
      if (index >= path.length - 1) stopSimulation();
    }, 1000);
    if (active && stage < 1) updateJob(active.incident.id, 1, "On the way");
  }

  function moveToStage(next: number) {
    if (active) {
      updateJob(active.incident.id, next, notes.trim() || undefined);
      setNotes("");
    } else {
      setLocalStage(next);
    }
  }

  function toggle(item: string) {
    setChecked((current) => current.includes(item) ? current.filter((c) => c !== item) : [...current, item]);
  }

  const heading = active ? { title: `Active job · ${active.incident.id}`, text: `${active.incident.place} · ${active.incident.detail}` } : { title: "Active job · #LL-4821", text: "Soshanguve Block H · Primary transformer failure" };
  const googleMaps = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`;
  const waze = `https://waze.com/ul?ll=${target.lat},${target.lng}&navigate=yes`;

  return (
    <DashboardShell home="/dashboard/technician" user="Thabo Molefe" role="Field technician · High voltage">
      <PageHeading eyebrow="Technician" title={heading.title} text={heading.text} action={<span className={`rounded-full px-3 py-2 text-xs font-extrabold ${simulating ? "bg-warning-soft" : fix ? "bg-success-soft text-success" : "bg-warning-soft"}`}>{simulating ? "SIMULATED DRIVE" : fix ? "GPS ACTIVE" : gpsError ? "GPS OFF" : "LOCATING…"}</span>} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Shift summary">
        <Stat label="Jobs today" value={`${openJobs.length + queue.length + (active ? 0 : 1)} open`} note="2 completed this shift" icon={ClipboardList} />
        <Stat label="Current ETA" value={etaLabel} note={route ? `${distanceLabel} by road${route.source === "estimate" ? " (estimate)" : ""}` : "Finding route…"} icon={Navigation} />
        <Stat label="Time on job" value={activeDispatch ? ago(activeDispatch.at) : "01:14"} note={activeDispatch ? "Since assigned" : "Assigned 01:14 ago"} icon={Clock3} />
        <Stat label="Safety checks" value={`${checked.length} / 4`} note="Complete before energising" icon={HardHat} alert={checked.length < 4} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_.7fr]">
        <section className="space-y-5">
          <LiveMap markers={markers} route={route?.coords ?? null} heightClass="h-80" title="MY LIVE ROUTE MAP" subtitle={simulating ? "Simulated drive along the road route" : fix ? "Your GPS position is shared with the control centre and customer" : gpsError ?? "Waiting for GPS…"} />

          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold text-navy">Directions</h2>
              <div className="flex flex-wrap gap-2">
                {simulating
                  ? <Button size="sm" variant="outline" className="min-h-11" onClick={stopSimulation}><Square /> Stop simulation</Button>
                  : <Button size="sm" variant="outline" className="min-h-11" disabled={!route || route.coords.length < 2} onClick={startSimulation}><Play /> Simulate drive (demo)</Button>}
                <Button asChild size="sm" variant="outline" className="min-h-11"><a href={googleMaps} target="_blank" rel="noreferrer"><ExternalLink /> Google Maps</a></Button>
                <Button asChild size="sm" variant="outline" className="min-h-11"><a href={waze} target="_blank" rel="noreferrer"><ExternalLink /> Waze</a></Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3"><Info label="Distance" value={distanceLabel} /><Info label="ETA" value={etaLabel} /><Info label="Route source" value={route ? (route.source === "osrm" ? "OpenStreetMap" : "Estimate") : "…"} /></div>
            {route && (
              <ol className="mt-4 max-h-56 space-y-1 overflow-y-auto text-sm">
                {route.steps.map((step, index) => (
                  <li key={index} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 odd:bg-secondary">
                    <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{index + 1}</span>
                    <span className="min-w-0 truncate">{step.text}</span>
                    <span className="text-xs text-muted-foreground">{step.meters >= 1000 ? `${(step.meters / 1000).toFixed(1)} km` : `${Math.round(step.meters)} m`}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">Routes come from OpenStreetMap road data (OSRM). They show the road, distance, time and turn list, but not live traffic or spoken guidance. Open Google Maps or Waze for voice navigation.</p>
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <PriorityBadge value={target.priority} />
                <h2 className="mt-3 text-xl font-extrabold text-navy">{active ? active.incident.place : "Main transformer · Block H"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{active ? active.incident.detail : "Sparks reported near the eastern enclosure. 5,240 residents affected."}</p>
              </div>
              <Navigation className="size-7 shrink-0 text-primary" />
            </div>
            {active?.report && <div className="mt-4"><ReportEvidence report={active.report} /></div>}
            {active?.ticket && <div className="mt-4"><AutoTicketDetail ticket={active.ticket} /></div>}
            {active && <div className="mt-4"><LinkedReports reports={reports.filter((report) => report.duplicateOf === active.incident.id)} /></div>}
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="font-extrabold text-navy">My job queue</h2>
            <div className="mt-3 divide-y divide-border">
              {[...openJobs.slice(1).map((job) => ({ id: job.incident.id, place: job.incident.place, priority: job.incident.priority, eta: "Assigned" })), ...queue].map((job) => (
                <div key={job.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-bold">{job.place}</p><p className="text-xs text-muted-foreground">{job.id} · {job.eta === "Assigned" ? job.eta : `ETA ${job.eta}`}</p></div>
                  <PriorityBadge value={job.priority} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Update job progress</h2>
          <p className="mt-1 text-xs text-muted-foreground">{active ? "The customer and control centre see each update instantly." : "No live job assigned yet. This is a practice job."}</p>
          <div className="mt-5 space-y-2">
            {stageNames.map((item, index) => (
              <button key={item} onClick={() => moveToStage(index)} className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-3 text-left ${index === stage ? "border-primary bg-secondary" : index < stage ? "border-success bg-success-soft" : "border-border"}`}>
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
            <Label htmlFor="work-notes">Work notes <span className="font-normal text-muted-foreground">(sent with the next update)</span></Label>
            <Textarea id="work-notes" className="mt-2 min-h-24" placeholder="e.g. Fault found on the pole-top fuse, replacing now" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button variant="outline" className="mt-3 w-full" onClick={() => setPhoto(!photo)}><Camera />{photo ? "Photo attached" : "Add site photo"}</Button>
            <Button className="mt-3 w-full" disabled={stage === 4} onClick={() => moveToStage(Math.min(4, stage + 1))}>{stage === 3 ? <><CheckCircle2 /> Mark job complete</> : stage === 4 ? <><CheckCircle2 /> Job complete</> : <><ArrowRight /> Save and continue</>}</Button>
            <Button variant="ghost" className="mt-2 w-full"><Zap /> Request additional crew</Button>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
