import { BellOff, MapPin, Radio, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LiveMap, type MapMarker } from "@/components/lesedi/live-map";
import { technicians } from "@/components/lesedi/data";
import { useRoute } from "@/lib/routing";
import { ago, crewStore } from "@/lib/reports";
import { stageLabel, type PublicIncident } from "@/lib/incidents";

const steps = ["Reported", "Technician assigned", "On the way", "On site", "Repair in progress", "Restored"];
const stepFor = (stage: number) => (stage === -2 ? 0 : stage <= 0 ? 1 : stage === 1 ? 2 : stage === 2 ? 3 : stage === 3 ? 4 : 5);

/**
 * Live view of one incident.
 *
 * `own` is true only for the resident who filed the report, and then the exact `point` is used.
 * Everyone else — neighbours following the same outage — sees the area as a shaded circle, with no
 * address, no reporter and no photos. The crew's live position appears only while they are driving.
 */
export function IncidentTracker({ incident, own = false, point, onUnfollow }: { incident: PublicIncident; own?: boolean; point?: { lat: number; lng: number } | undefined; onUnfollow?: () => void }) {
  const crews = crewStore.use();
  const destination = own && point ? point : { lat: incident.lat, lng: incident.lng };
  const crew = incident.techName ? (crews[incident.techName] ?? technicians.find((tech) => tech.name === incident.techName) ?? null) : null;
  const showCrew = incident.techVisible && crew !== null;
  const route = useRoute(showCrew && crew ? { lat: crew.lat, lng: crew.lng } : null, showCrew ? destination : null);
  const step = stepFor(incident.stage);

  const markers: MapMarker[] = [];
  if (own && point) markers.push({ id: "site", lat: point.lat, lng: point.lng, kind: "incident", label: "Your outage", detail: "Where your technician is heading" });
  if (showCrew && crew) markers.push({ id: "crew", lat: crew.lat, lng: crew.lng, kind: "crew", label: incident.techFirst ?? "Technician", detail: route ? `About ${route.minutes} min away` : "On the way" });

  const arrival = incident.stage >= 2 ? "On site" : showCrew ? (route ? `${route.minutes} min` : "…") : "To be confirmed";

  return (
    <section className="rounded-md border border-border bg-card" aria-labelledby={`track-${incident.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase text-primary">{own ? "Your report" : incident.source === "auto" ? "Detected by our sensors" : "Outage you are following"}</p>
          <h3 id={`track-${incident.id}`} className="mt-1 flex items-center gap-2 font-extrabold text-navy"><MapPin className="size-4 text-primary" /> {incident.area}</h3>
          <p className="text-xs text-muted-foreground">{incident.status} · reported {ago(incident.openedAt)} ago</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-[11px] font-bold"><Users className="size-3.5" /> {incident.reports + incident.followers} affected</span>
          {onUnfollow && <Button variant="outline" size="sm" className="min-h-11" onClick={onUnfollow}><BellOff /> Unfollow</Button>}
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)]">
        <LiveMap
          title={showCrew ? "TECHNICIAN ON THE WAY" : "AFFECTED AREA"}
          subtitle={showCrew ? (route ? `${incident.techFirst} is about ${route.minutes} min away` : "Finding the route…") : own ? incident.status : "Approximate area · exact addresses are not shown"}
          markers={markers}
          route={showCrew ? (route?.coords ?? null) : null}
          area={own ? null : { lat: incident.lat, lng: incident.lng, radiusM: incident.radiusM }}
          heightClass="h-72"
        />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-secondary p-3"><p className="text-[10px] font-extrabold uppercase text-muted-foreground">Arrival</p><p className="mt-1 text-xl font-extrabold text-navy">{arrival}</p></div>
            <div className="rounded-md bg-secondary p-3"><p className="text-[10px] font-extrabold uppercase text-muted-foreground">Technician</p><p className="mt-1 text-xl font-extrabold text-navy">{incident.techFirst ?? "Pending"}</p></div>
          </div>
          <ol className="space-y-1">
            {steps.map((label, index) => (
              <li key={label} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${index === step ? "bg-secondary font-bold" : ""}`}>
                <span className={`size-2.5 shrink-0 rounded-full ${index < step ? "bg-success" : index === step ? "bg-accent" : "bg-muted"}`} />
                <span className={index <= step ? "" : "text-muted-foreground"}>{label}</span>
              </li>
            ))}
          </ol>
          {incident.updates.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-extrabold text-navy"><Radio className="size-4 text-primary" /> Live updates</p>
              <ol className="mt-2 max-h-40 space-y-2 overflow-y-auto border-l border-border pl-3">
                {[...incident.updates].reverse().map((update, index) => (
                  <li key={index} className="text-xs"><span className="font-bold">{stageLabel(update.stage)}</span> <span className="text-muted-foreground">· {ago(update.at)} ago</span></li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
