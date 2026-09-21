import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Bell, BellOff, Camera, Check, CheckCircle2, Clock3, FileText, Film, House, Image as ImageIcon, LocateFixed, Megaphone, Pencil, TriangleAlert, Users, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DashboardShell, Field, PageHeading, Stat } from "@/components/lesedi/shell";
import { LiveMap } from "@/components/lesedi/live-map";
import { IncidentTracker } from "@/components/lesedi/incident-tracker";
import { ResidentVisitCards } from "@/components/lesedi/visit-pin";
import { currentUser, type MockUser } from "@/lib/auth";
import { detectPosition, distanceKm, reverseGeocode } from "@/lib/geo";
import { MAX_PHOTOS, MAX_VIDEO_MB, compressPhoto } from "@/lib/media";
import { findDuplicate, type DuplicateMatch } from "@/lib/dedup";
import { areas, ticketStore } from "@/lib/nodes";
import { HOME_AREA_KM, NEARBY_KM, follow, followStore, isFollowing, nearbyIncidents, publicHistory, publicIncidents, unfollow } from "@/lib/incidents";
import { HOME_OUTAGE, addReport, ago, dispatchStore, isHomeOutage, nextReportId, profileStore, reportStore, setReportVideo, type OutageReport, type OutageType } from "@/lib/reports";

