import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, Bell, LocateFixed, LogOut, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { incidents, type Priority } from "@/components/lesedi/data";
import { currentUser, signOut } from "@/lib/auth";

export function DashboardShell({ user, role, home, children }: { user: string; role: string; home: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const initials = user.split(" ").map((part) => part[0]).join("");

  // Only the logged-in user's own dashboard may render; anyone else is sent to login or to their own dashboard.
  useEffect(() => {
    const session = currentUser();
    if (!session) navigate({ to: "/login", replace: true });
    else if (session.to !== home) navigate({ to: session.to, replace: true });
    else setAllowed(true);
  }, [home, navigate]);

  function logout() {
    signOut();
    navigate({ to: "/login", replace: true });
  }

  if (!allowed) return <div className="min-h-dvh bg-background" aria-busy="true" />;

  return (
    <div className="min-h-dvh bg-background">
      <a href="#workspace" className="sr-only z-50 bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to workspace</a>
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto grid h-16 max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><Zap className="size-5" aria-hidden="true" /></div>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold text-navy">Lesedi<span className="text-primary">Link</span></p>
              <p className="hidden text-[11px] font-semibold uppercase text-muted-foreground sm:block">Municipal electricity response</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success md:flex"><span className="size-2 rounded-full bg-success" />All systems live</div>
            <Button variant="ghost" size="icon" className="relative min-h-11 min-w-11" aria-label="Open notifications" onClick={() => setNoticeOpen(!noticeOpen)}>
              <Bell /><span className="absolute right-2 top-2 size-2 rounded-full bg-destructive" />
            </Button>
            <div className="hidden items-center gap-2 border-l border-border pl-4 sm:flex">
              <div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-extrabold text-primary">{initials}</div>
              <div><p className="text-xs font-bold">{user}</p><p className="text-[11px] text-muted-foreground">{role}</p></div>
            </div>
            <Button variant="outline" className="min-h-11" onClick={logout}><LogOut /> <span className="hidden sm:inline">Log out</span><span className="sr-only sm:hidden">Log out</span></Button>
          </div>
        </div>
        {noticeOpen && <div className="absolute right-4 top-14 w-[min(360px,calc(100vw-2rem))] rounded-md border border-border bg-card p-4 shadow-xl"><p className="font-bold">3 new updates</p><p className="mt-2 text-sm text-muted-foreground">Critical outage #LL-4821 requires assignment.</p><Button className="mt-3 w-full" size="sm" onClick={() => setNoticeOpen(false)}>View updates</Button></div>}
      </header>

      <main id="workspace" className="mx-auto min-w-0 max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

export function PageHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: ReactNode }) {
  return <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"><div className="min-w-0"><p className="text-[11px] font-extrabold uppercase text-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>{action}</div>;
}

export function Stat({ label, value, note, icon: Icon, alert = false }: { label: string; value: string; note: string; icon: typeof Activity; alert?: boolean }) {
  return <div className="rounded-md border border-border bg-card p-4"><div className="flex items-start justify-between"><p className="text-xs font-bold text-muted-foreground">{label}</p><Icon className={`size-4 ${alert ? "text-destructive" : "text-primary"}`} /></div><p className="mt-2 text-2xl font-extrabold text-navy">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></div>;
}

export function PriorityBadge({ value }: { value: Priority }) {
  const style = value === "Critical" ? "bg-destructive text-destructive-foreground" : value === "High" ? "bg-accent text-accent-foreground" : value === "Medium" ? "bg-warning-soft text-foreground" : "bg-secondary text-secondary-foreground";
  return <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${style}`}>{value}</span>;
}

export function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-secondary p-3"><p className="text-[10px] font-extrabold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-extrabold text-navy">{value}</p></div>;
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

export function CityMap({ compact = false }: { compact?: boolean }) {
  return <div className={`map-grid relative overflow-hidden rounded-md border border-border ${compact ? "min-h-64" : "min-h-[390px]"}`} aria-label="Map of active outages across Tshwane">
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-card/90 p-3 backdrop-blur"><div><p className="text-xs font-extrabold text-navy">LIVE NETWORK MAP</p><p className="text-[11px] text-muted-foreground">Tshwane metro · 21 active incidents</p></div><Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Center map"><LocateFixed /></Button></div>
    <div className="absolute left-[44%] top-[18%] h-[68%] w-[2px] rotate-[24deg] bg-card shadow-[0_0_0_5px_var(--color-card)]" />
    <div className="absolute left-[12%] top-[54%] h-[2px] w-[75%] -rotate-[8deg] bg-card shadow-[0_0_0_5px_var(--color-card)]" />
    <span className="absolute left-[44%] top-[42%] text-[11px] font-bold text-muted-foreground">PRETORIA</span><span className="absolute bottom-[14%] left-[51%] text-[11px] font-bold text-muted-foreground">CENTURION</span>
    {incidents.map((incident) => <button key={incident.id} className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-card bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-110 focus:scale-110" style={{ left: incident.x, top: incident.y }} aria-label={`${incident.priority} outage at ${incident.place}`}><Zap className="size-4" /></button>)}
    <div className="absolute bottom-3 left-3 rounded-md border border-border bg-card/95 px-3 py-2 text-[10px] font-bold shadow"><span className="mr-3"><i className="mr-1 inline-block size-2 rounded-full bg-destructive" /> Outage</span><span><i className="mr-1 inline-block size-2 rounded-full bg-success" /> Crew</span></div>
  </div>;
}
