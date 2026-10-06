import { STAGE, isResolved, type Dispatch, type JobUpdate } from "@/lib/reports";

/**
 * Expected response times (ERT) and status reporting.
 *
 * - A logged fault gets an ERT of 2 hours: a crew should be on site by then.
 * - Once a technician is allocated they report on the job every 30 minutes until it is resolved.
 * - "Awaiting parts" sets a new ERT for the parts (2 hours unless the technician picks longer), and the next
 *   report is due when the parts are expected rather than every 30 minutes.
 * - "Repairs in progress" gets 30 minutes, or longer for a complex fault, and the next report is due then.
 * - A technician may extend an ERT with a reason; the original deadline is still what performance is measured on.
 */
export const ERT_RESPONSE_MS = 2 * 60 * 60 * 1000;
export const REPORT_INTERVAL_MS = 30 * 60 * 1000;

const MIN = 60 * 1000;
export type ErtChoice = { label: string; ms: number };
export const PARTS_ERT_CHOICES: ErtChoice[] = [
  { label: "1 hour", ms: 60 * MIN },
  { label: "2 hours (standard)", ms: 120 * MIN },
  { label: "4 hours", ms: 240 * MIN },
  { label: "8 hours (complex)", ms: 480 * MIN },
];
export const REPAIR_ERT_CHOICES: ErtChoice[] = [
  { label: "30 minutes (standard)", ms: 30 * MIN },
  { label: "1 hour", ms: 60 * MIN },
  { label: "2 hours (complex)", ms: 120 * MIN },
  { label: "4 hours (major repair)", ms: 240 * MIN },
];
export const DEFAULT_PARTS_ERT = PARTS_ERT_CHOICES[1]!.ms;
export const DEFAULT_REPAIR_ERT = REPAIR_ERT_CHOICES[0]!.ms;

/** Phases whose deadline is set by the technician, rather than the fixed 2-hour response ERT. */
const timedPhase = (stage: number) => stage === STAGE.awaitingParts || stage === STAGE.repairing;

/** The ERT the incident is working to right now: the latest one a technician set, or 2 hours from logging. */
export function currentErt(openedAt: number, dispatch: Dispatch | undefined): number {
  const set = dispatch?.updates?.filter((update) => update.ertDue !== undefined).at(-1)?.ertDue;
  return set ?? openedAt + ERT_RESPONSE_MS;
}

/** When the next status report is due after `update`, given the ERT in force at that moment. */
function dueAfter(update: JobUpdate, ert: number | undefined): number {
  return timedPhase(update.stage) && ert !== undefined ? ert : update.at + REPORT_INTERVAL_MS;
}

/** When the technician's next status report is due. Undefined once the job is resolved, or before it is dispatched. */
export function nextReportDue(dispatch: Dispatch | undefined): number | undefined {
  if (!dispatch || isResolved(dispatch.stage)) return undefined;
  const updates = dispatch.updates ?? [];
  const last = updates.at(-1);
  if (!last) return dispatch.at + REPORT_INTERVAL_MS;
  const ert = updates.filter((update) => update.ertDue !== undefined && update.stage === last.stage).at(-1)?.ertDue;
  return dueAfter(last, ert);
}

/** "in 25 min", "12 min overdue", "in 1 h 40". */
export function dueLabel(due: number, now = Date.now()): string {
  const minutes = Math.round((due - now) / MIN);
  const span = (value: number) => (value < 60 ? `${value} min` : `${Math.floor(value / 60)} h ${String(value % 60).padStart(2, "0")}`);
  return minutes >= 0 ? `in ${span(minutes)}` : `${span(-minutes)} overdue`;
}

export const clockTime = (time: number) => new Date(time).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });

/** Status reports for one job: how many arrived on time, how many were late (including one that is overdue right now). */
export function reportingRecord(dispatch: Dispatch | undefined, now = Date.now()): { onTime: number; late: number } {
  const updates = dispatch?.updates ?? [];
  let onTime = 0;
  let late = 0;
  let ert: number | undefined;
  for (let index = 0; index < updates.length; index += 1) {
    const update = updates[index]!;
    if (isResolved(update.stage)) break;
    if (update.ertDue !== undefined) ert = update.ertDue;
    else if (index > 0 && updates[index - 1]!.stage !== update.stage) ert = undefined;
    const due = dueAfter(update, ert);
    const next = updates[index + 1];
    if (next) {
      if (next.at <= due) onTime += 1;
      else late += 1;
    } else if (now > due) {
      late += 1;
    }
  }
  return { onTime, late };
}

/**
 * Phase deadlines (parts and repairs): met when the job moved on before the deadline that was first set.
 * An extension does not reset this, so the record stays honest. A phase still running inside its deadline is not counted yet.
 */
export function phaseRecord(dispatch: Dispatch | undefined, now = Date.now()): { met: number; missed: number; extended: number } {
  const updates = dispatch?.updates ?? [];
  let met = 0;
  let missed = 0;
  let extended = 0;
  for (let index = 0; index < updates.length; index += 1) {
    const update = updates[index]!;
    const starts = update.ertDue !== undefined && (index === 0 || updates[index - 1]!.stage !== update.stage);
    if (update.ertDue !== undefined && !starts) extended += 1;
    if (!starts) continue;
    const moved = updates.slice(index + 1).find((later) => later.stage !== update.stage);
    if (moved) {
      if (moved.at <= update.ertDue!) met += 1;
      else missed += 1;
    } else if (now > update.ertDue!) {
      missed += 1;
    }
  }
  return { met, missed, extended };
}
