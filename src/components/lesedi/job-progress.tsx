import { Link2, UserRoundCog, UsersRound } from "lucide-react";

import { declinedBy, helpersOf, isFilled, type CrewRequest } from "@/lib/crew-requests";
import { clockTime, currentErt, dueLabel, nextReportDue } from "@/lib/ert";
import { useClock } from "@/lib/presence";
import { ago, complaintText, isResolved, stageNames, type Dispatch, type OutageReport } from "@/lib/reports";
import { visitStatus } from "@/lib/visit";

const stageLabel = (stage: number) => (stage < 0 ? "Assigned, waiting to accept" : (stageNames[stage] ?? "Update"));

/**
 * The live progress of a dispatched job: who is on it, what stage it is at, the ERT and the next status report
 * it owes, any additional crew they asked for, and every update they posted.
 */
export function JobFeed({ dispatch, openedAt, crew }: { dispatch: Dispatch; openedAt: number; crew?: CrewRequest | undefined }) {
  const now = useClock(15000);
  const stage = dispatch.stage ?? -1;
  const all = dispatch.updates ?? [];
  const updates = all.map((update, index) => ({ update, repeat: all[index - 1]?.stage === update.stage })).reverse().slice(0, 8);
  const waiting = visitStatus(dispatch);
  const resolved = isResolved(stage);
  const ert = currentErt(openedAt, dispatch);
  const reportDue = nextReportDue(dispatch);
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-extrabold text-navy"><UserRoundCog className="size-4 text-primary" /> {dispatch.tech}</p>
        <span className="rounded bg-secondary px-2 py-1 text-[10px] font-extrabold uppercase text-primary">{stageLabel(stage)}</span>
      </div>
      {!resolved && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className={`rounded-md p-2 ${now > ert ? "bg-danger-soft" : "bg-secondary"}`}><p className="text-[10px] font-extrabold uppercase text-muted-foreground">ERT</p><p className="font-bold">{clockTime(ert)} · {dueLabel(ert, now)}</p></div>
          {reportDue !== undefined && <div className={`rounded-md p-2 ${now > reportDue ? "bg-danger-soft" : "bg-secondary"}`}><p className="text-[10px] font-extrabold uppercase text-muted-foreground">Next status report</p><p className="font-bold">{clockTime(reportDue)} · {dueLabel(reportDue, now)}</p></div>}
        </div>
      )}
      {waiting && <p role="status" className="mt-3 rounded-md bg-warning-soft p-2 text-xs font-bold">{waiting}</p>}
      {crew && (
        <div className={`mt-3 rounded-md p-2 text-xs ${isFilled(crew) ? "bg-success-soft" : "bg-warning-soft"}`}>
          <p className="flex items-center gap-1 font-bold"><UsersRound className="size-3.5" /> Additional crew requested · {helpersOf(crew).length} of {crew.needed} accepted</p>
          <p>{crew.reason} · {ago(crew.at)} ago</p>
          {helpersOf(crew).map((helper) => <p key={helper.name}>{helper.name} · {helper.arrivedAt ? `on site since ${clockTime(helper.arrivedAt)}` : "on the way"}</p>)}
          {declinedBy(crew).length > 0 && <p className="text-muted-foreground">Declined: {declinedBy(crew).join(", ")}</p>}
        </div>
      )}
      <ol className="mt-3 space-y-2 border-l border-border pl-3">
        {updates.map(({ update, repeat }, index) => (
          <li key={index} className="text-xs">
            <p className="font-bold">{repeat ? (update.ertDue ? `ERT extended to ${clockTime(update.ertDue)}` : "Status report") : stageLabel(update.stage)}{!repeat && update.ertDue ? ` · ERT ${clockTime(update.ertDue)}` : ""} <span className="font-normal text-muted-foreground">· {ago(update.at)} ago</span></p>
            {update.flag && <p className="mt-0.5 inline-block rounded bg-danger-soft px-1.5 py-0.5 font-bold text-destructive">Flag: {update.flag}</p>}
            {update.note && <p className="text-muted-foreground">{update.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Duplicate reports that were linked to this incident instead of opening new ones. */
export function LinkedReports({ reports }: { reports: OutageReport[] }) {
  if (reports.length === 0) return null;
  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <p className="flex items-center gap-2 text-xs font-extrabold text-navy"><Link2 className="size-4 text-primary" /> {reports.length} duplicate report{reports.length === 1 ? "" : "s"} merged into this incident</p>
      <ul className="mt-2 space-y-2">
        {reports.map((report) => (
          <li key={report.id} className="text-xs">
            <p><strong>{report.id}</strong> · {report.reporter} · {ago(report.createdAt)} ago{report.photos.length > 0 ? ` · ${report.photos.length} photo${report.photos.length === 1 ? "" : "s"}` : ""}</p>
            {complaintText(report) && <p className="text-muted-foreground">{complaintText(report)}</p>}
            {report.photos.length > 0 && (
              <div className="mt-1 flex gap-1">
                {report.photos.map((src, index) => <a key={index} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Photo from ${report.reporter}`} className="size-12 rounded border border-border object-cover" /></a>)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
