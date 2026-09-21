import { useEffect, useState, useSyncExternalStore } from "react";

import type { MockUser, Role } from "@/components/lesedi/data";
import { startTimer } from "@/lib/timer";

/**
 * Who has a dashboard open right now. Every signed-in tab sends a heartbeat, and anyone whose last beat is
 * recent counts as online. The dispatcher uses it to see which crews can actually receive a job, and it is a
 * quick check that two windows really are sharing data (a technician in a different browser shows offline).
 *
 * Each tab writes its own storage key, so tabs never overwrite each other's heartbeat the way they would if
 * they all rewrote one shared list.
 */
export type Presence = { email: string; name: string; role: Role; at: number };

const PREFIX = "lesedilink.presence.";
export const BEAT_MS = 4000;
export const ONLINE_MS = 12000;
/** Entries this old belong to tabs that closed without saying goodbye. */
const FORGET_MS = 60000;

const tabId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

const EMPTY: Record<string, Presence> = {};
let snapshot: Record<string, Presence> = EMPTY;
let listening = false;
const listeners = new Set<() => void>();

function readAll(): Record<string, Presence> {
  const found: Record<string, Presence> = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (raw) found[key.slice(PREFIX.length)] = JSON.parse(raw) as Presence;
    }
  } catch {
    /* unreadable storage: nobody is online as far as this tab can tell */
  }
  return found;
}

function refresh() {
  snapshot = readAll();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    snapshot = readAll();
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key.startsWith(PREFIX)) refresh();
    });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Everyone's latest heartbeat, live. Pair it with `onlineEmails` and a clock to see who is online. */
export const usePresence = () => useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);

/** The emails that have at least one tab with a recent heartbeat. */
export function onlineEmails(presence: Record<string, Presence>, now = Date.now()): Set<string> {
  return new Set(Object.values(presence).filter((entry) => now - entry.at < ONLINE_MS).map((entry) => entry.email));
}

/** Sends this tab's heartbeat while a user is signed in, and says goodbye when the tab closes. */
export function usePresenceHeartbeat(user: MockUser | null) {
  const email = user?.email;
  const name = user?.name;
  const role = user?.role;

  useEffect(() => {
    if (!email || !name || !role) return;
    const key = `${PREFIX}${email}|${tabId}`;
    const beat = () => {
      const now = Date.now();
      try {
        localStorage.setItem(key, JSON.stringify({ email, name, role, at: now } satisfies Presence));
        // Tidy up after tabs that closed without saying goodbye.
        for (const [other, entry] of Object.entries(readAll())) {
          if (now - entry.at > FORGET_MS) localStorage.removeItem(`${PREFIX}${other}`);
        }
      } catch {
        /* storage full or blocked: this tab just will not show as online */
      }
      refresh();
    };
    const leave = () => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing to clean up */
      }
      refresh();
    };
    beat();
    const stop = startTimer(beat, BEAT_MS);
    window.addEventListener("pagehide", leave);
    return () => {
      stop();
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [email, name, role]);
}

/** Re-renders the caller every `every` ms, so "online" and "3 min ago" labels stay honest. */
export function useClock(every = 3000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}
