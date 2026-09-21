import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Bell, Building2, Camera, Check,
  CheckCircle2, ChevronDown, CircleUserRound, Clock3, Download, FileText,
  Gauge, Headphones, Home, LocateFixed, Map, MapPin, Menu, Navigation,
  Radio, Search, Send, ShieldCheck, Signal, Siren, SlidersHorizontal, Users,
  Wrench, X, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Role = "dispatcher" | "customer" | "technician" | "operations";
type Priority = "Critical" | "High" | "Medium" | "Low";

const primaryIncident: { id: string; place: string; detail: string; priority: Priority; people: string; age: string; x: string; y: string } = { id: "#GG-4821", place: "Soshanguve Block H", detail: "Primary transformer failure", priority: "Critical", people: "5,240", age: "8 min", x: "27%", y: "29%" };

const incidents: Array<typeof primaryIncident> = [
  primaryIncident,
  { id: "#GG-4819", place: "Pretoria CBD", detail: "Substation trip · Church St", priority: "High", people: "1,860", age: "14 min", x: "51%", y: "55%" },
  { id: "#GG-4814", place: "Hatfield", detail: "Partial supply interruption", priority: "Medium", people: "420", age: "23 min", x: "67%", y: "45%" },
  { id: "#GG-4808", place: "Centurion", detail: "Residential feeder fault", priority: "Low", people: "68", age: "37 min", x: "57%", y: "78%" },
];

const technicians = [
  { name: "Thabo Molefe", skill: "High voltage", distance: "2.4 km", status: "Available", initials: "TM" },
  { name: "Maria Dlamini", skill: "Infrastructure", distance: "5.8 km", status: "Available", initials: "MD" },
  { name: "James Nkosi", skill: "Electrical", distance: "8.1 km", status: "On job", initials: "JN" },
];

const roleConfig: Record<Role, { label: string; sub: string; icon: typeof Headphones }> = {
  dispatcher: { label: "Dispatch", sub: "Control centre", icon: Headphones },
  customer: { label: "Citizen", sub: "Report & track", icon: Home },
  technician: { label: "Field team", sub: "Jobs & updates", icon: Wrench },
  operations: { label: "Operations", sub: "City intelligence", icon: Building2 },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridGuard Tshwane — Outage Operations" },
      { name: "description", content: "Report, dispatch, track and resolve City of Tshwane electricity outages." },
      { property: "og:title", content: "GridGuard Tshwane — Outage Operations" },
      { property: "og:description", content: "A connected outage response platform for citizens and municipal teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GridGuardApp,
});

