import { useState } from "react";
import { Check, LogOut, MapPin, Phone, Siren, UsersRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Info, PriorityBadge } from "@/components/lesedi/shell";
import { mockUsers, technicians, type Incident } from "@/components/lesedi/data";
import { CREW_REASONS, MAX_CREW, cancelCrewRequest, crewArrived, crewPosition, declinedBy, helpersOf, isFilled, leaveCrew, requestCrew, respondToCrew, type CrewRequest } from "@/lib/crew-requests";
import { clockTime } from "@/lib/ert";
import type { GeoFix } from "@/lib/geo";
import { ago, type CrewLocation } from "@/lib/reports";
import { etaText, useRoute, type LatLng, type RouteInfo } from "@/lib/routing";
import { arrivalProblem, checkArrival, formatDistance } from "@/lib/visit";

const first = (name: string) => name.split(" ")[0] ?? name;
const phoneOf = (name: string) => mockUsers.find((user) => user.name === name)?.phone;

const distanceText = (route: RouteInfo | null) => (route ? `${route.distanceKm.toFixed(1)} km by road${route.source === "estimate" ? " (estimate)" : ""}` : "Working out the route…");

/** The ask, on a fellow technician's dashboard: where, why, how far away they are, and Accept or Decline. */
export function HelpRequestCard({ request, me, from, target, busyWith }: { request: CrewRequest; me: string; from: LatLng; target: Incident; busyWith?: string | undefined }) {
  const route = useRoute(from, target);
  const [refused, setRefused] = useState(false);
  const joined = helpersOf(request).length;

  function answer(choice: "accepted" | "declined") {
    if (!respondToCrew(request.id, me, choice)) setRefused(true);
  }

  return (
    <section className="rounded-md border-2 border-destructive bg-card p-5" aria-labelledby={`help-${request.id}`} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-destructive"><Siren className="size-4" /> Crew needed · {ago(request.at)}{ago(request.at) === "Just now" ? "" : " ago"}</p>
          <h2 id={`help-${request.id}`} className="mt-1 text-lg font-extrabold text-navy">{request.by} needs {request.needed} more technician{request.needed === 1 ? "" : "s"}</h2>
          <p className="text-sm text-muted-foreground">{request.reason}</p>
        </div>
        <PriorityBadge value={target.priority} />
      </div>
      <p className="mt-3 text-sm font-bold">{target.place}</p>
      <p className="text-xs text-muted-foreground">{target.detail} · {request.jobId}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Info label="ETA" value={etaText(route)} />
        <Info label="Distance" value={distanceText(route)} />
        <Info label="Accepted so far" value={`${joined} of ${request.needed}`} />
      </div>
      {busyWith && <p className="mt-3 rounded-md bg-warning-soft p-2 text-xs">You are on job {busyWith}. If you accept, the control centre sees that you went to help.</p>}
      {refused ? (
        <p role="status" className="mt-3 text-sm font-bold text-muted-foreground">This request is no longer open. Someone else may have filled it.</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button size="lg" className="min-h-12" onClick={() => answer("accepted")}><Check /> Accept · show me the way</Button>
          <Button size="lg" variant="outline" className="min-h-12" onClick={() => answer("declined")}><X /> Decline</Button>
        </div>
      )}
    </section>
  );
}

function HelperRow({ name, arrivedAt, from, target }: { name: string; arrivedAt?: number | undefined; from: LatLng | null; target: LatLng }) {
  const route = useRoute(arrivedAt ? null : from, arrivedAt ? null : target);
  const phone = phoneOf(name);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card p-2 text-xs">
      <span className="min-w-0">
        <strong>{name}</strong> · {arrivedAt ? `on site since ${clockTime(arrivedAt)}` : route ? `on the way · ETA ${etaText(route)} (${route.distanceKm.toFixed(1)} km)` : "on the way"}
      </span>
      {phone && <a className="inline-flex min-h-8 items-center gap-1 font-bold text-primary underline" href={`tel:${phone.replace(/\s/g, "")}`}><Phone className="size-3.5" /> {phone}</a>}
    </li>
  );
}

/**
 * The requester's side, at the bottom of their job panel: ask for help, then see who accepted, their ETA,
 * who declined, and cancel once there are enough hands.
 */
