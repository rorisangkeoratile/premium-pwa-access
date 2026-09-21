import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, CheckCircle2, FilePenLine, LocateFixed, LogIn, MapPin, Phone, ShieldCheck, Smartphone, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CountUp, Reveal, prefersReducedMotion } from "@/components/lesedi/motion";
import { TowerScape } from "@/components/lesedi/tower-scape";
import { FEED_RADIUS_KM, feedNear, followStore } from "@/lib/incidents";
import { detectPosition } from "@/lib/geo";
import { dispatchStore, reportStore } from "@/lib/reports";
import { ticketStore } from "@/lib/nodes";
import { Logo } from "@/components/lesedi/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LesediLink — Keep Tshwane's lights connected" },
      { name: "description", content: "LesediLink connects residents, technicians, dispatchers and department managers on one real-time electricity outage platform." },
      { property: "og:title", content: "LesediLink — Keep Tshwane's lights connected" },
      { property: "og:description", content: "Report outages in a few taps, dispatch the nearest crew and track restoration live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const steps = [
  { icon: LogIn, title: "1. Sign up or log in", text: "First time here? Create a free account with your cell number. Returning? Log in and you'll go straight to your dashboard.", points: ["Confirm your cell number with a 6-digit code", "Keep your password private", "Log out when you're done"] },
  { icon: FilePenLine, title: "2. Report an outage", text: "Tell us what happened in a few taps. Your name and cell number come from your account, so there is nothing to retype.", points: ["We find your location for you", "Pick what is wrong. Photos and notes are optional", "Save it offline if you have no signal"] },
  { icon: BellRing, title: "3. Track restoration", text: "Follow your report from received to restored, and get notified at every step.", points: ["Live status timeline", "Estimated restoration time", "Outage & billing alerts"] },
  { icon: ShieldCheck, title: "4. Stay safe", text: "While you wait, keep yourself and your household safe around electrical faults.", points: ["Stay away from fallen lines", "Switch off appliances at the wall", "Emergency line 080 111 1556"] },
] as const;

const stats = [["18 min", "Avg. response"], ["87%", "SLA met"], ["24/7", "Control centre"]] as const;

const dotFor = (priority: string) => (priority === "Critical" ? "bg-destructive" : priority === "High" ? "bg-accent" : priority === "Medium" ? "bg-warning" : "bg-success");

type Fix = { lat: number; lng: number };

/**
 * Outages within 10 km of the visitor. The location is asked for only when the visitor taps the button
 * (or has already allowed it for this site), is kept in memory only, and is never sent anywhere.
 * With more than three nearby outages the list slides a new one in every few seconds.
 */
