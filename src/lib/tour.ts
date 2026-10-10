import { createStore } from "@/lib/store";

/**
 * The first-visit guide. Each step is a cue card; `target` names the `data-tour` attribute of the part of the
 * page it explains. A step whose target is not on the page right now (for example the repair tracker before
 * the resident has reported anything) is shown as a card in the middle of the screen instead.
 */
export type TourStep = { target?: string | undefined; title: string; body: string };

/** When each user finished or skipped the guide, keyed by email. It is not cleared by "Reset simulation". */
export const tourSeenStore = createStore<Record<string, number>>("lesedilink.tour-seen", {});

export const hasSeenTour = (email: string) => tourSeenStore.get()[email] !== undefined;

export function markTourSeen(email: string) {
  tourSeenStore.set({ ...tourSeenStore.get(), [email]: Date.now() });
}