export function RequestCrewPanel({ jobId, me, target, request, crewLocations, now }: { jobId: string; me: string; target: LatLng; request: CrewRequest | undefined; crewLocations: Record<string, CrewLocation>; now: number }) {
  const [reason, setReason] = useState<string>(CREW_REASONS[0]);
  const [needed, setNeeded] = useState(1);

  if (!request) {
    return (
      <details className="mt-3 rounded-md border border-border p-3">
        <summary className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-bold"><UsersRound className="size-4 text-primary" /> Request additional crew</summary>
        <label htmlFor="crew-reason" className="mt-3 block text-xs font-bold text-muted-foreground">Why do you need help?</label>
        <select id="crew-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
          {CREW_REASONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <label htmlFor="crew-needed" className="mt-3 block text-xs font-bold text-muted-foreground">How many more technicians?</label>
        <select id="crew-needed" value={needed} onChange={(event) => setNeeded(Number(event.target.value))} className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
          {Array.from({ length: MAX_CREW }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
        <Button className="mt-3 min-h-11 w-full" onClick={() => requestCrew(jobId, me, reason, needed)}><UsersRound /> Send to fellow technicians</Button>
        <p className="mt-2 text-[11px] text-muted-foreground">Every other technician gets an alert and can accept or decline. Anyone who accepts gets directions to this job, and you see their ETA here.</p>
      </details>
    );
  }

  const helpers = helpersOf(request);
  const declined = declinedBy(request);
  const waiting = Math.max(0, technicians.length - 1 - Object.keys(request.responses).length);
  const full = isFilled(request);
  return (
    <div className={`mt-3 rounded-md border p-3 ${full ? "border-success bg-success-soft" : "border-primary bg-secondary"}`} role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-extrabold text-navy"><UsersRound className="size-4 text-primary" /> Additional crew · {helpers.length} of {request.needed} accepted</p>
      <p className="mt-1 text-xs text-muted-foreground">{request.reason} · asked {ago(request.at)}{ago(request.at) === "Just now" ? "" : " ago"}.{full ? " Your crew is complete." : ` Waiting on ${waiting} technician${waiting === 1 ? "" : "s"}.`}</p>
      {helpers.length > 0 && (
        <ul className="mt-3 space-y-1">
          {helpers.map((helper) => <HelperRow key={helper.name} name={helper.name} arrivedAt={helper.arrivedAt} from={crewPosition(helper.name, crewLocations, now)} target={target} />)}
        </ul>
      )}
      {declined.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Declined: {declined.map(first).join(", ")}</p>}
      <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={() => cancelCrewRequest(request.id)}>{full ? "Done · close the request" : "Cancel the request"}</Button>
    </div>
  );
}

/**
 * The helper's side once they accepted: which job, ETA, an arrival check against their GPS, the requester's
 * number, and a way to back out. Directions are on the main map and directions card.
 */
export function SupportPanel({ request, me, target, route, getPosition, radiusM }: { request: CrewRequest; me: string; target: Incident; route: RouteInfo | null; getPosition: () => Promise<GeoFix | null>; radiusM: number }) {
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState("");
  const mine = request.responses[me];
  const phone = phoneOf(request.by);

  async function arrive() {
    setChecking(true);
    setProblem("");
    const result = checkArrival(await getPosition(), target, radiusM);
    setChecking(false);
    if (result.status === "ok") crewArrived(request.id, me, result.distanceM);
    else setProblem(arrivalProblem(result, radiusM));
  }

  return (
    <section className="rounded-md border-2 border-primary bg-card p-5" aria-labelledby={`support-${request.id}`}>
      <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-primary"><UsersRound className="size-4" /> Additional crew · {request.jobId}</p>
      <h2 id={`support-${request.id}`} className="mt-1 text-lg font-extrabold text-navy">Helping {request.by}</h2>
      <p className="text-sm text-muted-foreground">{target.place} · {request.reason}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Info label="ETA" value={mine?.arrivedAt ? "On site" : etaText(route)} />
        <Info label="Distance" value={mine?.arrivedAt ? (mine.distanceM !== undefined && mine.distanceM >= 0 ? `Arrived · ${formatDistance(mine.distanceM)} from the site` : "Arrived") : route ? `${route.distanceKm.toFixed(1)} km by road` : "…"} />
      </div>
      {phone && <a className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary underline" href={`tel:${phone.replace(/\s/g, "")}`}><Phone className="size-4" /> Call {first(request.by)} · {phone}</a>}
      {mine?.arrivedAt ? (
        <p role="status" className="mt-3 rounded-md bg-success-soft p-3 text-sm">You arrived at {clockTime(mine.arrivedAt)}. {first(request.by)} leads the job and updates its progress. This ends for you when the job is resolved.</p>
      ) : (
        <>
          <Button className="mt-3 min-h-12 w-full" onClick={arrive} disabled={checking}><MapPin /> {checking ? "Checking your position…" : "I've arrived to help"}</Button>
          {problem && (
            <div className="mt-3">
              <p role="alert" className="text-sm font-bold text-destructive">{problem}</p>
              <Button variant="outline" className="mt-2 min-h-11 w-full" onClick={() => crewArrived(request.id, me, -1)}>GPS not working? Confirm I have arrived</Button>
            </div>
          )}
        </>
      )}
      <Button variant="ghost" className="mt-2 min-h-11 w-full" onClick={() => leaveCrew(request.id, me)}><LogOut /> I can no longer help</Button>
    </section>
  );
}
