import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { MockUser } from "@/components/lesedi/data";
import { useClock } from "@/lib/presence";
import { alertDevice, askDevicePermission, devicePermission, markRead, noticeSeenStore, noticesFor, type Notice } from "@/lib/notifications";
import { ago } from "@/lib/reports";
import { useWorld } from "@/lib/world";

const toneIcon = { info: Info, success: CircleCheck, warn: BellRing, danger: TriangleAlert } as const;
const toneColour = { info: "text-primary", success: "text-success", warn: "text-warning-foreground", danger: "text-destructive" } as const;
const when = (at: number) => (ago(at) === "Just now" ? "Just now" : `${ago(at)} ago`);

function announce(notice: Notice) {
  const show = notice.tone === "success" ? toast.success : notice.tone === "danger" ? toast.error : notice.tone === "warn" ? toast.warning : toast.info;
  show(notice.title, { description: notice.body, duration: 8000 });
  // Someone looking at another window or app still gets the alert.
  if (document.hidden || !document.hasFocus()) alertDevice(notice);
}

/**
 * The header bell: this user's real alerts, an unread count, a pop-up for each new one, and (once the user
 * allows it) device notifications. It works off shared state, so an alert appears at the same moment on every
 * dashboard that should hear about it.
 */
export function NotificationBell({ user }: { user: MockUser }) {
  const world = useWorld();
  const seen = noticeSeenStore.use();
  useClock(10000); // keeps "3 min ago" honest
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<ReturnType<typeof devicePermission>>("unsupported");
  const wrapper = useRef<HTMLDivElement>(null);
  const known = useRef<Set<string> | null>(null);

  const notices = useMemo(() => noticesFor(user, world), [user, world.reports, world.tickets, world.dispatches, world.follows]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastRead = seen[user.email] ?? 0;
  const unread = notices.filter((notice) => notice.at > lastRead).length;

  useEffect(() => setPermission(devicePermission()), []);

  // Pop up anything that arrives while this tab is open. What was already there when it opened stays quiet.
  useEffect(() => {
    if (known.current === null) {
      known.current = new Set(notices.map((notice) => notice.id));
      return;
    }
    const fresh = notices.filter((notice) => !known.current?.has(notice.id));
    if (fresh.length === 0) return;
    for (const notice of fresh) known.current.add(notice.id);
    for (const notice of [...fresh].reverse()) announce(notice);
  }, [notices]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function enableDeviceAlerts() {
    setPermission(await askDevicePermission());
  }

  return (
    <div ref={wrapper} className="relative">
      <Button variant="ghost" size="icon" className="relative min-h-11 min-w-11" aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell />
        {unread > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-extrabold leading-4 text-destructive-foreground">{unread > 9 ? "9+" : unread}</span>}
      </Button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-x-4 top-16 z-50 rounded-md border border-border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between gap-3 border-b border-border p-3">
            <p className="font-extrabold text-navy">Notifications</p>
            <Button variant="ghost" size="sm" className="min-h-9" disabled={unread === 0} onClick={() => markRead(user.email, notices)}>Mark all read</Button>
          </div>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {notices.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nothing yet. {user.role === "Customer" ? `We will tell you here the moment something happens${user.area ? ` in ${user.area}` : ""}, wherever you are.` : "New activity shows up here as it happens."}</li>}
            {notices.map((notice) => {
              const Icon = toneIcon[notice.tone];
              return (
                <li key={notice.id} className={`flex gap-3 p-3 ${notice.at > lastRead ? "bg-secondary" : ""}`}>
                  <Icon className={`mt-0.5 size-4 shrink-0 ${toneColour[notice.tone]}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{notice.title}</p>
                    <p className="text-xs text-muted-foreground">{notice.body}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{when(notice.at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {permission !== "unsupported" && (
            <div className="border-t border-border p-3 text-xs">
              {permission === "granted" && <p className="text-success"><strong>Device alerts are on.</strong> You will be told even when this tab is in the background.</p>}
              {permission === "denied" && <p className="text-muted-foreground">Device alerts are blocked. Allow notifications for this site in your browser settings to turn them on.</p>}
              {permission === "default" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-muted-foreground">Get an alert on this device even when the tab is in the background.</p>
                  <Button size="sm" className="min-h-9 shrink-0" onClick={enableDeviceAlerts}><BellRing /> Turn on</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