function GridGuardApp() {
  const [role, setRole] = useState<Role>("dispatcher");
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <a href="#workspace" className="sr-only z-50 bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to workspace</a>
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto grid h-16 max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><Zap className="size-5" aria-hidden="true" /></div>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold text-navy">GridGuard <span className="font-medium text-muted-foreground">Tshwane</span></p>
              <p className="hidden text-[11px] font-semibold uppercase text-muted-foreground sm:block">Municipal electricity response</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success md:flex"><span className="size-2 rounded-full bg-success" />All systems live</div>
            <Button variant="ghost" size="icon" className="relative min-h-11 min-w-11" aria-label="Open notifications" onClick={() => setNoticeOpen(!noticeOpen)}>
              <Bell /><span className="absolute right-2 top-2 size-2 rounded-full bg-destructive" />
            </Button>
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11 lg:hidden" aria-label="Open role menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button>
            <div className="hidden items-center gap-2 border-l border-border pl-4 lg:flex">
              <div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-extrabold text-primary">NM</div>
              <div><p className="text-xs font-bold">Naledi Mokoena</p><p className="text-[11px] text-muted-foreground">Senior dispatcher</p></div><ChevronDown className="size-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        {noticeOpen && <div className="absolute right-4 top-14 w-[min(360px,calc(100vw-2rem))] rounded-md border border-border bg-card p-4 shadow-xl"><p className="font-bold">3 new updates</p><p className="mt-2 text-sm text-muted-foreground">Critical outage #GG-4821 requires assignment.</p><Button className="mt-3 w-full" size="sm" onClick={() => setNoticeOpen(false)}>View updates</Button></div>}
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className={`${menuOpen ? "fixed inset-x-0 top-16 z-30 flex" : "hidden"} min-h-[calc(100dvh-4rem)] w-full flex-col border-r border-border bg-card p-3 lg:sticky lg:top-16 lg:flex lg:w-60 lg:self-start`} aria-label="Role navigation">
          <p className="px-3 pb-2 pt-3 text-[10px] font-extrabold uppercase text-muted-foreground">Switch workspace</p>
          <nav className="space-y-1">
            {(Object.entries(roleConfig) as Array<[Role, typeof roleConfig[Role]]>).map(([key, item]) => {
              const Icon = item.icon;
              const active = key === role;
              return <button key={key} onClick={() => { setRole(key); setMenuOpen(false); }} className={`grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md px-3 text-left transition-colors ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`} aria-current={active ? "page" : undefined}>
                <Icon className="size-5" aria-hidden="true" /><span className="min-w-0"><span className="block text-sm font-bold">{item.label}</span><span className={`block truncate text-[11px] ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{item.sub}</span></span>
              </button>;
            })}
          </nav>
          <div className="mt-auto rounded-md border border-border bg-secondary p-3">
            <div className="flex items-center gap-2 text-xs font-bold"><Signal className="size-4 text-success" /> Sync active</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Last updated just now</p>
          </div>
        </aside>

        <main id="workspace" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {role === "dispatcher" && <DispatcherView />}
          {role === "customer" && <CustomerView />}
          {role === "technician" && <TechnicianView />}
          {role === "operations" && <OperationsView />}
        </main>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"><div className="min-w-0"><p className="text-[11px] font-extrabold uppercase text-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>{action}</div>;
}

function Stat({ label, value, note, icon: Icon, alert = false }: { label: string; value: string; note: string; icon: typeof Activity; alert?: boolean }) {
  return <div className="rounded-md border border-border bg-card p-4"><div className="flex items-start justify-between"><p className="text-xs font-bold text-muted-foreground">{label}</p><Icon className={`size-4 ${alert ? "text-destructive" : "text-primary"}`} /></div><p className="mt-2 text-2xl font-extrabold text-navy">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></div>;
}

function PriorityBadge({ value }: { value: Priority }) {
  const style = value === "Critical" ? "bg-destructive text-destructive-foreground" : value === "High" ? "bg-accent text-accent-foreground" : value === "Medium" ? "bg-warning-soft text-foreground" : "bg-secondary text-secondary-foreground";
  return <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${style}`}>{value}</span>;
}

function CityMap({ compact = false }: { compact?: boolean }) {
  return <div className={`map-grid relative overflow-hidden rounded-md border border-border ${compact ? "min-h-64" : "min-h-[390px]"}`} aria-label="Map of active outages across Tshwane">
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-card/90 p-3 backdrop-blur"><div><p className="text-xs font-extrabold text-navy">LIVE NETWORK MAP</p><p className="text-[11px] text-muted-foreground">Tshwane metro · 21 active incidents</p></div><Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Center map"><LocateFixed /></Button></div>
    <div className="absolute left-[44%] top-[18%] h-[68%] w-[2px] rotate-[24deg] bg-card shadow-[0_0_0_5px_var(--color-card)]" />
    <div className="absolute left-[12%] top-[54%] h-[2px] w-[75%] -rotate-[8deg] bg-card shadow-[0_0_0_5px_var(--color-card)]" />
    <span className="absolute left-[44%] top-[42%] text-[11px] font-bold text-muted-foreground">PRETORIA</span><span className="absolute bottom-[14%] left-[51%] text-[11px] font-bold text-muted-foreground">CENTURION</span>
    {incidents.map((incident) => <button key={incident.id} className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-card bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-110 focus:scale-110" style={{ left: incident.x, top: incident.y }} aria-label={`${incident.priority} outage at ${incident.place}`}><Zap className="size-4" /></button>)}
    <div className="absolute bottom-3 left-3 rounded-md border border-border bg-card/95 px-3 py-2 text-[10px] font-bold shadow"><span className="mr-3"><i className="mr-1 inline-block size-2 rounded-full bg-destructive" /> Outage</span><span><i className="mr-1 inline-block size-2 rounded-full bg-success" /> Crew</span></div>
  </div>;
}

function DispatcherView() {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(primaryIncident);
  const [assigned, setAssigned] = useState<string | null>(null);
  const filtered = useMemo(() => filter === "All" ? incidents : incidents.filter((item) => item.priority === filter), [filter]);
  return <>
    <PageHeading eyebrow="Monday · 21 September" title="Control centre" text="City-wide electricity response overview" action={<Button><Radio /> Live operations</Button>} />
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Live response metrics">
      <Stat label="Active outages" value="21" note="4 since last hour" icon={Siren} alert /><Stat label="People affected" value="8,430" note="Across 7 service areas" icon={Users} /><Stat label="Avg. response" value="18 min" note="↓ 12% from last week" icon={Clock3} /><Stat label="Crews available" value="12 / 18" note="67% field capacity" icon={Wrench} />
    </section>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,.75fr)]">
      <CityMap />
      <section className="rounded-md border border-border bg-card" aria-labelledby="queue-title">
        <div className="border-b border-border p-4"><div className="flex items-center justify-between"><div><h2 id="queue-title" className="font-extrabold text-navy">Priority queue</h2><p className="text-xs text-muted-foreground">Sorted by risk and service impact</p></div><SlidersHorizontal className="size-4 text-muted-foreground" /></div>
          <div className="mt-3 flex gap-1 overflow-x-auto">{["All", "Critical", "High", "Medium"].map((item) => <Button key={item} size="sm" variant={filter === item ? "default" : "ghost"} onClick={() => setFilter(item)}>{item}</Button>)}</div>
        </div>
        <div className="max-h-[310px] overflow-y-auto">{filtered.map((incident) => <button key={incident.id} onClick={() => setSelected(incident)} className={`w-full border-b border-border p-4 text-left transition-colors hover:bg-secondary ${selected.id === incident.id ? "bg-secondary" : "bg-card"}`}><div className="flex items-center justify-between gap-2"><PriorityBadge value={incident.priority} /><span className="text-[11px] font-bold text-muted-foreground">{incident.age}</span></div><p className="mt-2 font-extrabold text-navy">{incident.place}</p><p className="text-xs text-muted-foreground">{incident.detail}</p><div className="mt-2 flex items-center justify-between text-xs"><span><Users className="mr-1 inline size-3" />{incident.people} affected</span><span className="font-bold text-primary">{incident.id}</span></div></button>)}</div>
      </section>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.7fr)]">
      <section className="rounded-md border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase text-destructive">Immediate assignment</p><h2 className="mt-1 text-xl font-extrabold text-navy">{selected.place}</h2><p className="text-sm text-muted-foreground">{selected.id} · {selected.people} consumers affected</p></div><PriorityBadge value={selected.priority} /></div><div className="mt-4 rounded-md bg-danger-soft p-3 text-sm"><AlertTriangle className="mr-2 inline size-4 text-destructive" /><strong>Possible duplicate:</strong> report #GG-4818 logged 420m away.</div><div className="mt-4 grid gap-2 sm:grid-cols-3">{technicians.map((tech) => <button key={tech.name} disabled={tech.status !== "Available"} onClick={() => setAssigned(tech.name)} className={`rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${assigned === tech.name ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary"}`}><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-secondary text-[10px] font-extrabold text-primary">{tech.initials}</span><span className="text-xs font-extrabold">{tech.name}</span></div><p className="mt-2 text-[11px] text-muted-foreground">{tech.skill} · {tech.distance}</p></button>)}</div><Button className="mt-4 w-full" disabled={!assigned} onClick={() => setAssigned(null)}><Send />{assigned ? `Dispatch ${assigned}` : "Select an available technician"}</Button></section>
      <section className="rounded-md border border-border bg-navy p-5 text-primary-foreground"><div className="flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase text-primary-foreground/60">Service target</p><h2 className="mt-1 text-lg font-extrabold">Restore power safely, faster</h2></div><Gauge className="size-7 text-accent" /></div><div className="mt-6 flex items-end gap-3"><span className="text-5xl font-extrabold">87%</span><span className="pb-1 text-sm text-primary-foreground/70">SLA compliance</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-primary-foreground/15"><div className="h-full w-[87%] bg-accent" /></div><p className="mt-4 text-xs text-primary-foreground/70">14 of 16 resolved incidents met today’s response target.</p></section>
    </div>
  </>;
}

function CustomerView() {
  const [submitted, setSubmitted] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmitted(true); }
  return <>
    <PageHeading eyebrow="Citizen services" title="Report an outage" text="Tell us what happened. Most reports take under two minutes." action={<div className="hidden rounded-full bg-success-soft px-3 py-2 text-xs font-bold text-success sm:block"><ShieldCheck className="mr-1 inline size-4" /> Secure report</div>} />
    {submitted ? <section className="rounded-md border border-border bg-card p-8 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-7" /></div><h2 className="mt-4 text-2xl font-extrabold text-navy">Report received</h2><p className="mt-1 text-muted-foreground">Reference #GG-4826 · We’re checking for nearby incidents.</p><Button className="mt-5" onClick={() => setSubmitted(false)}>Submit another report</Button></section> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_.8fr]"><form onSubmit={submit} className="rounded-md border border-border bg-card p-5 sm:p-6"><div className="grid gap-5 sm:grid-cols-2"><Field id="address" label="Service address"><Input id="address" required placeholder="Street and suburb" /></Field><Field id="account" label="Municipal account"><Input id="account" required placeholder="Account number" /></Field><Field id="contact" label="Contact number"><Input id="contact" required type="tel" placeholder="e.g. 082 000 0000" /></Field><Field id="type" label="Outage type"><select id="type" required className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"><option>Total blackout</option><option>Partial outage</option><option>Equipment damage</option><option>Other</option></select></Field></div><div className="mt-5"><Field id="description" label="What can you see?"><Textarea id="description" required className="min-h-28" placeholder="Describe the issue and any visible hazards" /></Field></div><Button className="mt-5 min-h-12 w-full text-base" type="submit"><Zap /> Send outage report</Button><p className="mt-3 text-center text-xs text-muted-foreground">If your connection drops, your report will be saved and sent automatically.</p></form><section className="rounded-md border border-border bg-navy p-6 text-primary-foreground"><p className="text-xs font-extrabold uppercase text-primary-foreground/60">Existing report</p><h2 className="mt-2 text-xl font-extrabold">#GG-4792 · Mamelodi East</h2><div className="mt-6 space-y-5">{["Report received", "Technician assigned", "En route · 12 min ETA", "Repair", "Restored"].map((step, index) => <div key={step} className="flex gap-3"><span className={`grid size-7 shrink-0 place-items-center rounded-full ${index < 2 ? "bg-success text-primary-foreground" : index === 2 ? "bg-accent text-accent-foreground" : "bg-primary-foreground/15 text-primary-foreground/50"}`}>{index < 2 ? <Check className="size-4" /> : index + 1}</span><div><p className="text-sm font-bold">{step}</p>{index === 2 && <p className="text-xs text-primary-foreground/60">Thabo is 4.8 km away</p>}</div></div>)}</div></section></div>}
  </>;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }

function TechnicianView() {
  const stages = ["Accepted", "En route", "On site", "In progress", "Complete"];
  const [stage, setStage] = useState(1);
  const [photo, setPhoto] = useState(false);
  return <>
    <PageHeading eyebrow="Field service" title="Active job · #GG-4821" text="Soshanguve Block H · Primary transformer failure" action={<span className="rounded-full bg-warning-soft px-3 py-2 text-xs font-extrabold">GPS ACTIVE</span>} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_.7fr]">
      <section className="space-y-5"><CityMap compact /><div className="rounded-md border border-border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><PriorityBadge value="Critical" /><h2 className="mt-3 text-xl font-extrabold text-navy">Main transformer · Block H</h2><p className="mt-1 text-sm text-muted-foreground">Sparks reported near the eastern enclosure. 5,240 residents affected.</p></div><Navigation className="size-7 shrink-0 text-primary" /></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Info label="Distance" value="5.2 km" /><Info label="ETA" value="12 min" /><Info label="Assigned" value="01:14" /></div></div></section>
      <section className="rounded-md border border-border bg-card p-5"><h2 className="font-extrabold text-navy">Update job progress</h2><p className="mt-1 text-xs text-muted-foreground">The citizen and control centre update instantly.</p><div className="mt-5 space-y-2">{stages.map((item, index) => <button key={item} onClick={() => setStage(index)} className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-3 text-left ${index === stage ? "border-primary bg-secondary" : index < stage ? "border-success bg-success-soft" : "border-border"}`}><span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${index < stage ? "bg-success text-primary-foreground" : index === stage ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < stage ? <Check className="size-4" /> : index + 1}</span><span className="text-sm font-bold">{item}</span>{index === stage && <span className="ml-auto text-[10px] font-extrabold uppercase text-primary">Current</span>}</button>)}</div><div className="mt-5 border-t border-border pt-5"><Label htmlFor="work-notes">Work notes</Label><Textarea id="work-notes" className="mt-2 min-h-24" placeholder="Describe the inspection or repair" /><Button variant="outline" className="mt-3 w-full" onClick={() => setPhoto(!photo)}><Camera />{photo ? "Photo attached" : "Add site photo"}</Button><Button className="mt-3 w-full" onClick={() => setStage(Math.min(4, stage + 1))}>{stage === 4 ? <><CheckCircle2 /> Job complete</> : <><ArrowRight /> Save and continue</>}</Button></div></section>
    </div>
  </>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-secondary p-3"><p className="text-[10px] font-extrabold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-extrabold text-navy">{value}</p></div>; }

function OperationsView() {
  const [range, setRange] = useState("7 days");
  return <>
    <PageHeading eyebrow="Municipal operations" title="Network intelligence" text="Performance, recurring faults and resource planning" action={<Button variant="outline" onClick={() => alert("Report prepared for download.")}><Download /> Export report</Button>} />
    <div className="mb-5 flex gap-2">{["24 hours", "7 days", "30 days"].map(item => <Button key={item} size="sm" variant={range === item ? "default" : "outline"} onClick={() => setRange(item)}>{item}</Button>)}</div>
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Stat label="Outages today" value="45" note="↓ 8% week on week" icon={Zap} /><Stat label="Response time" value="22 min" note="Target: under 30 min" icon={Clock3} /><Stat label="Resolution time" value="1h 45m" note="18 min faster" icon={Wrench} /><Stat label="SLA compliance" value="87%" note="Target: 85%" icon={ShieldCheck} /></section>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><section className="rounded-md border border-border bg-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-extrabold text-navy">Response time trend</h2><p className="text-xs text-muted-foreground">Average minutes to dispatch · {range}</p></div><Activity className="size-5 text-primary" /></div><div className="mt-8 flex h-56 items-end gap-3 border-b border-l border-border px-4">{[34,28,31,24,26,19,22].map((value, index) => <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-bold">{value}m</span><div className="w-full max-w-12 rounded-t bg-primary" style={{ height: `${value * 2.4}%` }} /><span className="text-[10px] text-muted-foreground">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][index]}</span></div>)}</div></section><CityMap compact /></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-md border border-border bg-card p-5"><h2 className="font-extrabold text-navy">Recurring hotspots</h2><div className="mt-4 space-y-4">{[["Soshanguve","12 outages","92%"],["Hatfield","8 outages","67%"],["Mamelodi","6 outages","48%"],["Menlyn","4 outages","31%"]].map(([area,count,width]) => <div key={area}><div className="flex justify-between text-xs"><span className="font-bold">{area}</span><span className="text-muted-foreground">{count}</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width }} /></div></div>)}</div></section><section className="rounded-md border border-border bg-card p-5"><h2 className="font-extrabold text-navy">Technician performance</h2><div className="mt-3 divide-y divide-border">{technicians.map((tech, index) => <div key={tech.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3"><span className="text-xs font-extrabold text-muted-foreground">0{index+1}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{tech.name}</p><p className="text-xs text-muted-foreground">{12-index*2} jobs completed</p></div><span className="text-sm font-extrabold text-success">{96-index*3}%</span></div>)}</div></section></div>
  </>;
}