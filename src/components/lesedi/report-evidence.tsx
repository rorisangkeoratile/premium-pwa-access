import { Film, MapPinned, Navigation } from "lucide-react";

import { directionsLink, getReportVideo, isHomeOutage, osmLink, type OutageReport } from "@/lib/reports";

/** Location, photos and video a citizen attached to an outage report. */
export function ReportEvidence({ report }: { report: OutageReport }) {
  const video = getReportVideo(report.id);
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md bg-secondary p-3">
        <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Reported location</p>
        <p className="mt-1 font-bold text-navy">{report.address || "Pinned on map"}</p>
        {report.landmark && <p className="text-xs text-muted-foreground">Landmark: {report.landmark}</p>}
        <p className="text-xs text-muted-foreground">
          {report.accuracy ? `GPS detected · accurate to about ${Math.round(report.accuracy)} m` : "Pin placed on the map by the resident"}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-primary">
          <a className="inline-flex min-h-8 items-center gap-1 underline" href={osmLink(report.lat, report.lng)} target="_blank" rel="noreferrer"><MapPinned className="size-3.5" /> View on OpenStreetMap</a>
          <a className="inline-flex min-h-8 items-center gap-1 underline" href={directionsLink(report.lat, report.lng)} target="_blank" rel="noreferrer"><Navigation className="size-3.5" /> Directions</a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {report.reporter} · {report.contact}{report.account ? ` · Meter or account ${report.account}` : ""}
      </p>
      {isHomeOutage(report) && <p className="rounded-md bg-secondary p-3 text-xs"><strong>Home visit.</strong> The technician may need to be let in, so the resident gets a Visit PIN to read out at the gate.</p>}
      {report.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {report.photos.map((src, index) => (
            <a key={index} href={src} target="_blank" rel="noreferrer" aria-label={`Open photo ${index + 1}`}>
              <img src={src} alt={`Outage photo ${index + 1} from ${report.reporter}`} className="aspect-square w-full rounded-md border border-border object-cover" />
            </a>
          ))}
        </div>
      )}
      {report.hasVideo &&
        (video ? (
          <video src={video} controls preload="metadata" className="max-h-64 w-full rounded-md border border-border bg-black" />
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"><Film className="size-4" /> A video was attached. It is only viewable on the device that recorded it until a backend is connected.</p>
        ))}
    </div>
  );
}