export const Route = createFileRoute("/dashboard/customer")({
  head: () => ({
    meta: [
      { title: "Customer dashboard — LesediLink" },
      { name: "description", content: "Report an electricity outage, track restoration progress and see planned interruptions in your area." },
      { property: "og:title", content: "Customer dashboard — LesediLink" },
      { property: "og:description", content: "Report outages in a few taps and follow every step to restoration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerDashboard,
});

type DetailErrors = { [K in "type" | "phone" | "account"]?: string | undefined };

const SA_PHONE = /^(\+27|0)[0-9]{9}$/;
const cleanPhone = (value: string) => value.replace(/[\s()-]/g, "");
/** A prepaid meter number or a municipal account number: letters and digits, spaces ignored. */
const METER_OR_ACCOUNT = /^[A-Za-z0-9-]{5,20}$/;

/** Name, email and cell number are already on the account, so the only things left to check are these. */
function validate(phone: string, type: OutageType | null, account: string): DetailErrors {
  const errors: DetailErrors = {};
  if (!type) errors.type = "Choose what is happening.";
  if (!SA_PHONE.test(cleanPhone(phone))) errors.phone = "Enter a valid South African number, e.g. 082 000 0000 or +27 82 000 0000.";
  if (type === HOME_OUTAGE && account.trim() && !METER_OR_ACCOUNT.test(account.replace(/\s/g, ""))) errors.account = "That number does not look right. Use the digits on your prepaid meter or municipal bill, or leave it blank.";
  return errors;
}

const typeChoices: { type: OutageType; title: string; text: string; icon: typeof House }[] = [
  { type: "Home outage", title: "Just my home", text: "The power is off at my house or flat, but my neighbours still have power.", icon: House },
  { type: "Street or area outage", title: "My street or area", text: "My neighbours are without power too.", icon: Users },
  { type: "Damaged equipment or hazard", title: "Sparks, fallen line or damage", text: "Damaged or dangerous equipment. Keep a safe distance.", icon: TriangleAlert },
];

const customerSteps = ["Report received", "Technician assigned", "En route", "On site", "Repair in progress", "Restored"];

function CustomerDashboard() {
  const reports = reportStore.use();
  const dispatches = dispatchStore.use();
  const tickets = ticketStore.use();
  const follows = followStore.use();
  const [submitted, setSubmitted] = useState<{ report: OutageReport; duplicate: DuplicateMatch | null } | null>(null);

  const [me, setMe] = useState<MockUser | null>(null);
  useEffect(() => setMe(currentUser()), []);
  const areaOutage = me?.areaId ? tickets.find((ticket) => ticket.areaId === me.areaId && !ticket.restoredAt) : undefined;

  // Name and cell number come from the account. Only a changed number and the meter number are remembered on the device.
  // They are worked out while rendering rather than copied in by an effect, so the phone is never blank
  // in a frame where the form is already showing.
  const saved = me ? profileStore.get()[me.email] : undefined;
  const [phoneEdit, setPhoneEdit] = useState<string | null>(null);
  const [accountEdit, setAccountEdit] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const phone = phoneEdit ?? (saved?.phone || me?.phone) ?? "";
  const account = accountEdit ?? saved?.account ?? "";
  const [outageType, setOutageType] = useState<OutageType | null>(null);
  const [description, setDescription] = useState("");
  const [landmark, setLandmark] = useState("");
  const [errors, setErrors] = useState<DetailErrors>({});
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number; text: string } | null>(null);
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [areaPoint, setAreaPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [areaChecking, setAreaChecking] = useState(false);
  const [areaError, setAreaError] = useState("");

  // Best-effort: turn the pin into a street address. It is only used while it still belongs to the current pin.
  useEffect(() => {
    if (!pin) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const found = await reverseGeocode(pin.lat, pin.lng);
      if (!stale && found) setGeocoded({ lat: pin.lat, lng: pin.lng, text: found });
    }, 600);
    return () => { stale = true; clearTimeout(timer); };
  }, [pin]);
  const address = pin && geocoded && geocoded.lat === pin.lat && geocoded.lng === pin.lng ? geocoded.text : "";

  async function detect() {
    setLocating(true);
    setLocationError("");
    try {
      const fix = await detectPosition();
      setAccuracy(fix.accuracy);
      setPin({ lat: fix.lat, lng: fix.lng });
    } catch (error) {
      setLocationError((error as Error).message);
      setAdjusting(true); // no GPS: let the resident drop the pin by hand
    } finally {
      setLocating(false);
    }
  }

  // If the resident has already allowed location for this site, find them straight away. Otherwise the
  // browser's prompt only appears when they tap "Use my location" or "Report an outage".
  function autoLocate() {
    navigator.permissions?.query({ name: "geolocation" }).then((status) => {
      if (status.state === "granted") void detect();
    }).catch(() => undefined);
  }
  useEffect(() => { autoLocate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function placePin(position: { lat: number; lng: number }) {
    setAccuracy(undefined);
    setPin(position);
    setLocationError("");
  }

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    event.target.value = "";
    setMediaError("");
    try {
      const added = await Promise.all(files.map((file) => compressPhoto(file)));
      setPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS));
    } catch {
      setMediaError("That photo could not be read. Please try another.");
    }
  }

  function addVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setMediaError(`Video is larger than ${MAX_VIDEO_MB} MB. Please record a shorter clip.`);
      return;
    }
    setMediaError("");
    if (video) URL.revokeObjectURL(video.url);
    setVideo({ file, url: URL.createObjectURL(file) });
  }

  function clearVideo() {
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(phone, outageType, account);
    setErrors(found);
    if (found.phone) setEditingPhone(true);
    if (!pin) {
      setLocationError("Please use your location or tap the map to drop a pin.");
      setAdjusting(true);
    }
    if (!pin || !outageType || Object.keys(found).length > 0) {
      requestAnimationFrame(() => (document.querySelector('#report-form [role="alert"]') as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    // Deduplication: link this report to an open incident that already covers the spot, instead of opening a new one.
    // A home outage is never merged: it is a fault at one property, not a shared one.
    const duplicate = findDuplicate(pin, reports, tickets, dispatches, outageType);
    const meter = outageType === HOME_OUTAGE ? account.replace(/\s/g, "") : "";
    const report: OutageReport = {
      id: nextReportId(),
      createdAt: Date.now(),
      reporter: me?.name ?? "Resident",
      // If the address lookup failed, a home outage still gets the resident's own suburb (they are at home). Anything
      // else stays blank rather than guessing, and shows as "Pinned on map".
      address: address || (outageType === HOME_OUTAGE ? me?.area : undefined) || "",
      ...(landmark.trim() ? { landmark: landmark.trim() } : {}),
      ...(meter ? { account: meter } : {}),
      contact: phone.trim(),
      type: outageType,
      description: description.trim(),
      lat: pin.lat,
      lng: pin.lng,
      accuracy,
      photos,
      hasVideo: Boolean(video),
      duplicateOf: duplicate?.id,
    };
    if (video) setReportVideo(report.id, video.url);
    if (me) profileStore.set({ ...profileStore.get(), [me.email]: { phone: report.contact, account: meter || (profileStore.get()[me.email]?.account ?? "") } });
    addReport(report);
    setSubmitted({ report, duplicate });
    setPin(null);
    setAccuracy(undefined);
    setAdjusting(false);
    setPhotos([]);
    setVideo(null);
    setDescription("");
    setLandmark("");
    setOutageType(null);
    setEditingPhone(false);
    setErrors({});
  }

  // The public view of every open incident. It carries no personal details, so it is safe to show
  // to a neighbour who is affected by the same fault.
  const resident = me?.email ?? "resident";
  const publicList = useMemo(() => publicIncidents(reports, tickets, dispatches, follows), [reports, tickets, dispatches, follows]);

  const mine = me ? reports.filter((report) => report.reporter === me.name) : [];
  const latest = mine[0];
  const openMine = mine.filter((report) => dispatches[report.duplicateOf ?? report.id]?.stage !== 4);
  const masterId = latest ? (latest.duplicateOf ?? latest.id) : undefined;
  const myIncident = publicList.find((incident) => incident.id === masterId);
  // The timeline keeps showing a finished outage as "Restored"; the live tracker above is for open ones only.
  const myHistory = useMemo(() => publicHistory(reports, tickets, dispatches, follows), [reports, tickets, dispatches, follows]);
  const myLatestIncident = myHistory.find((incident) => incident.id === masterId);
  // The exact location is shown only to the person who filed that report; a merged report follows
  // someone else's incident, so it gets the same area-level view as any other follower.
  const ownPoint = latest && !latest.duplicateOf ? { lat: latest.lat, lng: latest.lng } : undefined;
  const followed = publicList.filter((incident) => incident.id !== masterId && isFollowing(incident.id, resident, follows));

  // Outages at the resident's home area are tracked for them automatically, wherever they are right now.
  // The home area comes from their account, not from their phone's position.
  const home = me?.areaId ? areas.find((area) => area.id === me.areaId) : undefined;
  const homeIncidents = home
    ? publicList.filter((incident) => !incident.home && incident.id !== masterId && !isFollowing(incident.id, resident, follows) && (incident.areaId === home.id || (incident.areaId === undefined && distanceKm(home, incident) <= HOME_AREA_KM)))
    : [];
  const here = pin ?? areaPoint;
  const awayKm = home && here ? distanceKm(home, here) : undefined;
  const nearby = areaPoint ? nearbyIncidents(publicList, areaPoint) : [];

  // Duplicate check first: as soon as we know where the resident is, say if that fault is already reported.
  const match = useMemo(() => (pin ? findDuplicate(pin, reports, tickets, dispatches, outageType) : null), [pin, outageType, reports, tickets, dispatches]);
  const matchIncident = match ? publicList.find((incident) => incident.id === match.id) : undefined;
  const ownMatch = match ? mine.some((report) => report.id === match.id || report.duplicateOf === match.id) : false;
  const followingMatch = match ? isFollowing(match.id, resident, follows) : false;

  async function checkArea() {
    setAreaChecking(true);
    setAreaError("");
    try {
      const fix = await detectPosition();
      setAreaPoint({ lat: fix.lat, lng: fix.lng });
    } catch (error) {
      setAreaError((error as Error).message);
    } finally {
      setAreaChecking(false);
    }
  }

  // Which step of the timeline is current, driven by the technician's updates.
  const myStage = myLatestIncident ? myLatestIncident.stage : -2;
  const currentStep = !latest ? 2 : myStage === -2 ? 1 : myStage <= 1 ? 2 : myStage === 2 ? 3 : myStage === 3 ? 4 : 6;
  const stepNote = myLatestIncident?.status ?? "Waiting for a crew to be assigned";

  return (
    <DashboardShell home="/dashboard/customer" user={me?.name ?? "Resident"} role={`Resident · ${me?.area ?? "Tshwane"}`}>
      <PageHeading eyebrow="Customer" title="My power" text="Report a fault, follow the repair and stay ahead of planned interruptions." action={<Button asChild size="lg" className="min-h-12"><a href="#report-form" onClick={() => { if (!pin && !locating) void detect(); }}><Megaphone /> Report an outage</a></Button>} />

      {/* Time-critical, so it comes first: the technician may be waiting at the gate for this PIN. */}
      {mine.map((report) => {
        const dispatch = isHomeOutage(report) ? dispatches[report.id] : undefined;
        return dispatch ? <ResidentVisitCards key={report.id} report={report} dispatch={dispatch} /> : null;
      })}

      {home && (
        <section className={`mt-5 rounded-md border p-4 ${homeIncidents.length > 0 ? "border-destructive bg-danger-soft" : "border-border bg-card"}`} aria-labelledby="home-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-[10px] font-extrabold uppercase text-primary">Home · {home.name}</p>
              <h2 id="home-title" className="mt-1 font-extrabold text-navy">{homeIncidents.length > 0 ? `Power outage at ${home.name}` : "Power is on at home"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{homeIncidents.length > 0 ? "We are tracking it for you below and will alert you at every step, wherever you are." : `No outages reported in ${home.name}. We will alert you here, and with a notification, the moment that changes, wherever you are.`}</p>
            </div>
            {awayKm !== undefined && awayKm > 5 && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">You are about {Math.round(awayKm)} km from home</span>}
          </div>
        </section>
      )}
      {homeIncidents.map((incident) => <div key={incident.id} className="mt-5"><IncidentTracker incident={incident} label={`Outage at your home area · ${home?.name ?? ""}`} /></div>)}

      <section className="mt-5 rounded-md border border-border bg-card p-4" aria-labelledby="area-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 id="area-title" className="font-extrabold text-navy">Power out in your area?</h2>
            <p className="mt-1 text-xs text-muted-foreground">If a neighbour has already reported the same fault, follow that outage to get the same live progress and technician tracking. You do not have to report it again, and we never show you who reported it.</p>
          </div>
          <Button variant="outline" className="min-h-11" onClick={checkArea} disabled={areaChecking}><LocateFixed />{areaChecking ? "Checking…" : "Check my area"}</Button>
        </div>
        {areaError && <p role="alert" className="mt-3 text-sm font-bold text-destructive">{areaError}</p>}
        {areaPoint && (nearby.length === 0 ? (
          <p className="mt-3 rounded-md bg-secondary p-3 text-sm">No open outages within {NEARBY_KM} km of you. If your power is off, <a className="font-bold text-primary underline" href="#report-form">report it</a>.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {nearby.map((incident) => {
              const following = isFollowing(incident.id, resident, follows);
              return (
                <li key={incident.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <p className="font-bold text-navy">{incident.area}{incident.source === "auto" ? " · detected by our sensors" : ""}</p>
                    <p className="text-xs text-muted-foreground">{incident.status} · {incident.reports + incident.followers} affected · reported {ago(incident.openedAt)} ago</p>
                  </div>
                  {incident.id === masterId
                    ? <span className="text-xs font-bold text-primary">This is your report</span>
                    : <Button size="sm" variant={following ? "outline" : "default"} className="min-h-11" onClick={() => (following ? unfollow(incident.id, resident) : follow(incident.id, resident))}>{following ? <><BellOff /> Unfollow</> : <><Bell /> Follow this outage</>}</Button>}
                </li>
              );
            })}
          </ul>
        ))}
      </section>

      {myIncident && <div className="mt-5"><IncidentTracker incident={myIncident} own={Boolean(ownPoint)} point={ownPoint} /></div>}
      {followed.map((incident) => <div key={incident.id} className="mt-5"><IncidentTracker incident={incident} onUnfollow={() => unfollow(incident.id, resident)} /></div>)}

      {latest && (
      <section className="mt-5 overflow-hidden rounded-md border border-border bg-navy-gradient text-primary-foreground" aria-labelledby="existing-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4">
          <p className="text-[10px] font-extrabold uppercase text-primary-foreground/60">Existing report</p>
          <p className="min-w-0 truncate text-xs text-primary-foreground/60">{latest ? `${latest.address || "Pinned location"}${latest.duplicateOf ? ` · merged into ${latest.duplicateOf}` : ""}` : "Mamelodi East"}</p>
        </div>
        <h2 id="existing-title" className="px-4 text-lg font-extrabold">{latest ? `${latest.id} · ${latest.type}` : "#LL-4792 · Mamelodi East"}</h2>
        <p className="px-4 text-xs text-primary-foreground/70">{stepNote}</p>
        <ol className="mt-3 flex gap-2 overflow-x-auto px-4 pb-4">
          {customerSteps.map((step, index) => (
            <li key={step} className="flex min-w-max flex-1 items-center gap-2 rounded-md bg-primary-foreground/10 px-3 py-2">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${index < currentStep ? "bg-success text-primary-foreground" : index === currentStep ? "bg-accent text-accent-foreground" : "bg-primary-foreground/15 text-primary-foreground/50"}`}>{index < currentStep ? <Check className="size-3.5" /> : index + 1}</span>
              <span className={`text-xs font-bold ${index <= currentStep ? "" : "text-primary-foreground/50"}`}>{step}</span>
            </li>
          ))}
        </ol>
      </section>
      )}

      <div className="mt-5">
        {submitted ? (
          <section className="rounded-md border border-border bg-card p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-7" /></div>
            <h2 className="mt-4 text-2xl font-extrabold text-navy">{submitted.duplicate ? "Report linked to an existing incident" : "Report received"}</h2>
            <p className="mt-1 text-muted-foreground">Reference {submitted.report.id}{submitted.duplicate ? ` · ${submitted.duplicate.label}` : " · We're checking for nearby incidents."}</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">{submitted.duplicate ? "Someone nearby already reported this, so we merged your report into the same incident. Your photos and details were added, and you will see the same live progress and technician tracking. " : ""}Location saved · {submitted.report.photos.length} photo{submitted.report.photos.length === 1 ? "" : "s"}{submitted.report.hasVideo ? " · 1 video" : ""} sent to the control centre</p>
            {isHomeOutage(submitted.report) && <p className="mx-auto mt-3 max-w-md rounded-md bg-secondary p-3 text-xs">When the technician arrives at your property, a <strong>Visit PIN</strong> will appear at the top of this page. Read it out at your gate so they can start work.</p>}
            <Button className="mt-5" onClick={() => { setSubmitted(null); autoLocate(); }}>Submit another report</Button>
          </section>
        ) : (
          <form id="report-form" onSubmit={submit} noValidate className="scroll-mt-20 rounded-md border border-border bg-card p-5 sm:p-6">
            <h2 className="font-extrabold text-navy">Report an outage</h2>
            <p className="mt-1 text-xs text-muted-foreground">We use the name and cell number on your account, so there is nothing to type. Pick what is wrong and send.</p>

            <section className="mt-5" aria-labelledby="where-title">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary p-3">
                <div className="min-w-0">
                  <p id="where-title" className="text-sm font-extrabold text-navy">Where is the fault?</p>
                  <div className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
                    {/* The full address can be very long, so show the first parts only and keep the accuracy on its own line. */}
                    <p className="line-clamp-2">{pin ? address.split(",").slice(0, 3).join(",") || "Location found" : locating ? "Finding your location…" : "We need your location so the crew can find the fault."}</p>
                    {pin && <p className="text-[11px]">{accuracy ? `Accurate to about ${Math.round(accuracy)} m` : "Pinned on the map"}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!pin && !locating && <Button type="button" className="min-h-11" onClick={detect}><LocateFixed /> Use my location</Button>}
                  <Button type="button" variant="outline" className="min-h-11" aria-expanded={adjusting} onClick={() => setAdjusting(!adjusting)}>{adjusting ? "Hide map" : pin ? "Adjust on map" : "Choose on map"}</Button>
                </div>
              </div>
              {locationError && <p role="alert" className="mt-2 text-sm font-bold text-destructive">{locationError}</p>}
              {adjusting && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted-foreground">Tap the map to drop a pin, or drag the pin to fine-tune it.</p>
                  <LiveMap title="SELECT LOCATION" subtitle={pin ? (accuracy ? `Location detected · accurate to about ${Math.round(accuracy)} m` : "Location pinned") : "No location selected yet"} heightClass="h-72" pin={pin} pinAccuracy={accuracy} onPin={placePin} />
                </div>
              )}
            </section>

            {match && (
              <div className="mt-4 rounded-md border-2 border-primary bg-card p-4" role="status" aria-live="polite">
                <p className="flex items-center gap-2 text-sm font-extrabold text-navy"><Users className="size-4 text-primary" /> {ownMatch ? "You already reported this fault" : "This outage is already reported"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {matchIncident ? `${matchIncident.area} · ${matchIncident.status} · ${matchIncident.reports + matchIncident.followers} affected.` : `${match.label}.`}{" "}
                  {ownMatch ? "Follow its progress at the top of this page." : followingMatch ? "You are following it. Its live progress is at the top of this page, so there is nothing more to do." : "Follow it to see live progress and the technician on the way. No report needed."}
                </p>
                {!ownMatch && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button type="button" className="min-h-11" variant={followingMatch ? "outline" : "default"} onClick={() => (followingMatch ? unfollow(match.id, resident) : follow(match.id, resident))}>{followingMatch ? <><BellOff /> Stop following</> : <><Bell /> Follow this outage</>}</Button>
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">Only your own home? Choose “Just my home” below to report it separately. Sending a report here adds yours to this outage.</p>
                  </div>
                )}
              </div>
            )}

            <fieldset className="mt-6">
              <legend className="text-sm font-extrabold text-navy">What is happening?</legend>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {typeChoices.map(({ type, title, text, icon: Icon }) => (
                  <label key={type} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                    <input type="radio" name="outage-type" value={type} className="sr-only" checked={outageType === type} onChange={() => { setOutageType(type); setErrors((current) => ({ ...current, type: undefined })); }} />
                    <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-extrabold text-navy">{title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{text}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.type && <p role="alert" className="mt-2 text-xs font-bold text-destructive">{errors.type}</p>}
            </fieldset>

            {outageType === HOME_OUTAGE && (
              <div className="mt-5 max-w-md">
                <Field id="account" label="Meter or account number (optional)" hint="The number on your prepaid meter or municipal bill helps the crew find your connection. Skip it if you do not have it. It is remembered on this device for next time." error={errors.account}>
                  <Input id="account" inputMode="text" autoComplete="off" aria-invalid={Boolean(errors.account)} value={account} onChange={(event) => { setAccountEdit(event.target.value); setErrors((current) => ({ ...current, account: undefined })); }} placeholder="e.g. 0123 4567 890" className="h-11" />
                </Field>
              </div>
            )}

            <div className="mt-5 rounded-md border border-border p-3 text-sm">
              {editingPhone ? (
                <Field id="phone" label="Cell number the crew should call" error={errors.phone}>
                  <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} value={phone} onChange={(event) => { setPhoneEdit(event.target.value); setErrors((current) => ({ ...current, phone: undefined })); }} placeholder="e.g. 082 000 0000" className="h-11" />
                </Field>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>We will call you on <strong className="text-navy">{phone || "…"}</strong> if the crew needs you.</p>
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setEditingPhone(true)}><Pencil /> Change</Button>
                </div>
              )}
            </div>

            <details className="mt-5 rounded-md border border-border p-4">
              <summary className="min-h-8 cursor-pointer text-sm font-extrabold text-navy">Add a note, landmark or photo <span className="font-normal text-muted-foreground">(optional)</span></summary>
              <div className="mt-4 space-y-5">
                <Field id="description" label="What can you see?"><Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" placeholder="Describe the issue and any visible hazards" /></Field>
                <Field id="landmark" label="Landmark or house number" hint="Helps the crew find the exact spot, e.g. the blue gate next to the spaza shop."><Input id="landmark" autoComplete="off" value={landmark} onChange={(event) => setLandmark(event.target.value)} className="h-11" /></Field>
                <div>
                  <p className="text-sm font-medium leading-none">Photo or video</p>
                  <p className="mt-2 text-xs text-muted-foreground">Help the crew see the fault. Keep a safe distance from any damaged equipment.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Button asChild variant="outline" className="min-h-11"><label className="cursor-pointer focus-within:ring-2 focus-within:ring-ring"><Camera /> Take photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={addPhotos} disabled={photos.length >= MAX_PHOTOS} /></label></Button>
                    <Button asChild variant="outline" className="min-h-11"><label className="cursor-pointer focus-within:ring-2 focus-within:ring-ring"><ImageIcon /> Choose photos<input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} disabled={photos.length >= MAX_PHOTOS} /></label></Button>
                    <Button asChild variant="outline" className="min-h-11"><label className="cursor-pointer focus-within:ring-2 focus-within:ring-ring"><Film /> Record video<input type="file" accept="video/*" capture="environment" className="sr-only" onChange={addVideo} /></label></Button>
                  </div>
                  {mediaError && <p role="alert" className="mt-2 text-sm font-bold text-destructive">{mediaError}</p>}
                  {(photos.length > 0 || video) && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {photos.map((src, index) => (
                        <div key={index} className="relative">
                          <img src={src} alt={`Attached photo ${index + 1}`} className="aspect-square w-full rounded-md border border-border object-cover" />
                          <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 size-8" aria-label={`Remove photo ${index + 1}`} onClick={() => setPhotos(photos.filter((_, i) => i !== index))}><X /></Button>
                        </div>
                      ))}
                      {video && (
                        <div className="relative col-span-3 sm:col-span-1">
                          <video src={video.url} controls className="aspect-video w-full rounded-md border border-border bg-black object-cover" />
                          <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 size-8" aria-label="Remove video" onClick={clearVideo}><X /></Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </details>

            <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground sm:max-w-sm">You agreed to be contacted about your reports when you signed up. If your connection drops, your report is saved and sent automatically.</p>
              <Button className="min-h-12 w-full text-base sm:w-auto sm:min-w-64" type="submit"><Zap /> Send outage report</Button>
            </div>
          </form>
        )}
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Account summary">
        <Stat label="Supply status" value="Restored" note="Since 04:12 today" icon={Zap} />
        <Stat label="Open reports" value={String(openMine.length)} note={openMine[0] ? `${openMine[0].id} in progress` : "No open reports"} icon={FileText} />
        <Stat label="Next planned outage" value="Thu 09:00" note="Maintenance · 3 hours" icon={Clock3} />
        <Stat label="Area alerts" value="2" note="Tap to review notices" icon={Bell} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Notices for your area</h2>
          <div className="mt-4 space-y-3">
            {[...(areaOutage ? [["Outage in your area", `Detected automatically ${ago(areaOutage.openedAt)} ago. A crew is being arranged, no report needed.`]] : []), ["Planned maintenance", `Thursday 09:00 – 12:00 · ${me?.area ?? "Your area"} feeder`], ["Load reduction", "Evening peak 18:00 – 20:00 · Stage 2"]].map(([title, text]) => (
              <div key={title} className="rounded-md border border-border bg-secondary p-4"><p className="text-sm font-bold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">My report history</h2>
          <div className="mt-3 divide-y divide-border">
            {[...mine.map((item) => [item.id, item.type, dispatches[item.duplicateOf ?? item.id]?.stage === 4 ? "Resolved" : item.duplicateOf ? "Merged · in progress" : "In progress"]), ...(me?.seedHistory ? [["#LL-4792", "Total blackout", "Resolved in 1h 05m"], ["#LL-4610", "Partial outage", "Resolved in 2h 10m"], ["#LL-4388", "Equipment damage", "Resolved in 5h 40m"]] : [])].map(([id, type, status]) => (
              <div key={id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{type}</p><p className="text-xs text-muted-foreground">{id}</p></div>
                <span className="text-xs font-bold text-primary">{status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
