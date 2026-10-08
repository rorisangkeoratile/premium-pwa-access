import { useEffect, useState, type FormEvent } from "react";
import { CircleCheck, CircleX, KeyRound, MapPin, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GeoFix } from "@/lib/geo";
import { STAGE, type CompletionCheck, type Dispatch, type OutageReport, type VisitPin } from "@/lib/reports";
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
 * What a resident sees for their own home outage: a box to enter the technician's Visit code when they arrive,
 * and the "is your power back?" question when the technician says the repair is done.
 */
export function ResidentVisitCards({ report, dispatch }: { report: OutageReport; dispatch: Dispatch }) {
  const now = useNow();
  const stage = dispatch.stage ?? -1;
  const first = dispatch.tech.split(" ")[0] ?? "Your technician";
  const state = pinState(dispatch.pin, now);
  const showCode = stage <= 1 && Boolean(dispatch.arrival) && dispatch.pin !== undefined && state !== "used" && state !== "none";
  const asking = stage === STAGE.testing && dispatch.completion !== undefined && !dispatch.completion.answer;
  if (!showCode && !asking) return null;

  return (
    <div className="mt-5 space-y-5">
      {showCode && dispatch.pin && <CodeEntryCard report={report} pin={dispatch.pin} state={state} tech={dispatch.tech} first={first} now={now} />}
      {asking && (
        <section className="rounded-md border-2 border-accent bg-card p-5" aria-labelledby={`confirm-${report.id}`} aria-live="polite">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-primary"><CircleCheck className="size-4" /> Please confirm · {report.id}</p>
          <h2 id={`confirm-${report.id}`} className="mt-2 text-lg font-extrabold text-navy">Is your power back on?</h2>
          <p className="mt-1 text-sm text-muted-foreground">{first} has finished the repair and is testing the supply at your property. Please check, then tell us. If it is still off, the repair carries on.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button size="lg" className="min-h-12" onClick={() => answerCompletion(report.id, "yes")}><CircleCheck /> Yes, my power is back</Button>
            <Button size="lg" variant="outline" className="min-h-12" onClick={() => answerCompletion(report.id, "no")}><CircleX /> No, it is still off</Button>
          </div>
        </section>
      )}
    </div>
  );
}

function CodeEntryCard({ report, pin, state, tech, first, now }: { report: OutageReport; pin: VisitPin; state: ReturnType<typeof pinState>; tech: string; first: string; now: number }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const minutes = Math.max(1, Math.ceil((pin.expiresAt - now) / 60000));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== VISIT_PIN_LENGTH) {
      setError(`Enter all ${VISIT_PIN_LENGTH} digits.`);
      return;
    }
    const result = verifyVisitPin(report.id, code);
    setCode("");
    setError(result.status === "wrong" ? `That code does not match. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left. Do not let them in until it matches.` : "");
  }

  return (
    <section className="rounded-md border-2 border-primary bg-card p-5" aria-labelledby={`pin-${report.id}`} aria-live="polite">
      <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-primary"><ShieldCheck className="size-4" /> Check your technician · {report.id}</p>
      <h2 id={`pin-${report.id}`} className="mt-2 text-lg font-extrabold text-navy">{tech} says they are at your property</h2>
      {state === "active" ? (
        <form onSubmit={submit} className="mt-1" noValidate>
          <p className="text-sm text-muted-foreground">Before you open the gate, ask {first} for the 6-digit Visit code in their LesediLink app and enter it here. If it matches, they are the technician the city sent you.</p>
          <label htmlFor={`visit-code-${report.id}`} className="mt-4 block text-sm font-bold">Visit code from {first}</label>
          <Input
            id={`visit-code-${report.id}`}
            value={code}
            onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, VISIT_PIN_LENGTH)); setError(""); }}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            aria-invalid={Boolean(error)}
            placeholder="••••••"
            className="mt-2 h-14 bg-card text-center text-2xl font-extrabold tabular-nums tracking-[0.4em]"
          />
          {error && <p role="alert" className="mt-2 text-sm font-bold text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="mt-3 min-h-12 w-full"><ShieldCheck /> Check the code</Button>
          <p className="mt-2 text-xs text-muted-foreground">{VISIT_PIN_MAX_ATTEMPTS - pin.attempts} tries left · works for {minutes} more minute{minutes === 1 ? "" : "s"}. If they cannot show you a code, do not let them in and call the city.</p>
        </form>
      ) : (
        <p className="mt-2 rounded-md bg-warning-soft p-3 text-sm">This code {state === "locked" ? "was locked after three wrong tries" : "has expired"}. Ask {first} to make a new one in their app, then enter it here.</p>
      )}
    </section>
  );
}

