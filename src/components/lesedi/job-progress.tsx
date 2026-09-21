import { Link2, UserRoundCog } from "lucide-react";

import { ago, stageNames, type Dispatch, type OutageReport } from "@/lib/reports";
import { visitStatus } from "@/lib/visit";

const stageLabel = (stage: number) => (stage < 0 ? "Assigned, waiting to accept" : (stageNames[stage] ?? "Update"));

/** The live progress of a dispatched job: who is on it, what stage it is at, and every update they posted. */
export function JobFeed({ dispatch }: { dispatch: Dispatch }) {
  const stage = dispatch.stage ?? -1;
  const updates = [...(dispatch.updates ?? [])].reverse().slice(0, 6);
  const waiting = visitStatus(dispatch);
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-extrabold text-navy"><UserRoundCog className="size-4 text-primary" /> {dispatch.tech}</p>
        <span className="rounded bg-secondary px-2 py-1 text-[10px] font-extrabold uppercase text-primary">{stageLabel(stage)}</span>
      </div>
      {waiting && <p role="status" className="mt-3 rounded-md bg-warning-soft p-2 text-xs font-bold">{waiting}</p>}
      <ol className="mt-3 space-y-2 border-l border-border pl-3">
        {updates.map((update, index) => (
          <li key={index} className="text-xs">
            <p className="font-bold">{stageLabel(update.stage)} <span className="font-normal text-muted-foreground">· {ago(update.at)} ago</span></p>
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
            {report.description && <p className="text-muted-foreground">{report.description}</p>}
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
