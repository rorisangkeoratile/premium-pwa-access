import { useEffect, useState, type FormEvent } from "react";
import { CircleCheck, CircleX, KeyRound, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GeoFix } from "@/lib/geo";
import type { CompletionCheck, Dispatch, OutageReport, VisitPin } from "@/lib/reports";
import {
  ARRIVAL_OVERRIDE_REASONS,
  OVERRIDE_REASONS,
  VISIT_PIN_LENGTH,
  VISIT_PIN_MAX_ATTEMPTS,
  answerCompletion,
  arrivalProblem,
  canSendAnotherPin,
  checkArrival,
  completeWithoutConfirmation,
  formatDistance,
  formatPin,
  issueVisitPin,
  pinState,
  recordArrival,
  recordManualArrival,
  startWithoutPin,
  verifyVisitPin,
} from "@/lib/visit";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * What a resident sees for their own home outage: the Visit PIN when the technician arrives, and the
 * "is your power back?" question when the technician says the repair is done.
 */
export function ResidentVisitCards({ report, dispatch }: { report: OutageReport; dispatch: Dispatch }) {
  const now = useNow();
  const stage = dispatch.stage ?? -1;
  const first = dispatch.tech.split(" ")[0] ?? "Your technician";
  const state = pinState(dispatch.pin, now);
  const showPin = stage <= 1 && Boolean(dispatch.arrival) && dispatch.pin !== undefined && state !== "used" && state !== "none";
  const asking = stage === 3 && dispatch.completion !== undefined && !dispatch.completion.answer;
  if (!showPin && !asking) return null;

  return (
    <div className="mt-5 space-y-5">
      {showPin && dispatch.pin && <PinCard report={report} pin={dispatch.pin} state={state} tech={dispatch.tech} first={first} now={now} />}
      {asking && (
        <section className="rounded-md border-2 border-accent bg-card p-5" aria-labelledby={`confirm-${report.id}`} aria-live="polite">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-primary"><CircleCheck className="size-4" /> Please confirm · {report.id}</p>
          <h2 id={`confirm-${report.id}`} className="mt-2 text-lg font-extrabold text-navy">Is your power back on?</h2>
          <p className="mt-1 text-sm text-muted-foreground">{first} says the repair at your property is finished. Please check, then tell us. If it is still off, the job stays open.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button size="lg" className="min-h-12" onClick={() => answerCompletion(report.id, "yes")}><CircleCheck /> Yes, my power is back</Button>
            <Button size="lg" variant="outline" className="min-h-12" onClick={() => answerCompletion(report.id, "no")}><CircleX /> No, it is still off</Button>
          </div>
        </section>
      )}
    </div>
  );
}

function PinCard({ report, pin, state, tech, first, now }: { report: OutageReport; pin: VisitPin; state: ReturnType<typeof pinState>; tech: string; first: string; now: number }) {
  const minutes = Math.max(1, Math.ceil((pin.expiresAt - now) / 60000));
  return (
    <section className="rounded-md border-2 border-primary bg-card p-5" aria-labelledby={`pin-${report.id}`} aria-live="polite">
      <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-primary"><KeyRound className="size-4" /> Visit PIN · {report.id}</p>
      <h2 id={`pin-${report.id}`} className="mt-2 text-lg font-extrabold text-navy">{tech} has arrived at your property</h2>
      {state === "active" ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Read this PIN out at your gate so they can start work. Only give it to a technician who shows you their LesediLink ID. Never share it by phone or message, or with anyone else.</p>
          <p className="mt-4 rounded-md bg-secondary py-4 text-center text-4xl font-extrabold tabular-nums tracking-[0.25em] text-navy">
            <span className="sr-only">{pin.code.split("").join(" ")}</span>
            <span aria-hidden="true">{formatPin(pin.code)}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Works for {minutes} more minute{minutes === 1 ? "" : "s"}. Three wrong tries lock it.</p>
        </>
      ) : (
        <p className="mt-2 rounded-md bg-warning-soft p-3 text-sm">This PIN {state === "locked" ? "was locked after three wrong tries" : "has expired"}. Ask {first} to send you a new one.</p>
      )}
    </section>
  );
}

