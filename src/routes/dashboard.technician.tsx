import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BellRing, Camera, Check, CheckCircle2, ClipboardList, Clock3, ExternalLink, HardHat, Hourglass, LocateFixed, MessageSquareText, Navigation, Package, Play, Square, TimerReset, UsersRound, Wrench, X } from "lucide-react";

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
import { HelpRequestCard, RequestCrewPanel, SupportPanel } from "@/components/lesedi/crew-help";
import { crewPosition, crewRequestStore, helpersOf, openRequestFor, pendingFor, supportingFor } from "@/lib/crew-requests";
import { currentUser } from "@/lib/auth";
import { detectPosition, useWatchPosition, type GeoFix } from "@/lib/geo";
import { jobsFor, type Job } from "@/lib/metrics";
import { etaText, useRoute } from "@/lib/routing";
import { DECLINE_REASONS, STAGE, acceptJob, ago, crewStore, declineJob, dispatchStore, isHomeOutage, isResolved, reportStore, stageNames, toIncident, updateJob } from "@/lib/reports";
import { DEFAULT_PARTS_ERT, DEFAULT_REPAIR_ERT, PARTS_ERT_CHOICES, REPAIR_ERT_CHOICES, clockTime, currentErt, dueLabel, nextReportDue, type ErtChoice } from "@/lib/ert";
import { resolvedAt } from "@/lib/incidents";
import { useClock } from "@/lib/presence";
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
const EXTEND_CHOICES: ErtChoice[] = [
  { label: "30 minutes", ms: 30 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "2 hours", ms: 120 * 60 * 1000 },
  { label: "4 hours", ms: 240 * 60 * 1000 },
];