function LiveFeed() {
  const reports = reportStore.use();
  const tickets = ticketStore.use();
  const dispatches = dispatchStore.use();
  const follows = followStore.use();
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [start, setStart] = useState(0);

  async function locate() {
    setLocating(true);
    setError("");
    try {
      const found = await detectPosition();
      setFix({ lat: found.lat, lng: found.lng });
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setLocating(false);
    }
  }

  // If the visitor has already allowed location for this site, use it straight away.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions?.query({ name: "geolocation" }).then((status) => {
      if (status.state === "granted" && !cancelled) void locate();
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const nearby = useMemo(() => (fix ? feedNear(fix, reports, tickets, dispatches, follows) : []), [fix, reports, tickets, dispatches, follows]);

  useEffect(() => {
    if (nearby.length <= 3 || prefersReducedMotion()) return;
    const timer = setInterval(() => setStart((current) => (current + 1) % nearby.length), 3600);
    return () => clearInterval(timer);
  }, [nearby.length]);

  const visible = nearby.length <= 3 ? nearby : [0, 1, 2].map((offset) => nearby[(start + offset) % nearby.length]!);

  return (
    <div className="rounded-xl border border-primary-foreground/15 bg-navy/70 p-5 shadow-2xl shadow-black/20 backdrop-blur-md">
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase text-primary-foreground/70"><span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" /><span className="relative inline-flex size-2.5 rounded-full bg-success" /></span> Live incident feed · within {FEED_RADIUS_KM} km</p>

      {!fix ? (
        <div className="mt-4 rounded-md bg-primary-foreground/10 p-5 text-center">
          <LocateFixed className="mx-auto size-7 text-accent" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold">See outages near you</p>
          <p className="mt-1 text-xs text-primary-foreground/75">We only show incidents within {FEED_RADIUS_KM} km of your location. It stays on your device.</p>
          <Button variant="accent" className="mt-4 min-h-11" onClick={locate} disabled={locating}><LocateFixed />{locating ? "Finding you…" : "Show incidents near me"}</Button>
          {error && <p role="alert" className="mt-3 text-xs font-bold text-primary-foreground">{error}</p>}
        </div>
      ) : nearby.length === 0 ? (
        <div className="mt-4 rounded-md bg-primary-foreground/10 p-5 text-center">
          <ShieldCheck className="mx-auto size-7 text-success" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold">No outages within {FEED_RADIUS_KM} km of you</p>
          <p className="mt-1 text-xs text-primary-foreground/75">Power looks good around you right now.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((item, index) => (
            <div key={item.id} className={`flex items-center gap-3 rounded-md bg-primary-foreground/10 p-4 ${index === 0 && nearby.length > 3 ? "feed-in" : ""}`}>
              <span className={`size-2.5 shrink-0 rounded-full ${dotFor(item.priority)}`} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.place}</p><p className="text-xs text-primary-foreground/70">{item.id} · {item.status}</p></div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-primary-foreground/70"><MapPin className="size-4" aria-hidden="true" />{item.km < 1 ? "<1" : item.km.toFixed(1)} km</span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 flex items-center gap-2 text-xs text-primary-foreground/70">
        {fix ? <>{nearby.length} within {FEED_RADIUS_KM} km · updates live <button type="button" className="ml-auto inline-flex min-h-8 items-center gap-1 font-bold underline" onClick={() => { setFix(null); setError(""); }}><ShieldOff className="size-3.5" aria-hidden="true" /> Forget my location</button></> : "Your location is never stored or shared."}
      </p>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo />
            <p className="text-lg font-extrabold text-navy">Lesedi<span className="text-primary">Link</span></p>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/login" className="flex min-h-11 items-center px-3 text-sm font-bold text-muted-foreground hover:text-foreground">Login</Link>
            <Link to="/signup" className="hidden min-h-11 items-center px-3 text-sm font-bold text-primary hover:underline sm:flex">Sign up</Link>
            <Button asChild className="min-h-11"><Link to="/login">Report an outage</Link></Button>
          </nav>
        </div>
      </header>

      <section className="hero-bg relative isolate overflow-hidden border-b border-border text-primary-foreground">
        <TowerScape className="pointer-events-none absolute inset-0 -z-20 h-full w-full" />
        <div className="hero-veil pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-extrabold uppercase backdrop-blur"><span className="size-2 rounded-full bg-accent" /> City of Tshwane · live network</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">Keep the lights on, <span className="gradient-text">together.</span></h1>
            <p className="mt-4 max-w-xl text-base text-primary-foreground/85 sm:text-lg">LesediLink links residents, field technicians, dispatchers and department managers on one real-time platform — so every outage is reported, routed and restored faster.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent" className="min-h-12"><Link to="/login">Report an outage <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><a href="#how-to-use">How it works</a></Button>
            </div>
            <p className="mt-4 text-sm text-primary-foreground/85">New here? <Link to="/signup" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-accent">Create a free account</Link></p>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-primary-foreground/15 pt-6">
              {stats.map(([value, label]) => (
                <div key={label}><dt className="text-2xl font-extrabold"><CountUp value={value} duration={1400} /></dt><dd className="text-xs text-primary-foreground/70">{label}</dd></div>
              ))}
            </dl>
          </div>
          <div className="float-slow self-center"><LiveFeed /></div>
        </div>
      </section>

      <section id="how-to-use" className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <p className="text-[11px] font-extrabold uppercase text-primary">For residents</p>
          <h2 className="mt-2 text-3xl font-extrabold text-navy">How to use LesediLink</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Four simple steps to get your outage reported, followed and fixed.</p>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={(index % 2) * 120}>
                <div className="lift h-full rounded-xl border border-border bg-soft-gradient p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-md bg-brand-gradient text-primary-foreground shadow"><Icon className="size-5" aria-hidden="true" /></span>
                    <h3 className="text-lg font-extrabold text-navy">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{item.text}</p>
                  <ul className="mt-4 space-y-2">
                    {item.points.map((point) => <li key={point} className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 shrink-0 text-success" />{point}</li>)}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="border-y border-border bg-soft-gradient">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2">
          {[[Smartphone, "Installs like an app", "Add LesediLink to your home screen on phone, tablet, laptop or desktop."], [ShieldCheck, "Secure & accessible", "Two-step sign-in, large targets, clear contrast and keyboard support."]].map(([Icon, title, text], index) => {
            const I = Icon as typeof Smartphone;
            return (
              <Reveal key={title as string} delay={index * 120}>
                <div className="lift h-full rounded-xl border border-border bg-card p-6">
                  <I className="size-6 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 font-extrabold text-navy">{title as string}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{text as string}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <footer className="bg-brand-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-8">
          <div className="flex items-center gap-3">
            <Logo />
            <div><p className="font-extrabold">LesediLink · City of Tshwane</p><p className="text-xs text-primary-foreground/75">Municipal electricity response</p></div>
          </div>
          <p className="flex items-center gap-2 text-sm"><Phone className="size-4" aria-hidden="true" /> Emergency line 080 111 1556 · Available 24 hours</p>
        </div>
      </footer>
    </div>
  );
}