type PanelProps = {
  jobId: string;
  dispatch: Dispatch;
  /** A home outage: the resident takes part with a PIN on arrival and a confirmation at the end. */
  household: boolean;
  residentFirst: string | undefined;
  target: { lat: number; lng: number };
  radiusM: number;
  /** The technician's position right now. Resolves to null when there is no usable GPS fix. */
  getPosition: () => Promise<GeoFix | null>;
  /** The technician's work notes, attached to the progress update this panel creates. */
  notes: string;
  onNotesUsed: () => void;
};

/** The technician's side of arrival (GPS check, then the resident's PIN for a home outage) and of waiting for the resident's confirmation. */
export function TechnicianVisitPanel(props: PanelProps) {
  const stage = props.dispatch.stage ?? -1;
  if (stage === 1) return <ArrivalStep {...props} />;
  if (stage === 3 && props.household && props.dispatch.completion) return <CompletionWait {...props} completion={props.dispatch.completion} />;
  return null;
}

function ArrivalStep({ jobId, dispatch, household, residentFirst, target, radiusM, getPosition, notes, onNotesUsed }: PanelProps) {
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState("");
  const place = household ? "the property" : "the outage area";

  async function arrive() {
    setChecking(true);
    setProblem("");
    const result = checkArrival(await getPosition(), target, radiusM);
    setChecking(false);
    if (result.status !== "ok") {
      setProblem(arrivalProblem(result, radiusM));
      return;
    }
    recordArrival(jobId, result.distanceM, household, notes.trim() || undefined);
    if (!household) onNotesUsed();
  }

  return (
    <div className="mt-5 rounded-md border border-border bg-secondary p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold text-navy"><MapPin className="size-4 text-primary" /> Arrival</p>
      {dispatch.arrival && household ? (
        <PinEntry jobId={jobId} pin={dispatch.pin} distanceM={dispatch.arrival.distanceM} residentFirst={residentFirst} notes={notes} onNotesUsed={onNotesUsed} />
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">Tap when you reach {place}. Your phone's GPS must place you within {formatDistance(radiusM)} of {household ? "the reported location" : "its centre"}.{household ? " The resident will then get a Visit PIN to read out to you." : ""}</p>
          <Button className="mt-3 min-h-12 w-full" onClick={arrive} disabled={checking}><MapPin /> {checking ? "Checking your position…" : "I've arrived"}</Button>
          {problem && <p role="alert" className="mt-3 text-sm font-bold text-destructive">{problem}</p>}
          {/* GPS can be missing or coarse (a laptop, a basement, a cloudy day), so it must never be the only way
              forward. Confirming by hand is allowed, recorded with a reason and flagged for the control centre. */}
          <OverrideForm
            summary="GPS not working? Confirm arrival yourself"
            action="Confirm I have arrived"
            reasons={ARRIVAL_OVERRIDE_REASONS}
            onConfirm={(reason) => {
              recordManualArrival(jobId, household, reason, notes.trim() || undefined);
              if (!household) onNotesUsed();
            }}
          />
        </>
      )}
    </div>
  );
}