/** A labelled drop-down of time choices, for an ERT. */
function ErtSelect({ id, label, choices, value, onChange }: { id: string; label: string; choices: ErtChoice[]; value: number; onChange: (ms: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-muted-foreground">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
        {choices.map((choice) => <option key={choice.ms} value={choice.ms}>{choice.label}</option>)}
      </select>
    </div>
  );
}
const TSHWANE = { lat: -25.7479, lng: 28.2293 };

function TechnicianDashboard() {
  const [me, setMe] = useState<MockUser | null>(null);
  useEffect(() => setMe(currentUser()), []);
  const ME = me?.name ?? "";
  const base = technicians.find((tech) => tech.name === ME);

  const [photo, setPhoto] = useState(false);
  const [notes, setNotes] = useState("");
  // Starts empty and resets for each new job: a safety check the technician did not actually tick is not a
  // safety check, and it must not carry over from the last job.
  const [checked, setChecked] = useState<string[]>([]);
  const [partsErt, setPartsErt] = useState(DEFAULT_PARTS_ERT);
  const [repairErt, setRepairErt] = useState(DEFAULT_REPAIR_ERT);
  const [extendBy, setExtendBy] = useState(EXTEND_CHOICES[0]!.ms);
  const [noteError, setNoteError] = useState("");
  /** Answering a newly assigned job: the reason picked for declining it, and what is wrong with the answer. */
  const [declineReason, setDeclineReason] = useState("");
  const [answerError, setAnswerError] = useState("");
  /**
   * The outcome of an answer, shown at the top of the page because the job usually leaves this screen with
   * it: declined, or refused because the control centre withdrew or reassigned the job in the meantime.
   */
  const [answerResult, setAnswerResult] = useState<{ tone: "done" | "error"; text: string } | null>(null);
  const now = useClock(15000);
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
  const crewRequests = crewRequestStore.use();
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

  // A fresh checklist for each job: ticks from the last job must never look like progress on this one.
  useEffect(() => setChecked([]), [active?.id]);
  useEffect(() => setNoteError(""), [active?.id, stage]);
  useEffect(() => { setDeclineReason(""); setAnswerError(""); }, [active?.id]);
  /** The job is assigned but not accepted yet: it must be accepted or declined before any work starts. */
  const awaitingAnswer = Boolean(active) && stage === STAGE.assigned;
  const openedAt = active ? (active.ticket?.openedAt ?? active.report?.createdAt ?? active.dispatch.at) : 0;
  const ert = activeDispatch ? currentErt(openedAt, activeDispatch) : undefined;
  const reportDue = nextReportDue(activeDispatch);
  const reportLate = reportDue !== undefined && now > reportDue;
  const neededParts = Boolean(activeDispatch?.updates?.some((update) => update.stage === STAGE.awaitingParts));

  // Additional crew: requests waiting for my answer, a job I agreed to help on, and my own open request.
  const pendingHelp = useMemo(() => (ME ? pendingFor(ME, crewRequests, dispatches) : []), [ME, crewRequests, dispatches]);
  const support = useMemo(() => (ME ? supportingFor(ME, crewRequests, dispatches)[0] : undefined), [ME, crewRequests, dispatches]);
  const myRequest = active ? openRequestFor(active.id, crewRequests, dispatches) : undefined;
  const incidentById = (id: string): Incident | undefined => {
    const ticket = tickets.find((item) => item.id === id);
    if (ticket) return ticketToIncident(ticket);
    const report = reports.find((item) => item.id === id);
    return report ? toIncident(report, reports.filter((other) => other.duplicateOf === id).length) : undefined;
  };
  const supportIncident = support ? incidentById(support.jobId) : undefined;
  const supportTicket = support ? tickets.find((item) => item.id === support.jobId) : undefined;

  // The map and directions lead to my own job, or, with none, to the job I am helping on.
  const destination = activeIncident ?? supportIncident;
  const focusId = active?.id ?? (supportIncident ? support?.jobId : undefined);
  const focusReport = focusId ? reports.find((item) => item.id === focusId) : undefined;
  const focusTicket = focusId ? tickets.find((item) => item.id === focusId) : undefined;

  const shared = crewLocations[ME];
  const position = shared ?? (fix ? { lat: fix.lat, lng: fix.lng } : base ? { lat: base.lat, lng: base.lng } : TSHWANE);
  const route = useRoute(destination ? position : null, destination ?? null);
  // With a job of my own as well, the job I am helping on gets its own ETA.
  const supportRoute = useRoute(active && supportIncident ? position : null, active && supportIncident ? supportIncident : null);

  // With no job the map shows every open outage, so a technician can see where the trouble is.
  const cityIncidents = useMemo(
    () => [
      ...tickets.filter((ticket) => !ticket.restoredAt).map(ticketToIncident),
      ...reports.filter((report) => !report.duplicateOf && !isHomeOutage(report) && !isResolved(dispatches[report.id]?.stage)).map((report) => toIncident(report)),
    ],
    [tickets, reports, dispatches],
  );
  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = incidentMarkers(active ? openJobs.map(incidentOf) : supportIncident ? [supportIncident] : cityIncidents);
    if (support && !active) {
      const lead = crewPosition(support.by, crewLocations);
      if (lead) list.push({ id: `crew:${support.by}`, ...lead, kind: "crew", label: support.by, detail: "Asked for your help" });
    }
    for (const helper of myRequest ? helpersOf(myRequest) : []) {
      const at = crewPosition(helper.name, crewLocations);
      if (at) list.push({ id: `crew:${helper.name}`, ...at, kind: "crew", label: helper.name, detail: helper.arrivedAt ? "On site to help you" : "Coming to help you" });
    }
    list.push({ id: "me", lat: position.lat, lng: position.lng, kind: "me", label: "You are here", detail: simulating ? "Simulated drive (demo)" : usingSimulated ? "Simulated position (demo)" : fix ? `GPS accuracy ±${Math.round(fix.accuracy)} m` : "Last known position" });
    return list;
  }, [position.lat, position.lng, openJobs, cityIncidents, fix, simulating, usingSimulated, support, supportIncident?.id, myRequest, crewLocations]); // eslint-disable-line react-hooks/exhaustive-deps

  const distanceLabel = route ? `${route.distanceKm.toFixed(1)} km` : "…";
  const etaLabel = etaText(route, now);

  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const closedAt = (job: Job) => resolvedAt(job.dispatch) ?? job.dispatch.at;
  const doneToday = doneJobs.filter((job) => closedAt(job) >= startOfDay).sort((a, b) => closedAt(b) - closedAt(a));

  // A home outage is fixed at the resident's property, so the resident takes part at both ends of the visit.
  const household = Boolean(active?.report && isHomeOutage(active.report));
  const completion = activeDispatch?.completion;
  const awaitingResident = household && stage === STAGE.testing && completion !== undefined && !completion.answer;
  // At "En route" a job is moved on by the arrival check (and the resident's PIN), not by the plain continue button.
  const arrivalStep = Boolean(active) && stage === 1;
  const arrivalRadius = active?.ticket ? AREA_ARRIVAL_RADIUS_M : ARRIVAL_RADIUS_M;
  const residentFirst = active?.report?.reporter.split(" ")[0];
  const testingLabel = household ? (awaitingResident ? "Waiting for the resident…" : completion?.answer === "no" ? "Ask the resident to confirm again" : "Ask the resident to confirm") : "Mark resolved · power restored";

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
    // The drive is the technician heading out, so a job that is only assigned has to be accepted first.
    if (awaitingAnswer) {
      setAnswerError("Accept the job before you set off. Decline it if you cannot take it.");
      return;
    }
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
    if (active && stage === STAGE.accepted) updateJob(active.id, STAGE.enRoute, "On the way");
  }

  function accept() {
    if (!active) return;
    setAnswerError("");
    const problem = acceptJob(active.id, ME, notes.trim() || undefined);
    setAnswerResult(problem ? { tone: "error", text: `Could not accept ${active.id}. ${problem}` } : null);
    if (!problem) setNotes("");
  }

  function decline() {
    if (!active) return;
    if (!declineReason) {
      setAnswerError("Choose a reason, so the control centre knows who to send instead.");
      return;
    }
    setAnswerError("");
    const id = active.id;
    const problem = declineJob(id, ME, declineReason);
    setAnswerResult(problem ? { tone: "error", text: `Could not decline ${id}. ${problem}` } : { tone: "done", text: `You declined ${id} (${declineReason.toLowerCase()}). It is back with the control centre, who will send another crew.` });
    setDeclineReason("");
    if (!problem) setNotes("");
  }

  /** Moves the job to `next`, sending the work notes with it. `ertMs` sets a new ERT for the phase it starts. */
  function moveTo(next: number, ertMs?: number, fallbackNote?: string) {
    if (!active) return;
    updateJob(active.id, next, notes.trim() || fallbackNote, undefined, "technician", ertMs ? Date.now() + ertMs : undefined);
    setNotes("");
    setNoteError("");
    // In the simulation a resolved repair brings the power back, so the sensors see it return and close the outage.
    if (next === STAGE.resolved && active.ticket) restorePower(active.ticket.areaId);
  }

  function awaitParts() {
    if (!notes.trim()) {
      setNoteError("Say which parts are needed in the work notes, so the control centre can help get them.");
      return;
    }
    moveTo(STAGE.awaitingParts, partsErt);
  }

  /** At "Testing": a home outage is resolved by the resident's confirmation, so the technician asks for it. */
  function finishTesting() {
    if (!active) return;
    if (household) {
      requestCompletion(active.id);
      return;
    }
    moveTo(STAGE.resolved);
  }

  /** The 30-minute status report: same stage, with the technician's notes. */
  function sendStatusReport() {
    if (!active) return;
    updateJob(active.id, stage, notes.trim() || "Work continuing as planned.");
    setNotes("");
    setNoteError("");
  }

  function extendErt() {
    if (!active || ert === undefined) return;
    if (!notes.trim()) {
      setNoteError("Give a reason for the extension in the work notes. The resident is told the new time.");
      return;
    }
    updateJob(active.id, stage, notes.trim(), undefined, "technician", Math.max(Date.now(), ert) + extendBy);
    setNotes("");
    setNoteError("");
  }

  function toggle(item: string) {
    setChecked((current) => current.includes(item) ? current.filter((c) => c !== item) : [...current, item]);
  }

  const heading = activeIncident
    ? { title: `Active job · ${activeIncident.id}`, text: `${activeIncident.place} · ${activeIncident.detail}` }
    : support && supportIncident
    ? { title: `Helping ${support.by.split(" ")[0]} · ${supportIncident.id}`, text: `${supportIncident.place} · ${support.reason}` }
    : { title: "Standing by", text: `On shift${base ? ` · ${base.depot}` : ""}. You are visible to the control centre, and a new job appears here the moment it is dispatched.` };
  const googleMaps = destination ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}` : "";
  const waze = destination ? `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes` : "";

  return (
    <DashboardShell home="/dashboard/technician" user={me?.name ?? "Technician"} role={me?.title ?? "Field technician"}>
      <PageHeading eyebrow="Technician" title={heading.title} text={heading.text} action={<span className={`rounded-full px-3 py-2 text-xs font-extrabold ${simulating || usingSimulated ? "bg-warning-soft" : fix ? "bg-success-soft text-success" : "bg-warning-soft"}`}>{simulating ? "SIMULATED DRIVE" : usingSimulated ? "SIMULATED POSITION" : fix ? "GPS ACTIVE" : gpsError ? "GPS OFF" : "LOCATING…"}</span>} />

      {answerResult && (
        <div role={answerResult.tone === "error" ? "alert" : "status"} className={`mb-5 flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${answerResult.tone === "error" ? "border-destructive bg-danger-soft" : "border-border bg-secondary"}`}>
          <p>{answerResult.text}</p>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Dismiss" onClick={() => setAnswerResult(null)}><X /></Button>
        </div>
      )}

      {pendingHelp.length > 0 && (
        <div className="mb-5 space-y-3">
          {pendingHelp.map((request) => {
            const target = incidentById(request.jobId);
            return target ? <HelpRequestCard key={request.id} request={request} me={ME} from={position} target={target} busyWith={active?.id} /> : null;
          })}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Shift summary">
        <Stat label="Jobs today" value={`${openJobs.length} open`} note={`${doneToday.length} completed today`} icon={ClipboardList} />
        <Stat label="ETA" value={destination && route ? clockTime(now + route.minutes * 60000) : "—"} note={destination ? (route ? `${route.minutes} min · ${distanceLabel} by road${route.source === "estimate" ? " (estimate)" : ""}` : "Finding route…") : "No job assigned"} icon={Navigation} />
        <Stat label="Next status report" value={reportDue !== undefined ? clockTime(reportDue) : "—"} note={reportDue !== undefined ? `${dueLabel(reportDue, now)}${ert !== undefined ? ` · ERT ${clockTime(ert)}` : ""}` : activeDispatch ? "Job resolved" : "Standing by"} icon={Clock3} alert={reportLate} />
        <Stat label="Safety checks" value={active ? `${checked.length} / 4` : "—"} note={active ? "Complete before energising" : "No job assigned"} icon={HardHat} alert={Boolean(active) && checked.length < 4} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_.7fr]">
        <section className="space-y-5">
          <LiveMap markers={markers} route={route?.coords ?? null} heightClass="h-80" title={active ? "MY LIVE ROUTE MAP" : support ? "ROUTE TO HELP A COLLEAGUE" : "OPEN OUTAGES"} fitKey={focusId} subtitle={simulating ? "Simulated drive along the road route · the resident is watching this move" : usingSimulated ? "Using the simulated position · the resident sees you here" : fix ? "Your GPS position is shared with the control centre and customer" : gpsError ?? "Waiting for GPS…"} />

          {destination && (
            <>
              <div className="rounded-md border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-extrabold text-navy">Directions</h2>
                  <div className="flex flex-wrap gap-2">
                    {simulating
                      ? <Button size="sm" variant="outline" className="min-h-11" onClick={stopSimulation}><Square /> Stop simulation</Button>
                      : <Button size="sm" variant="outline" className="min-h-11" disabled={!route || route.coords.length < 2 || awaitingAnswer} title={awaitingAnswer ? "Accept the job first" : undefined} onClick={startSimulation}><Play /> {usingSimulated ? "Drive again (demo)" : "Simulate drive (demo)"}</Button>}
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
                    <PriorityBadge value={destination.priority} />
                    {!active && support && <p className="mt-3 flex items-center gap-2 text-[10px] font-extrabold uppercase text-primary"><UsersRound className="size-4" /> {support.by}'s job · you are helping</p>}
                    <h2 className="mt-3 text-xl font-extrabold text-navy">{destination.place}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{destination.detail}</p>
                  </div>
                  <Navigation className="size-7 shrink-0 text-primary" />
                </div>
                {focusReport && <div className="mt-4"><ReportEvidence report={focusReport} /></div>}
                {focusTicket && <div className="mt-4"><AutoTicketDetail ticket={focusTicket} /></div>}
                <div className="mt-4"><LinkedReports reports={reports.filter((report) => report.duplicateOf === focusId)} /></div>
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
                  {doneToday.slice(0, 5).map((job) => <li key={job.id} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /><strong>{job.id}</strong> {job.ticket?.areaName ?? job.report?.address.split(",")[0] ?? "Outage location"} · {ago(closedAt(job))} ago</li>)}
                </ul>
              </>
            )}
          </div>
        </section>

        <div className="space-y-5">
        {active && activeDispatch && activeIncident && (
          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="font-extrabold text-navy">Update job progress</h2>
            <p className="mt-1 text-xs text-muted-foreground">The customer and control centre see each update instantly. Arrival is checked against your phone's GPS.{active.ticket ? " Resolving the job restores power in the simulation, and the sensors then confirm it." : ""}</p>

            {ert !== undefined && reportDue !== undefined && (
              <div className={`mt-4 rounded-md border p-3 text-sm ${reportLate || now > ert ? "border-destructive bg-danger-soft" : "border-border bg-secondary"}`} role="status">
                <p className="font-extrabold text-navy">ERT {clockTime(ert)} <span className="text-xs font-bold text-muted-foreground">· {dueLabel(ert, now)}</span></p>
                <p className="mt-1 text-xs">{reportLate ? <strong className="text-destructive">Status report overdue ({dueLabel(reportDue, now)}). Send one now.</strong> : <>Next status report due {clockTime(reportDue)} ({dueLabel(reportDue, now)}).</>} {stage === STAGE.awaitingParts ? "While waiting for parts, report when they arrive or extend the ERT." : stage === STAGE.repairing ? "Report when the repair is done, or extend the ERT if it is complex." : "Report every 30 minutes until the job is resolved."}</p>
              </div>
            )}

            <div className="mt-5 space-y-2">
              {stageNames.slice(0, STAGE.closed).map((item, index) => {
                const skipped = index === STAGE.awaitingParts && stage > index && !neededParts;
                const tone = index === stage ? "border-primary bg-secondary" : skipped ? "border-dashed border-border" : index < stage ? "border-success bg-success-soft" : "border-border";
                // A job only moves forward through its checks, so a stage cannot be tapped to skip them.
                return (
                  <div key={item} className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-3 text-left ${tone}`}>
                    <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${skipped ? "bg-muted text-muted-foreground" : index < stage ? "bg-success text-primary-foreground" : index === stage ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < stage && !skipped ? <Check className="size-4" /> : index + 1}</span>
                    <span className={`text-sm font-bold ${skipped ? "text-muted-foreground" : ""}`}>{item}{index === STAGE.awaitingParts && stage <= STAGE.onSite ? " (if needed)" : ""}</span>
                    {index === stage && <span className="ml-auto text-[10px] font-extrabold uppercase text-primary">Current</span>}
                    {skipped && <span className="ml-auto text-[10px] font-extrabold uppercase text-muted-foreground">Not needed</span>}
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
              <Textarea id="work-notes" className="mt-2 min-h-24" aria-invalid={Boolean(noteError)} placeholder="e.g. Fault found on the pole-top fuse, replacing now" value={notes} onChange={(e) => { setNotes(e.target.value); setNoteError(""); }} />
              {noteError && <p role="alert" className="mt-2 text-xs font-bold text-destructive">{noteError}</p>}
              <Button variant="outline" className="mt-3 w-full" onClick={() => setPhoto(!photo)}><Camera />{photo ? "Photo attached" : "Add site photo"}</Button>

              {awaitingAnswer && (
                <div className="mt-4 rounded-md border-2 border-primary bg-secondary p-3" aria-labelledby="answer-title">
                  <p id="answer-title" className="flex items-center gap-2 text-sm font-extrabold text-navy"><BellRing className="size-4 text-primary" /> New job · accept or decline</p>
                  <p className="mt-1 text-xs text-muted-foreground">Assigned {ago(activeDispatch.at)}{ago(activeDispatch.at) === "Just now" ? "" : " ago"} by the control centre. Accept to start, or decline with a reason and it goes straight back to the dispatcher for another crew.</p>
                  <Button className="mt-3 min-h-11 w-full" onClick={accept}><Check /> Accept job</Button>
                  <label htmlFor="decline-reason" className="mt-3 block text-xs font-bold text-muted-foreground">Can't take it? Why not?</label>
                  <select id="decline-reason" value={declineReason} aria-invalid={Boolean(answerError) && !declineReason} onChange={(event) => { setDeclineReason(event.target.value); setAnswerError(""); }} className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
                    <option value="">Choose a reason…</option>
                    {DECLINE_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                  </select>
                  <Button variant="outline" className="mt-2 min-h-11 w-full" onClick={decline}><X /> Decline job</Button>
                </div>
              )}
              {answerError && <p role="alert" className="mt-2 text-xs font-bold text-destructive">{answerError}</p>}
              {stage === STAGE.accepted && <Button className="mt-3 w-full" onClick={() => moveTo(STAGE.enRoute, undefined, "On the way")}><ArrowRight /> I'm on my way</Button>}
              {stage === STAGE.onSite && (
                <div className="mt-4 grid gap-3 rounded-md border border-border p-3">
                  <p className="text-sm font-extrabold text-navy">Fault assessed. What next?</p>
                  <ErtSelect id="repair-ert" label="Time needed for the repair" choices={REPAIR_ERT_CHOICES} value={repairErt} onChange={setRepairErt} />
                  <Button className="w-full" onClick={() => moveTo(STAGE.repairing, repairErt)}><Wrench /> Start repairs</Button>
                  <div className="border-t border-border pt-3">
                    <ErtSelect id="parts-ert" label="No parts on hand? When will they arrive?" choices={PARTS_ERT_CHOICES} value={partsErt} onChange={setPartsErt} />
                    <Button variant="outline" className="mt-2 w-full" onClick={awaitParts}><Package /> Awaiting parts</Button>
                  </div>
                </div>
              )}
              {stage === STAGE.awaitingParts && (
                <div className="mt-4 grid gap-3 rounded-md border border-border p-3">
                  <ErtSelect id="repair-ert" label="Parts are here. Time needed for the repair" choices={REPAIR_ERT_CHOICES} value={repairErt} onChange={setRepairErt} />
                  <Button className="w-full" onClick={() => moveTo(STAGE.repairing, repairErt, "Parts arrived")}><Wrench /> Parts arrived · start repairs</Button>
                </div>
              )}
              {stage === STAGE.repairing && <Button className="mt-3 w-full" onClick={() => moveTo(STAGE.testing, undefined, "Repair done, testing the supply")}><ArrowRight /> Repair done · start testing</Button>}
              {stage === STAGE.testing && <Button className="mt-3 w-full" disabled={awaitingResident} onClick={finishTesting}><CheckCircle2 /> {testingLabel}</Button>}
              {stage >= STAGE.resolved && <Button className="mt-3 w-full" disabled><CheckCircle2 /> Job resolved</Button>}

              {stage < STAGE.resolved && !arrivalStep && !awaitingAnswer && (
                <Button variant={reportLate ? "default" : "outline"} className="mt-3 w-full" onClick={sendStatusReport}><MessageSquareText /> Send status report</Button>
              )}
              {(stage === STAGE.awaitingParts || stage === STAGE.repairing) && (
                <details className="mt-3 rounded-md border border-border p-3">
                  <summary className="min-h-8 cursor-pointer text-sm font-bold">Need more time? Extend the ERT</summary>
                  <div className="mt-3"><ErtSelect id="extend-ert" label="Extend by" choices={EXTEND_CHOICES} value={extendBy} onChange={setExtendBy} /></div>
                  <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={extendErt}><TimerReset /> Extend ERT</Button>
                  <p className="mt-2 text-[11px] text-muted-foreground">The reason in your work notes goes to the control centre, and the resident is told the new time. Performance is still measured on the first ERT.</p>
                </details>
              )}
              {stage >= STAGE.accepted && stage < STAGE.resolved && <RequestCrewPanel jobId={active.id} me={ME} target={activeIncident} request={myRequest} crewLocations={crewLocations} now={now} />}
            </div>
          </section>
        )}
        {support && supportIncident && <SupportPanel request={support} me={ME} target={supportIncident} route={active ? supportRoute : route} getPosition={currentPosition} radiusM={supportTicket ? AREA_ARRIVAL_RADIUS_M : ARRIVAL_RADIUS_M} />}
        {!active && !support && (
          <section className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-3"><Hourglass className="size-6 text-primary" aria-hidden="true" /><h2 className="font-extrabold text-navy">Standing by</h2></div>
            <p className="mt-3 text-sm text-muted-foreground">No job is assigned to you. When the control centre dispatches one, it appears here straight away and you get a notification, even if this tab is in the background.</p>
            <p className="mt-3 rounded-md bg-secondary p-3 text-xs">Your position is shared with the control centre while this page is open, so the dispatcher can see you are online and how close you are to an outage.</p>
          </section>
        )}
        </div>
      </div>
    </DashboardShell>
  );
}
