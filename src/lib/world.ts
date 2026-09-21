import { followStore } from "@/lib/incidents";
import type { World } from "@/lib/notifications";
import { ticketStore } from "@/lib/nodes";
import { dispatchStore, reportStore } from "@/lib/reports";

/** The shared simulation state, live: it re-renders the caller whenever any tab changes any of it. */
export function useWorld(): World {
  return { reports: reportStore.use(), tickets: ticketStore.use(), dispatches: dispatchStore.use(), follows: followStore.use() };
}
