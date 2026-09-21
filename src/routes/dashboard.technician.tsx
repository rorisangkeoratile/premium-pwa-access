import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Camera, Check, CheckCircle2, ClipboardList, Clock3, ExternalLink, HardHat, Hourglass, LocateFixed, Navigation, Play, Square, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardShell, Info, PageHeading, PriorityBadge, Stat } from "@/components/lesedi/shell";
import { LiveMap, incidentMarkers, type MapMarker } from "@/components/lesedi/live-map";
import { ReportEvidence } from "@/components/lesedi/report-evidence";
import { LinkedReports } from "@/components/lesedi/job-progress";
import { AutoTicketDetail } from "@/components/lesedi/node-network";
import { technicians, type Incident, type MockUser } from "@/components/lesedi/data";
import { TechnicianVisitPanel } from "@/components/lesedi/visit-pin";
import { currentUser } from "@/lib/auth";
import { detectPosition, useWatchPosition, type GeoFix } from "@/lib/geo";
import { jobsFor, type Job } from "@/lib/metrics";
import { useRoute } from "@/lib/routing";
import { ago, crewStore, dispatchStore, isHomeOutage, reportStore, stageNames, toIncident, updateJob } from "@/lib/reports";
import { restorePower, ticketStore, ticketToIncident } from "@/lib/nodes";
import { AREA_ARRIVAL_RADIUS_M, ARRIVAL_RADIUS_M, requestCompletion } from "@/lib/visit";

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

const safetyChecks = ["Isolation confirmed", "PPE worn", "Area barricaded", "Earth applied"];
const TSHWANE = { lat: -25.7479, lng: 28.2293 };

