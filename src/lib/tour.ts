import { createStore } from "@/lib/store";

/** The short animations a step can play, each showing one part of the dashboard at work. */
export type TourDemoName = "alerts" | "home" | "tracker" | "send" | "visit" | "feedback";

/**
 * A step the resident does for real: the highlighted part stays usable, and the card waits until they have
 * done it. `on` is the event that counts (a tap by default) and `selector` narrows it to one control inside the part.
 */
export type TourTry = { prompt: string; done: string; on?: "click" | "change" | undefined; selector?: string | undefined };

/**
 * The first-visit guide. Each step is a cue card; `target` names the `data-tour` attribute of the part of the
 * page it explains. A step whose target is not on the page right now (for example the repair tracker before
 * the resident has reported anything) is shown as a card in the middle of the screen instead.
 * A step can also ask the resident to try the part (`tryIt`), or play an animation of it working (`demo`).
 */
export type TourStep = { target?: string | undefined; title: string; body: string; demo?: TourDemoName | undefined; tryIt?: TourTry | undefined };

/** When each user finished or skipped the guide, keyed by email. It is not cleared by "Reset simulation". */
export const tourSeenStore = createStore<Record<string, number>>("lesedilink.tour-seen", {});

export const hasSeenTour = (email: string) => tourSeenStore.get()[email] !== undefined;

export function markTourSeen(email: string) {
  tourSeenStore.set({ ...tourSeenStore.get(), [email]: Date.now() });
}
