import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Bell, Camera, Check, CheckCircle2, Clock3, FileText, Film, Image as ImageIcon, LocateFixed, Megaphone, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DashboardShell, Field, PageHeading, Stat } from "@/components/lesedi/shell";
import { LiveMap, type MapMarker } from "@/components/lesedi/live-map";
import { currentUser } from "@/lib/auth";
import { detectPosition, reverseGeocode } from "@/lib/geo";
import { MAX_PHOTOS, MAX_VIDEO_MB, compressPhoto } from "@/lib/media";
import { technicians } from "@/components/lesedi/data";
import { findDuplicate, type DuplicateMatch } from "@/lib/dedup";
import { useRoute } from "@/lib/routing";
import { ticketStore } from "@/lib/nodes";
import { addReport, ago, crewStore, dispatchStore, nextReportId, outageTypes, profileStore, reportStore, setReportVideo, stageNames, type OutageReport, type OutageType } from "@/lib/reports";

export const Route = createFileRoute("/dashboard/customer")({
  head: () => ({
    meta: [
      { title: "Customer dashboard — LesediLink" },
      { name: "description", content: "Report an electricity outage, track restoration progress and see planned interruptions in your area." },
      { property: "og:title", content: "Customer dashboard — LesediLink" },
      { property: "og:description", content: "Report outages in under two minutes and follow every step to restoration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerDashboard,
});

const ME = "Lerato Sithole";

type Details = { fullName: string; phone: string; email: string; altPhone: string; account: string; consent: boolean; saveDetails: boolean };
type DetailErrors = { [K in "fullName" | "phone" | "email" | "altPhone" | "account" | "address" | "consent" | "description"]?: string | undefined };

const SA_PHONE = /^(\+27|0)[0-9]{9}$/;
const cleanPhone = (value: string) => value.replace(/[\s()-]/g, "");

function validate(details: Details, address: string, description: string): DetailErrors {
  const errors: DetailErrors = {};
  if (details.fullName.trim().length < 2) errors.fullName = "Enter your full name.";
  if (!SA_PHONE.test(cleanPhone(details.phone))) errors.phone = "Enter a valid South African number, e.g. 082 000 0000 or +27 82 000 0000.";
  if (details.email.trim() && !/^\S+@\S+\.\S+$/.test(details.email.trim())) errors.email = "That email address doesn't look right.";
  if (details.altPhone.trim() && !SA_PHONE.test(cleanPhone(details.altPhone))) errors.altPhone = "Enter a valid South African number or leave this blank.";
  if (!/^[A-Za-z0-9-]{5,20}$/.test(details.account.trim())) errors.account = "Enter the account number from your municipal bill (5 to 20 letters or digits).";
  if (address.trim().length < 5) errors.address = "Enter the street and suburb, or use 'Detect my location'.";
  if (description.trim().length < 5) errors.description = "Tell us briefly what you can see.";
  if (!details.consent) errors.consent = "Please agree so we can contact you about this report.";
  return errors;
}
const customerSteps = ["Report received", "Technician assigned", "En route", "On site", "Repair in progress", "Restored"];

function CustomerDashboard() {
  const reports = reportStore.use();
  const dispatches = dispatchStore.use();
  const tickets = ticketStore.use();
  const crewLocations = crewStore.use();
  const areaOutage = tickets.find((ticket) => ticket.areaId === "mamelodi" && !ticket.restoredAt);
  const [submitted, setSubmitted] = useState<{ report: OutageReport; duplicate: DuplicateMatch | null } | null>(null);

  const [details, setDetails] = useState<Details>({ fullName: ME, phone: "", email: "", altPhone: "", account: "", consent: false, saveDetails: true });
  const [description, setDescription] = useState("");
  const [outageType, setOutageType] = useState<OutageType>(outageTypes[0]);
  const [errors, setErrors] = useState<DetailErrors>({});
  const [address, setAddress] = useState("");
  const addressTouched = useRef(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const [mediaError, setMediaError] = useState("");

  // Fill in the saved details after mount (localStorage is not available while rendering on the server).
  useEffect(() => {
    const saved = profileStore.get();
    setDetails((current) => ({ ...current, fullName: saved.fullName || current.fullName, phone: saved.phone, email: saved.email, altPhone: saved.altPhone, account: saved.account }));
  }, []);

  const setField = (key: keyof Details) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDetails((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  // Best-effort: turn the pin into a street address, unless the resident already typed one.
  useEffect(() => {
    if (!pin) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const found = await reverseGeocode(pin.lat, pin.lng);
      if (!stale && found && !addressTouched.current) setAddress(found);
    }, 600);
    return () => { stale = true; clearTimeout(timer); };
  }, [pin]);

  async function detect() {
    setLocating(true);
    setLocationError("");
    try {
      const fix = await detectPosition();
      setAccuracy(fix.accuracy);
      setPin({ lat: fix.lat, lng: fix.lng });
    } catch (error) {
      setLocationError((error as Error).message);
    } finally {
      setLocating(false);
    }
  }

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
    const found = validate(details, address, description);
    setErrors(found);
    if (!pin) setLocationError("Please detect your location or tap the map to drop a pin.");
    if (!pin || Object.keys(found).length > 0) {
      requestAnimationFrame(() => (document.querySelector('[role="alert"]') as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    // Deduplication: link this report to an open incident that already covers the spot, instead of opening a new one.
    const duplicate = findDuplicate(pin, reports, tickets, dispatches);
    const report: OutageReport = {
      id: nextReportId(),
      createdAt: Date.now(),
      reporter: currentUser()?.name ?? ME,
      address: address.trim(),
      fullName: details.fullName.trim(),
      email: details.email.trim() || undefined,
      altContact: details.altPhone.trim() || undefined,
      account: details.account.trim(),
      contact: details.phone.trim(),
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
    if (details.saveDetails) profileStore.set({ fullName: report.fullName ?? ME, phone: report.contact, email: report.email ?? "", altPhone: report.altContact ?? "", account: report.account });
    addReport(report);
    setSubmitted({ report, duplicate });
    setPin(null);
    setAccuracy(undefined);
    setPhotos([]);
    setVideo(null);
    setAddress("");
    setDescription("");
    setErrors({});
    setDetails((current) => ({ ...current, consent: false }));
    addressTouched.current = false;
  }

  // Everything below follows the customer's own latest report, or the incident it was merged into.
  const mine = reports.filter((report) => report.reporter === ME);
  const latest = mine[0];
  const masterId = latest ? (latest.duplicateOf ?? latest.id) : undefined;
  const trackingDispatch = masterId ? dispatches[masterId] : undefined;
  const trackingStage = trackingDispatch ? (trackingDispatch.stage ?? -1) : -2; // -2: no technician assigned yet
  const destination = useMemo(() => {
    const place = reports.find((item) => item.id === masterId) ?? tickets.find((item) => item.id === masterId);
    return place ? { lat: place.lat, lng: place.lng } : null;
  }, [reports, tickets, masterId]);
  const techPosition = trackingDispatch ? (crewLocations[trackingDispatch.tech] ?? technicians.find((tech) => tech.name === trackingDispatch.tech) ?? null) : null;
  const tracking = trackingDispatch !== undefined && trackingStage < 4;
  const trackingRoute = useRoute(tracking && techPosition ? { lat: techPosition.lat, lng: techPosition.lng } : null, tracking ? destination : null);
  const trackingMarkers = useMemo<MapMarker[]>(() => {
    if (!tracking || !techPosition || !destination) return [];
    return [
      { id: "you", lat: destination.lat, lng: destination.lng, kind: "incident", label: "Your outage", detail: "Where your technician is heading" },
      { id: "tech", lat: techPosition.lat, lng: techPosition.lng, kind: "crew", label: trackingDispatch?.tech ?? "Technician", detail: trackingRoute ? `About ${trackingRoute.minutes} min away` : "On the way" },
    ];
  }, [tracking, techPosition?.lat, techPosition?.lng, destination, trackingDispatch?.tech, trackingRoute?.minutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Which step of the timeline is current, driven by the technician's updates.
  const currentStep = !latest ? 2 : trackingStage === -2 ? 1 : trackingStage <= 1 ? 2 : trackingStage === 2 ? 3 : trackingStage === 3 ? 4 : 6;
  const stepNote = !latest ? "Thabo is 4.8 km away"
    : trackingStage === -2 ? "Waiting for a crew to be assigned"
    : trackingStage < 0 ? `${trackingDispatch?.tech} has been assigned and will accept shortly`
    : trackingStage === 0 ? `${trackingDispatch?.tech} accepted the job and is getting ready`
    : trackingStage === 1 ? (trackingRoute ? `${trackingDispatch?.tech} is on the way · about ${trackingRoute.minutes} min` : `${trackingDispatch?.tech} is on the way`)
    : trackingStage === 2 ? `${trackingDispatch?.tech} has arrived`
    : `${trackingDispatch?.tech} is working on the fault`;

  return (
    <DashboardShell home="/dashboard/customer" user="Lerato Sithole" role="Resident · Mamelodi East">
      <PageHeading eyebrow="Customer" title="My power" text="Report a fault, follow the repair and stay ahead of planned interruptions." action={<Button asChild size="lg" className="min-h-12"><a href="#report-form"><Megaphone /> Report an outage</a></Button>} />

      {trackingDispatch && trackingStage < 4 && (
        <section className="mt-5 rounded-md border border-border bg-card" aria-labelledby="tracking-title">
          <div className="border-b border-border p-4">
            <h2 id="tracking-title" className="font-extrabold text-navy">Live technician tracking</h2>
            <p className="text-xs text-muted-foreground">{trackingDispatch.tech} is assigned to your report {latest?.id}{latest?.duplicateOf ? ` (merged into ${latest.duplicateOf})` : ""}.</p>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)]">
            <LiveMap title="TECHNICIAN LIVE LOCATION" subtitle={trackingStage >= 2 ? "Your technician has arrived" : trackingRoute ? `About ${trackingRoute.minutes} min away` : "Finding the route…"} markers={trackingMarkers} route={trackingStage >= 2 ? null : (trackingRoute?.coords ?? null)} heightClass="h-80" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-secondary p-3"><p className="text-[10px] font-extrabold uppercase text-muted-foreground">Arrival</p><p className="mt-1 text-xl font-extrabold text-navy">{trackingStage >= 2 ? "On site" : trackingRoute ? `${trackingRoute.minutes} min` : "…"}</p></div>
                <div className="rounded-md bg-secondary p-3"><p className="text-[10px] font-extrabold uppercase text-muted-foreground">Distance</p><p className="mt-1 text-xl font-extrabold text-navy">{trackingStage >= 2 ? "0 km" : trackingRoute ? `${trackingRoute.distanceKm.toFixed(1)} km` : "…"}</p></div>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-extrabold text-navy">Live updates</p>
                <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto border-l border-border pl-3">
                  {[...(trackingDispatch.updates ?? [])].reverse().map((update, index) => (
                    <li key={index} className="text-xs"><p className="font-bold">{update.stage < 0 ? "Technician assigned" : stageNames[update.stage]} <span className="font-normal text-muted-foreground">· {ago(update.at)} ago</span></p>{update.note && <p className="text-muted-foreground">{update.note}</p>}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mt-5 overflow-hidden rounded-md border border-border bg-navy text-primary-foreground" aria-labelledby="existing-title">
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

      <div className="mt-5">
        {submitted ? (
          <section className="rounded-md border border-border bg-card p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-7" /></div>
            <h2 className="mt-4 text-2xl font-extrabold text-navy">{submitted.duplicate ? "Report linked to an existing incident" : "Report received"}</h2>
            <p className="mt-1 text-muted-foreground">Reference {submitted.report.id}{submitted.duplicate ? ` · ${submitted.duplicate.label}` : " · We're checking for nearby incidents."}</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">{submitted.duplicate ? "Someone nearby already reported this, so we merged your report into the same incident. Your photos and details were added, and you will see the same live progress and technician tracking. " : ""}Location saved · {submitted.report.photos.length} photo{submitted.report.photos.length === 1 ? "" : "s"}{submitted.report.hasVideo ? " · 1 video" : ""} sent to the control centre</p>
            <Button className="mt-5" onClick={() => setSubmitted(null)}>Submit another report</Button>
          </section>
        ) : (
          <form id="report-form" onSubmit={submit} noValidate className="scroll-mt-20 rounded-md border border-border bg-card p-5 sm:p-6">
            <h2 className="font-extrabold text-navy">Report an outage</h2>
            <p className="mt-1 text-xs text-muted-foreground">Most reports take under two minutes. Fields marked optional can be skipped.</p>
            <fieldset className="mt-5">
              <legend className="text-sm font-extrabold text-navy">1. Your details</legend>
              <p className="mt-1 text-xs text-muted-foreground">The crew and control centre use these to reach you about this report.</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <Field id="fullName" label="Full name" error={errors.fullName}><Input id="fullName" autoComplete="name" aria-invalid={Boolean(errors.fullName)} value={details.fullName} onChange={setField("fullName")} placeholder="Name and surname" className="h-11" /></Field>
                <Field id="phone" label="Cell number" error={errors.phone}><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} value={details.phone} onChange={setField("phone")} placeholder="e.g. 082 000 0000" className="h-11" /></Field>
                <Field id="email" label="Email address (optional)" hint="For status updates and your reference number." error={errors.email}><Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} value={details.email} onChange={setField("email")} placeholder="you@example.com" className="h-11" /></Field>
                <Field id="altPhone" label="Alternative number (optional)" hint="Someone else we can call if you can't be reached." error={errors.altPhone}><Input id="altPhone" type="tel" inputMode="tel" aria-invalid={Boolean(errors.altPhone)} value={details.altPhone} onChange={setField("altPhone")} placeholder="e.g. 071 000 0000" className="h-11" /></Field>
                <div className="sm:col-span-2 xl:col-span-1"><Field id="account" label="Municipal account number" hint="Found at the top of your municipal bill." error={errors.account}><Input id="account" inputMode="text" aria-invalid={Boolean(errors.account)} value={details.account} onChange={setField("account")} placeholder="Account number" className="h-11" /></Field></div>
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm font-extrabold text-navy">2. The outage</legend>
              <div className="mt-4 grid gap-5 xl:grid-cols-2">
                <div className="space-y-5">
                  <Field id="address" label="Service address" error={errors.address}><Input id="address" autoComplete="street-address" aria-invalid={Boolean(errors.address)} value={address} onChange={(e) => { addressTouched.current = true; setAddress(e.target.value); setErrors((current) => ({ ...current, address: undefined })); }} placeholder="Street and suburb, or detect your location below" className="h-11" /></Field>
                  <Field id="type" label="Outage type">
                    <select id="type" value={outageType} onChange={(e) => setOutageType(e.target.value as OutageType)} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
                      {outageTypes.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field id="description" label="What can you see?" error={errors.description}><Textarea id="description" aria-invalid={Boolean(errors.description)} value={description} onChange={(e) => { setDescription(e.target.value); setErrors((current) => ({ ...current, description: undefined })); }} className="min-h-28" placeholder="Describe the issue and any visible hazards" /></Field>
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium leading-none">Outage location</p>
                    <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={detect} disabled={locating}><LocateFixed />{locating ? "Finding you…" : "Detect my location"}</Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Detect your GPS position, or tap the map to drop a pin. Drag the pin to fine-tune it.</p>
                  <div className="mt-3">
                    <LiveMap title="SELECT LOCATION" subtitle={pin ? (accuracy ? `Location detected · accurate to about ${Math.round(accuracy)} m` : "Location pinned") : "No location selected yet"} heightClass="h-72" pin={pin} pinAccuracy={accuracy} onPin={placePin} />
                  </div>
                  {locationError && <p role="alert" className="mt-2 text-sm font-bold text-destructive">{locationError}</p>}
                </div>
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm font-extrabold text-navy">3. Photo or video <span className="font-normal text-muted-foreground">(optional)</span></legend>
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
            </fieldset>
            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={details.consent} onChange={setField("consent")} aria-invalid={Boolean(errors.consent)} /><span>I agree that LesediLink and the City of Tshwane may contact me about this report.</span></label>
              {errors.consent && <p role="alert" className="text-xs font-bold text-destructive">{errors.consent}</p>}
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={details.saveDetails} onChange={setField("saveDetails")} /><span>Remember my details on this device for next time.</span></label>
            </div>
            <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground sm:max-w-sm">If your connection drops, your report is saved and sent automatically.</p>
              <Button className="min-h-12 w-full text-base sm:w-auto sm:min-w-64" type="submit"><Zap /> Send outage report</Button>
            </div>
          </form>
        )}
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Account summary">
        <Stat label="Supply status" value="Restored" note="Since 04:12 today" icon={Zap} />
        <Stat label="Open reports" value={String(1 + mine.length)} note={`${latest ? latest.id : "#LL-4792"} in progress`} icon={FileText} />
        <Stat label="Next planned outage" value="Thu 09:00" note="Maintenance · 3 hours" icon={Clock3} />
        <Stat label="Area alerts" value="2" note="Tap to review notices" icon={Bell} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Notices for your area</h2>
          <div className="mt-4 space-y-3">
            {[...(areaOutage ? [["Outage in your area", `Detected automatically ${ago(areaOutage.openedAt)} ago. A crew is being arranged, no report needed.`]] : []), ["Planned maintenance", "Thursday 09:00 – 12:00 · Mamelodi East feeder"], ["Load reduction", "Evening peak 18:00 – 20:00 · Stage 2"]].map(([title, text]) => (
              <div key={title} className="rounded-md border border-border bg-secondary p-4"><p className="text-sm font-bold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">My report history</h2>
          <div className="mt-3 divide-y divide-border">
            {[...mine.map((item) => [item.id, item.type, dispatches[item.duplicateOf ?? item.id]?.stage === 4 ? "Resolved" : item.duplicateOf ? "Merged · in progress" : "In progress"]), ["#LL-4792", "Total blackout", "In progress"], ["#LL-4610", "Partial outage", "Resolved in 2h 10m"], ["#LL-4388", "Equipment damage", "Resolved in 5h 40m"]].map(([id, type, status]) => (
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