function TechnicianDashboard() {
  const [me, setMe] = useState<MockUser | null>(null);
  useEffect(() => setMe(currentUser()), []);
  const ME = me?.name ?? "";
  const base = technicians.find((tech) => tech.name === ME);

  const [photo, setPhoto] = useState(false);
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState<string[]>(["Isolation confirmed"]);
  const [simulating, setSimulating] = useState(false);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulatingRef = useRef(false);
  /**
   * True once the demo drive has moved this technician, and it stays true after the drive ends. A laptop's
   * "GPS" is really a coarse network lookup that can be kilometres out, and it used to overwrite the driven
   * position a few seconds later, which moved the marker back and made the arrival check refuse. While this
   * is on, the driven position is the technician's position, until they switch back to real GPS.
   */
  const [usingSimulated, setUsingSimulated] = useState(false);
  const simulatedPosition = useRef(false);

  // Real GPS: the device position is tracked continuously and shared with the control centre and the customer.
  const { fix, error: gpsError } = useWatchPosition(true);
  const reports = reportStore.use();
  const dispatches = dispatchStore.use();
  const tickets = ticketStore.use();
  const crewLocations = crewStore.use();
  const lastShared = useRef(0);

  useEffect(() => {
    if (!ME || !fix || simulatingRef.current || simulatedPosition.current || Date.now() - lastShared.current < 3000) return;
    lastShared.current = Date.now();
    crewStore.set({ ...crewStore.get(), [ME]: { ...fix, at: Date.now() } });
  }, [fix, ME]);

  useEffect(() => () => { if (simTimer.current) clearInterval(simTimer.current); }, []);

  // Jobs the dispatcher assigned to me. Duplicate reports are merged into their master incident.
  const { open: openJobs, done: doneJobs } = useMemo(() => jobsFor(ME, reports, tickets, dispatches), [ME, reports, tickets, dispatches]);
  const incidentOf = (job: Job): Incident => (job.ticket ? ticketToIncident(job.ticket) : toIncident(job.report!, reports.filter((other) => other.duplicateOf === job.id).length));
  const active = openJobs[0];
  const activeIncident = active ? incidentOf(active) : undefined;
  const activeDispatch = active?.dispatch;
  const stage = activeDispatch ? (activeDispatch.stage ?? -1) : -1;

  const shared = crewLocations[ME];
  const position = shared ?? (fix ? { lat: fix.lat, lng: fix.lng } : base ? { lat: base.lat, lng: base.lng } : TSHWANE);
  const route = useRoute(activeIncident ? position : null, activeIncident ?? null);

  // With no job the map shows every open outage, so a technician can see where the trouble is.
  const cityIncidents = useMemo(
    () => [
      ...tickets.filter((ticket) => !ticket.restoredAt).map(ticketToIncident),
      ...reports.filter((report) => !report.duplicateOf && !isHomeOutage(report) && dispatches[report.id]?.stage !== 4).map((report) => toIncident(report)),
    ],
    [tickets, reports, dispatches],
  );
  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = incidentMarkers(active ? openJobs.map(incidentOf) : cityIncidents);
    list.push({ id: "me", lat: position.lat, lng: position.lng, kind: "me", label: "You are here", detail: simulating ? "Simulated drive (demo)" : usingSimulated ? "Simulated position (demo)" : fix ? `GPS accuracy ±${Math.round(fix.accuracy)} m` : "Last known position" });
    return list;
  }, [position.lat, position.lng, openJobs, cityIncidents, fix, simulating, usingSimulated]); // eslint-disable-line react-hooks/exhaustive-deps

  const distanceLabel = route ? `${route.distanceKm.toFixed(1)} km` : "…";
  const etaLabel = route ? `${route.minutes} min` : "…";

  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const closedAt = (job: Job) => job.dispatch.updates?.filter((update) => update.stage === 4).at(-1)?.at ?? job.dispatch.at;
  const doneToday = doneJobs.filter((job) => closedAt(job) >= startOfDay).sort((a, b) => closedAt(b) - closedAt(a));

  // A home outage is fixed at the resident's property, so the resident takes part at both ends of the visit.
  const household = Boolean(active?.report && isHomeOutage(active.report));
  const completion = activeDispatch?.completion;
  const awaitingResident = household && stage === 3 && completion !== undefined && !completion.answer;
  // At "En route" a job is moved on by the arrival check (and the resident's PIN), not by the plain continue button.
  const arrivalStep = Boolean(active) && stage === 1;
  const arrivalRadius = active?.ticket ? AREA_ARRIVAL_RADIUS_M : ARRIVAL_RADIUS_M;
  const residentFirst = active?.report?.reporter.split(" ")[0];
  const primaryLabel = stage === 4 ? "Job complete" : stage === 3 ? (household ? (awaitingResident ? "Waiting for the resident…" : completion?.answer === "no" ? "Ask the resident to confirm again" : "Ask the resident to confirm") : "Mark job complete") : "Save and continue";

  /**
   * Where the technician is right now, for the arrival check. The GPS watch above is already running and
   * its latest fix is the position the resident and control centre see, so that is what gets checked. A
   * one-off reading is only requested when the watch has no usable fix.
   */
  async function currentPosition(): Promise<GeoFix | null> {
    const latest = crewStore.get()[ME];
    if (simulatedPosition.current && latest) return { lat: latest.lat, lng: latest.lng, accuracy: latest.accuracy };
    if (fix && !gpsError) return fix;
    if (latest) return { lat: latest.lat, lng: latest.lng, accuracy: latest.accuracy };
    try {
      return await detectPosition();
    } catch {
      return fix;
    }
  }

  /** Stops the drive. The driven position stays put until the technician asks for real GPS again. */
  function stopSimulation() {
    if (simTimer.current) clearInterval(simTimer.current);
    simTimer.current = null;
    simulatingRef.current = false;
    setSimulating(false);
  }

  function useRealGps() {
    stopSimulation();
    simulatedPosition.current = false;
    setUsingSimulated(false);
    lastShared.current = 0;
  }

  // Demo aid for desktops with no moving GPS: drive the marker along the real road route so the
  // customer's live-tracking map can be seen moving. On a phone, real GPS does this automatically.
  function startSimulation() {
    const path = route?.coords;
    if (!path || path.length < 2 || !ME) return;
    simulatingRef.current = true;
    simulatedPosition.current = true;
    setUsingSimulated(true);
    setSimulating(true);
    const stepSize = Math.max(1, Math.ceil(path.length / 45));
    let index = 0;
    simTimer.current = setInterval(() => {
      index = Math.min(path.length - 1, index + stepSize);
      const [lat, lng] = path[index]!;
      crewStore.set({ ...crewStore.get(), [ME]: { lat, lng, accuracy: 8, at: Date.now() } });
      if (index >= path.length - 1) stopSimulation();
    }, 1000);
    if (active && stage < 1) updateJob(active.id, 1, "On the way");
  }

  function advance() {
    if (!active) return;
    // A home outage is closed by the resident's confirmation, so at the last step the technician asks for it.
    if (stage === 3 && household) {
      requestCompletion(active.id);
      return;
    }
    const next = Math.min(4, stage + 1);
    updateJob(active.id, next, notes.trim() || undefined);
    setNotes("");
    // In the simulation a finished repair brings the power back, so the sensors see it return and close the outage.
    if (next === 4 && active.ticket) restorePower(active.ticket.areaId);
  }

  function toggle(item: string) {
    setChecked((current) => current.includes(item) ? current.filter((c) => c !== item) : [...current, item]);
  }

  const heading = activeIncident
    ? { title: `Active job · ${activeIncident.id}`, text: `${activeIncident.place} · ${activeIncident.detail}` }
    : { title: "Standing by", text: `On shift${base ? ` · ${base.depot}` : ""}. You are visible to the control centre, and a new job appears here the moment it is dispatched.` };
  const googleMaps = activeIncident ? `https://www.google.com/maps/dir/?api=1&destination=${activeIncident.lat},${activeIncident.lng}` : "";
  const waze = activeIncident ? `https://waze.com/ul?ll=${activeIncident.lat},${activeIncident.lng}&navigate=yes` : "";

  return (
    <DashboardShell home="/dashboard/technician" user={me?.name ?? "Technician"} role={me?.title ?? "Field technician"}>
      <PageHeading eyebrow="Technician" title={heading.title} text={heading.text} action={<span className={`rounded-full px-3 py-2 text-xs font-extrabold ${simulating || usingSimulated ? "bg-warning-soft" : fix ? "bg-success-soft text-success" : "bg-warning-soft"}`}>{simulating ? "SIMULATED DRIVE" : usingSimulated ? "SIMULATED POSITION" : fix ? "GPS ACTIVE" : gpsError ? "GPS OFF" : "LOCATING…"}</span>} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Shift summary">
        <Stat label="Jobs today" value={`${openJobs.length} open`} note={`${doneToday.length} completed today`} icon={ClipboardList} />
        <Stat label="Current ETA" value={active ? etaLabel : "—"} note={active ? (route ? `${distanceLabel} by road${route.source === "estimate" ? " (estimate)" : ""}` : "Finding route…") : "No job assigned"} icon={Navigation} />
        <Stat label="Time on job" value={activeDispatch ? ago(activeDispatch.at) : "—"} note={activeDispatch ? "Since assigned" : "Standing by"} icon={Clock3} />
        <Stat label="Safety checks" value={`${checked.length} / 4`} note="Complete before energising" icon={HardHat} alert={Boolean(active) && checked.length < 4} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_.7fr]">
        <section className="space-y-5">
          <LiveMap markers={markers} route={route?.coords ?? null} heightClass="h-80" title={active ? "MY LIVE ROUTE MAP" : "OPEN OUTAGES"} subtitle={simulating ? "Simulated drive along the road route · the resident is watching this move" : usingSimulated ? "Using the simulated position · the resident sees you here" : fix ? "Your GPS position is shared with the control centre and customer" : gpsError ?? "Waiting for GPS…"} />

          {active && activeIncident && (
            <>
              <div className="rounded-md border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-extrabold text-navy">Directions</h2>
                  <div className="flex flex-wrap gap-2">
                    {simulating
                      ? <Button size="sm" variant="outline" className="min-h-11" onClick={stopSimulation}><Square /> Stop simulation</Button>
                      : <Button size="sm" variant="outline" className="min-h-11" disabled={!route || route.coords.length < 2} onClick={startSimulation}><Play /> {usingSimulated ? "Drive again (demo)" : "Simulate drive (demo)"}</Button>}
                    {usingSimulated && !simulating && <Button size="sm" variant="outline" className="min-h-11" onClick={useRealGps}><LocateFixed /> Use my real GPS</Button>}
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
                    <PriorityBadge value={activeIncident.priority} />
                    <h2 className="mt-3 text-xl font-extrabold text-navy">{activeIncident.place}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{activeIncident.detail}</p>
                  </div>
                  <Navigation className="size-7 shrink-0 text-primary" />
                </div>
                {active.report && <div className="mt-4"><ReportEvidence report={active.report} /></div>}
                {active.ticket && <div className="mt-4"><AutoTicketDetail ticket={active.ticket} /></div>}
                <div className="mt-4"><LinkedReports reports={reports.filter((report) => report.duplicateOf === active.id)} /></div>
              </div>
            </>
          )}

          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="font-extrabold text-navy">My job queue</h2>
            <div className="mt-3 divide-y divide-border">
              {openJobs.length <= 1 && <p className="py-3 text-sm text-muted-foreground">{active ? "Nothing else waiting behind this job." : "No jobs assigned to you right now."}</p>}
              {openJobs.slice(1).map((job) => {
                const incident = incidentOf(job);
                return (
                  <div key={job.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{incident.place}</p><p className="text-xs text-muted-foreground">{job.id} · Assigned {ago(job.dispatch.at)} ago</p></div>
                    <PriorityBadge value={incident.priority} />
                  </div>
                );
              })}
            </div>
            {doneToday.length > 0 && (
              <>
                <p className="mt-4 text-[10px] font-extrabold uppercase text-muted-foreground">Completed today</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {doneToday.slice(0, 5).map((job) => <li key={job.id} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /><strong>{job.id}</strong> {job.ticket?.areaName ?? job.report?.address.split(",")[0] ?? "Pinned location"} · {ago(closedAt(job))} ago</li>)}
                </ul>
              </>
            )}
          </div>
        </section>

        {active && activeDispatch ? (
          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="font-extrabold text-navy">Update job progress</h2>
            <p className="mt-1 text-xs text-muted-foreground">The customer and control centre see each update instantly. Arrival is checked against your phone's GPS.{active.ticket ? " Completing the job restores power in the simulation, and the sensors then confirm it." : ""}</p>
            <div className="mt-5 space-y-2">
              {stageNames.map((item, index) => {
                const tone = index === stage ? "border-primary bg-secondary" : index < stage ? "border-success bg-success-soft" : "border-border";
                // A job only moves forward through its checks, so a stage cannot be tapped to skip them.
                return (
                  <div key={item} className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-3 text-left ${tone}`}>
                    <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${index < stage ? "bg-success text-primary-foreground" : index === stage ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < stage ? <Check className="size-4" /> : index + 1}</span>
                    <span className="text-sm font-bold">{item}</span>
                    {index === stage && <span className="ml-auto text-[10px] font-extrabold uppercase text-primary">Current</span>}
                  </div>
                );
              })}
            </div>

            <TechnicianVisitPanel jobId={active.id} dispatch={activeDispatch} household={household} residentFirst={residentFirst} target={activeIncident ?? TSHWANE} radiusM={arrivalRadius} getPosition={currentPosition} notes={notes} onNotesUsed={() => setNotes("")} />

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
              {!arrivalStep && <Button className="mt-3 w-full" disabled={stage === 4 || awaitingResident} onClick={advance}>{stage >= 3 ? <CheckCircle2 /> : <ArrowRight />}{primaryLabel}</Button>}
              <Button variant="ghost" className="mt-2 w-full"><Zap /> Request additional crew</Button>
            </div>
          </section>
        ) : (
          <section className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-3"><Hourglass className="size-6 text-primary" aria-hidden="true" /><h2 className="font-extrabold text-navy">Standing by</h2></div>
            <p className="mt-3 text-sm text-muted-foreground">No job is assigned to you. When the control centre dispatches one, it appears here straight away and you get a notification, even if this tab is in the background.</p>
            <p className="mt-3 rounded-md bg-secondary p-3 text-xs">Your position is shared with the control centre while this page is open, so the dispatcher can see you are online and how close you are to an outage.</p>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
