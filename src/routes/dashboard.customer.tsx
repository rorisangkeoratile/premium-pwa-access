import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Bell, Check, CheckCircle2, Clock3, FileText, ShieldCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DashboardShell, Field, PageHeading, Stat } from "@/components/lesedi/shell";

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

function CustomerDashboard() {
  const [submitted, setSubmitted] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmitted(true); }

  return (
    <DashboardShell home="/dashboard/customer" user="Lerato Sithole" role="Resident · Mamelodi East">
      <PageHeading eyebrow="Customer" title="My power" text="Report a fault, follow the repair and stay ahead of planned interruptions." action={<div className="hidden rounded-full bg-success-soft px-3 py-2 text-xs font-bold text-success sm:block"><ShieldCheck className="mr-1 inline size-4" /> Secure report</div>} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Account summary">
        <Stat label="Supply status" value="Restored" note="Since 04:12 today" icon={Zap} />
        <Stat label="Open reports" value="1" note="#LL-4792 in progress" icon={FileText} />
        <Stat label="Next planned outage" value="Thu 09:00" note="Maintenance · 3 hours" icon={Clock3} />
        <Stat label="Area alerts" value="2" note="Tap to review notices" icon={Bell} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_.8fr]">
        {submitted ? (
          <section className="rounded-md border border-border bg-card p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-7" /></div>
            <h2 className="mt-4 text-2xl font-extrabold text-navy">Report received</h2>
            <p className="mt-1 text-muted-foreground">Reference #LL-4826 · We're checking for nearby incidents.</p>
            <Button className="mt-5" onClick={() => setSubmitted(false)}>Submit another report</Button>
          </section>
        ) : (
          <form onSubmit={submit} className="rounded-md border border-border bg-card p-5 sm:p-6">
            <h2 className="font-extrabold text-navy">Report an outage</h2>
            <p className="mt-1 text-xs text-muted-foreground">Most reports take under two minutes.</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field id="address" label="Service address"><Input id="address" required placeholder="Street and suburb" /></Field>
              <Field id="account" label="Municipal account"><Input id="account" required placeholder="Account number" /></Field>
              <Field id="contact" label="Contact number"><Input id="contact" required type="tel" placeholder="e.g. 082 000 0000" /></Field>
              <Field id="type" label="Outage type">
                <select id="type" required className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
                  <option>Total blackout</option><option>Partial outage</option><option>Equipment damage</option><option>Other</option>
                </select>
              </Field>
            </div>
            <div className="mt-5"><Field id="description" label="What can you see?"><Textarea id="description" required className="min-h-28" placeholder="Describe the issue and any visible hazards" /></Field></div>
            <Button className="mt-5 min-h-12 w-full text-base" type="submit"><Zap /> Send outage report</Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">If your connection drops, your report is saved and sent automatically.</p>
          </form>
        )}

        <section className="rounded-md border border-border bg-navy p-6 text-primary-foreground">
          <p className="text-xs font-extrabold uppercase text-primary-foreground/60">Existing report</p>
          <h2 className="mt-2 text-xl font-extrabold">#LL-4792 · Mamelodi East</h2>
          <div className="mt-6 space-y-5">
            {["Report received", "Technician assigned", "En route · 12 min ETA", "Repair", "Restored"].map((step, index) => (
              <div key={step} className="flex gap-3">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full ${index < 2 ? "bg-success text-primary-foreground" : index === 2 ? "bg-accent text-accent-foreground" : "bg-primary-foreground/15 text-primary-foreground/50"}`}>{index < 2 ? <Check className="size-4" /> : index + 1}</span>
                <div><p className="text-sm font-bold">{step}</p>{index === 2 && <p className="text-xs text-primary-foreground/60">Thabo is 4.8 km away</p>}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">Notices for your area</h2>
          <div className="mt-4 space-y-3">
            {[["Planned maintenance", "Thursday 09:00 – 12:00 · Mamelodi East feeder"], ["Load reduction", "Evening peak 18:00 – 20:00 · Stage 2"]].map(([title, text]) => (
              <div key={title} className="rounded-md border border-border bg-secondary p-4"><p className="text-sm font-bold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-extrabold text-navy">My report history</h2>
          <div className="mt-3 divide-y divide-border">
            {[["#LL-4792", "Total blackout", "In progress"], ["#LL-4610", "Partial outage", "Resolved in 2h 10m"], ["#LL-4388", "Equipment damage", "Resolved in 5h 40m"]].map(([id, type, status]) => (
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