type PanelProps = {
  jobId: string;
  dispatch: Dispatch;
  /** A home outage: the resident checks the technician with a Visit code on arrival and confirms at the end. */
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

/** The technician's side of arrival (GPS check, then the Visit code the resident checks for a home outage) and of waiting for the resident's confirmation. */
export function TechnicianVisitPanel(props: PanelProps) {
  const stage = props.dispatch.stage ?? -1;
  if (stage === 1) return <ArrivalStep {...props} />;
  if (stage === STAGE.testing && props.household && props.dispatch.completion) return <CompletionWait {...props} completion={props.dispatch.completion} />;
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
        <CodeShow jobId={jobId} pin={dispatch.pin} distanceM={dispatch.arrival.distanceM} residentFirst={residentFirst} notes={notes} onNotesUsed={onNotesUsed} />
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">Tap when you reach {place}. Your phone's GPS must place you within {formatDistance(radiusM)} of {household ? "the reported location" : "its centre"}.{household ? " Your app then shows a Visit code to give the resident, so they can check it is you." : ""}</p>
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

function CodeShow({ jobId, pin, distanceM, residentFirst, notes, onNotesUsed }: { jobId: string; pin: VisitPin | undefined; distanceM: number; residentFirst: string | undefined; notes: string; onNotesUsed: () => void }) {
  const now = useNow();
  const state = pinState(pin, now);
  const who = residentFirst ?? "the resident";
  const minutes = pin ? Math.max(1, Math.ceil((pin.expiresAt - now) / 60000)) : 0;
  const stateMessage = state === "locked" ? `${who} entered a wrong code three times, so it is locked.` : state === "expired" ? "This code has expired." : "No code has been made yet.";

  return (
    <div>
      <p className="mt-1 text-xs text-muted-foreground">{distanceM >= 0 ? `GPS confirms you are ${formatDistance(distanceM)} from the reported location. ` : ""}{who} has been told you are at the gate.</p>
      {state === "active" && pin ? (
        <div className="mt-3">
          <p className="text-sm font-bold">Give {who} this Visit code</p>
          <p className="mt-2 rounded-md bg-card py-4 text-center text-4xl font-extrabold tabular-nums tracking-[0.25em] text-navy">
            <span className="sr-only">{pin.code.split("").join(" ")}</span>
            <span aria-hidden="true">{formatPin(pin.code)}</span>
          </p>
          <p role="status" className="mt-2 text-xs text-muted-foreground">{who} enters it in their app to confirm you are the technician the city sent. The job moves to "On site" as soon as it matches. {VISIT_PIN_MAX_ATTEMPTS - pin.attempts} tries left · expires in {minutes} min.</p>
        </div>
      ) : (
        <div className="mt-3">
          <p role="alert" className="text-sm font-bold text-destructive">{stateMessage}</p>
          {canSendAnotherPin(pin)
            ? <Button className="mt-3 min-h-12 w-full" onClick={() => issueVisitPin(jobId)}><KeyRound /> Make a new code for {who}</Button>
            : <p className="mt-2 text-xs text-muted-foreground">No more codes can be made for this job. Use the option below if {who} cannot take part.</p>}
        </div>
      )}
      <OverrideForm summary={`${who} can't enter the code?`} action="Start without the code" onConfirm={(reason) => { startWithoutPin(jobId, reason, notes.trim() || undefined); onNotesUsed(); }} />
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
        <p role="status" className="mt-1 text-xs text-muted-foreground">Waiting for {who} to confirm the power is back on. They have been asked in their app, and the job is resolved when they say yes.</p>
      )}
      <OverrideForm summary={`${who} can't confirm?`} action="Resolve without confirmation" onConfirm={(reason) => { completeWithoutConfirmation(jobId, reason, notes.trim() || undefined); onNotesUsed(); }} />
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
