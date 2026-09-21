import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, BellRing, CheckCircle2, Clock3, FilePenLine, LogIn, MapPin,
  ShieldCheck, Smartphone, WifiOff, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LesediLink — Keep Tshwane's lights connected" },
      { name: "description", content: "LesediLink connects residents, technicians, dispatchers and department managers on one real-time electricity outage platform." },
      { property: "og:title", content: "LesediLink — Keep Tshwane's lights connected" },
      { property: "og:description", content: "Report outages in under two minutes, dispatch the nearest crew and track restoration live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const steps = [
  { icon: LogIn, title: "1. Log in", text: "Sign in with your LesediLink account. You'll be taken straight to your own dashboard.", points: ["Use your registered email", "Keep your password private", "Log out when you're done"] },
  { icon: FilePenLine, title: "2. Report an outage", text: "Tell us what happened in under two minutes. The guided form asks only what the crew needs.", points: ["Confirm your address or pin the map", "Describe the fault and add a photo", "Save it offline if you have no signal"] },
  { icon: BellRing, title: "3. Track restoration", text: "Follow your report from received to restored, and get notified at every step.", points: ["Live status timeline", "Estimated restoration time", "Outage & billing alerts"] },
  { icon: ShieldCheck, title: "4. Stay safe", text: "While you wait, keep yourself and your household safe around electrical faults.", points: ["Stay away from fallen lines", "Switch off appliances at the wall", "Emergency line 080 111 1556"] },
] as const;

function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground"><Zap className="size-5" aria-hidden="true" /></div>
            <p className="text-lg font-extrabold text-navy">Lesedi<span className="text-primary">Link</span></p>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/login" className="flex min-h-11 items-center px-3 text-sm font-bold text-muted-foreground hover:text-foreground">Login</Link>
            <Button asChild className="min-h-11"><Link to="/login">Report an outage</Link></Button>
          </nav>
        </div>
      </header>

      <section className="border-b border-border bg-navy text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-extrabold uppercase"><span className="size-2 rounded-full bg-accent" /> City of Tshwane · live network</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">Keep the lights on, together.</h1>
            <p className="mt-4 max-w-xl text-base text-primary-foreground/75 sm:text-lg">LesediLink links residents, field technicians, dispatchers and department managers on one real-time platform — so every outage is reported, routed and restored faster.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-h-12 bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/login">Report an outage <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"><a href="#how-to-use">How it works</a></Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-primary-foreground/15 pt-6">
              {[["18 min", "Avg. response"], ["87%", "SLA met"], ["24/7", "Control centre"]].map(([value, label]) => (
                <div key={label}><dt className="text-2xl font-extrabold">{value}</dt><dd className="text-xs text-primary-foreground/60">{label}</dd></div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-5">
            <p className="text-xs font-extrabold uppercase text-primary-foreground/60">Live incident feed</p>
            <div className="mt-4 space-y-3">
              {[["#LL-4821", "Soshanguve Block H", "Crew dispatched", "bg-accent"], ["#LL-4819", "Pretoria CBD", "Technician on site", "bg-warning"], ["#LL-4814", "Hatfield", "Power restored", "bg-success"]].map(([id, place, status, dot]) => (
                <div key={id} className="flex items-center gap-3 rounded-md bg-primary-foreground/10 p-4">
                  <span className={`size-2.5 shrink-0 rounded-full ${dot}`} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{place}</p><p className="text-xs text-primary-foreground/60">{id} · {status}</p></div>
                  <MapPin className="size-4 shrink-0 text-primary-foreground/50" />
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-primary-foreground/60"><Clock3 className="size-4" /> Updated moments ago</p>
          </div>
        </div>
      </section>

      <section id="how-to-use" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-[11px] font-extrabold uppercase text-primary">For residents</p>
        <h2 className="mt-2 text-3xl font-extrabold text-navy">How to use LesediLink</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Four simple steps to get your outage reported, followed and fixed.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                  <h3 className="text-lg font-extrabold text-navy">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{item.text}</p>
                <ul className="mt-4 space-y-2">
                  {item.points.map((point) => <li key={point} className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 shrink-0 text-success" />{point}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
          {[[Smartphone, "Installs like an app", "Add LesediLink to your home screen on phone, tablet, laptop or desktop."], [WifiOff, "Works offline", "Reports captured during load-shedding sync automatically once you reconnect."], [ShieldCheck, "Secure & accessible", "Municipal-grade protection with large targets, clear contrast and keyboard support."]].map(([Icon, title, text]) => {
            const I = Icon as typeof Smartphone;
            return (
              <div key={title as string} className="rounded-xl border border-border p-6">
                <I className="size-6 text-primary" aria-hidden="true" />
                <h3 className="mt-3 font-extrabold text-navy">{title as string}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground">
        <p className="font-bold text-navy">LesediLink · City of Tshwane</p>
        <p>Emergency line 080 111 1556 · Available 24 hours</p>
      </footer>
    </div>
  );
}
