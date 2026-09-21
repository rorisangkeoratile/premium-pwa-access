import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, Building2, CheckCircle2, Clock3, Headphones, Home, MapPin,
  ShieldCheck, Smartphone, WifiOff, Wrench, Zap,
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

const dashboards = [
  { to: "/dashboard/customer", icon: Home, title: "Customer", text: "Report an outage in under two minutes, track restoration live and view your area's schedule.", points: ["Guided outage reporting", "Live status timeline", "Outage & billing alerts"] },
  { to: "/dashboard/technician", icon: Wrench, title: "Technician", text: "Your assigned jobs with navigation, stage updates, safety checks and photo evidence.", points: ["Job queue with GPS route", "Stage-by-stage progress", "Photo & note capture"] },
  { to: "/dashboard/dispatcher", icon: Headphones, title: "Dispatcher", text: "Control-centre view of every incident with duplicate detection and one-tap crew assignment.", points: ["Live priority queue", "Duplicate report merging", "Nearest-crew dispatch"] },
  { to: "/dashboard/manager", icon: Building2, title: "Department manager", text: "Performance, recurring faults, budget and workforce planning for the whole department.", points: ["SLA & response analytics", "Recurring hotspot map", "Budget and crew planning"] },
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
            <a href="#dashboards" className="hidden min-h-11 items-center px-3 text-sm font-bold text-muted-foreground hover:text-foreground sm:flex">Dashboards</a>
            <Button asChild className="min-h-11"><Link to="/dashboard/customer">Report an outage</Link></Button>
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
              <Button asChild size="lg" className="min-h-12 bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/dashboard/customer">Report an outage <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"><a href="#dashboards">Explore dashboards</a></Button>
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

      <section id="dashboards" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-[11px] font-extrabold uppercase text-primary">Four connected workspaces</p>
        <h2 className="mt-2 text-3xl font-extrabold text-navy">A dashboard for every role</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Each team sees exactly what they need — and every update flows instantly to the others.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {dashboards.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                  <h3 className="text-lg font-extrabold text-navy">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{item.text}</p>
                <ul className="mt-4 space-y-2">
                  {item.points.map((point) => <li key={point} className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 shrink-0 text-success" />{point}</li>)}
                </ul>
                <p className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-primary">Open dashboard <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></p>
              </Link>
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