function PinEntry({ jobId, pin, distanceM, residentFirst, notes, onNotesUsed }: { jobId: string; pin: VisitPin | undefined; distanceM: number; residentFirst: string | undefined; notes: string; onNotesUsed: () => void }) {
  const now = useNow();
  const state = pinState(pin, now);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const who = residentFirst ?? "the resident";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== VISIT_PIN_LENGTH) {
      setError(`Enter all ${VISIT_PIN_LENGTH} digits.`);
      return;
    }
    const result = verifyVisitPin(jobId, code, notes.trim() || undefined);
    if (result.status === "ok") {
      onNotesUsed();
      return;
    }
    setCode("");
    setError(result.status === "wrong" ? `That PIN is not right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.` : "");
  }

  const minutes = pin ? Math.max(1, Math.ceil((pin.expiresAt - now) / 60000)) : 0;
  const stateMessage = state === "locked" ? "This PIN is locked after three wrong tries." : state === "expired" ? "This PIN has expired." : "No PIN has been sent yet.";

  return (
    <div>
      <p className="mt-1 text-xs text-muted-foreground">GPS confirms you are {formatDistance(distanceM)} from the reported location. {who} can now see a Visit PIN in their app.</p>
      {state === "active" ? (
        <form onSubmit={submit} className="mt-3" noValidate>
          <label htmlFor="visit-pin" className="text-sm font-bold">Ask {who} for the Visit PIN</label>
          <Input
            id="visit-pin"
            value={code}
            onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, VISIT_PIN_LENGTH)); setError(""); }}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-invalid={Boolean(error)}
            placeholder="••••••"
            className="mt-2 h-14 bg-card text-center text-2xl font-extrabold tabular-nums tracking-[0.4em]"
          />
          {error && <p role="alert" className="mt-2 text-sm font-bold text-destructive">{error}</p>}
          <Button type="submit" className="mt-3 min-h-12 w-full"><KeyRound /> Confirm PIN and start</Button>
          <p className="mt-2 text-[11px] text-muted-foreground">{VISIT_PIN_MAX_ATTEMPTS - (pin?.attempts ?? 0)} tries left · expires in {minutes} min</p>
        </form>
      ) : (
        <div className="mt-3">
          <p role="alert" className="text-sm font-bold text-destructive">{stateMessage}</p>
          {canSendAnotherPin(pin)
            ? <Button className="mt-3 min-h-12 w-full" onClick={() => { issueVisitPin(jobId); setError(""); }}><KeyRound /> Send {who} a new PIN</Button>
            : <p className="mt-2 text-xs text-muted-foreground">No more PINs can be sent for this job. Use the option below if {who} cannot take part.</p>}
        </div>
      )}
      <OverrideForm summary={`${who} can't give the PIN?`} action="Start without the PIN" onConfirm={(reason) => { startWithoutPin(jobId, reason, notes.trim() || undefined); onNotesUsed(); }} />
    </div>
  );
}

function CompletionWait({ jobId, completion, residentFirst, notes, onNotesUsed }: PanelProps & { completion: CompletionCheck }) {
  const who = residentFirst ?? "The resident";
  return (
    <div className="mt-5 rounded-md border border-border bg-secondary p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold text-navy"><CircleCheck className="size-4 text-primary" /> Resident confirmation</p>
      {completion.answer === "no" ? (
        <p role="status" className="mt-1 text-sm font-bold text-destructive">{who} says the power is still off. Check the fault again, then ask them to confirm once it is fixed.</p>
      ) : (
        <p role="status" className="mt-1 text-xs text-muted-foreground">Waiting for {who} to confirm the power is back on. They have been asked in their app, and the job closes when they say yes.</p>
      )}
      <OverrideForm summary={`${who} can't confirm?`} action="Close without confirmation" onConfirm={(reason) => { completeWithoutConfirmation(jobId, reason, notes.trim() || undefined); onNotesUsed(); }} />
    </div>
  );
}

/** A way past a step that cannot be completed. The reason is recorded and the step is flagged for the control centre. */
function OverrideForm({ summary, action, onConfirm, reasons = OVERRIDE_REASONS }: { summary: string; action: string; onConfirm: (reason: string) => void; reasons?: readonly string[] }) {
  const [reason, setReason] = useState<string>(reasons[0] ?? "");
  return (
    <details className="mt-4 rounded-md border border-border bg-card p-3">
      <summary className="min-h-8 cursor-pointer text-sm font-bold">{summary}</summary>
      <label htmlFor="override-reason" className="mt-3 block text-xs font-bold text-muted-foreground">Why?</label>
      <select id="override-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
        {reasons.map((item) => <option key={item}>{item}</option>)}
      </select>
      <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => onConfirm(reason)}>{action}</Button>
      <p className="mt-2 text-[11px] text-muted-foreground">This is recorded and flagged for the control centre.</p>
    </details>
  );
}
