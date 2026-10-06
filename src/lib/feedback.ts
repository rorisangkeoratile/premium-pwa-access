import { STAGE, dispatchStore, isResolved, updateJob } from "@/lib/reports";
import { createStore } from "@/lib/store";

/**
 * What a resident thought of the service once their outage was resolved. It is how the city hears whether
 * it is actually serving people, beside the response-time numbers it measures itself.
 */
export type Feedback = {
  /** The resident's own report. A merged report rates the incident it was merged into. */
  reportId: string;
  incidentId: string;
  by: string;
  /** 1 (very poor) to 5 (excellent). */
  rating: number;
  /** Did the city keep them informed and meet the times it gave them? */
  keptInformed: boolean;
  tags: string[];
  comment?: string | undefined;
  at: number;
};

export const FEEDBACK_TAGS = ["Fixed quickly", "Kept me updated", "Friendly crew", "Took too long", "Times given were not met", "Problem came back"] as const;
export const RATING_WORDS = ["", "Very poor", "Poor", "Okay", "Good", "Excellent"] as const;

/** Feedback per report id: one per resident report. */
export const feedbackStore = createStore<Record<string, Feedback>>("lesedilink.feedback", {});

/**
 * Saves the resident's feedback. When it comes from the person who opened the incident, and the repair is
 * resolved, the incident is closed: the city has heard back from the resident it was serving.
 */
export function submitFeedback(feedback: Omit<Feedback, "at">, opener: boolean) {
  feedbackStore.set({ ...feedbackStore.get(), [feedback.reportId]: { ...feedback, at: Date.now() } });
  const dispatch = dispatchStore.get()[feedback.incidentId];
  if (opener && dispatch && isResolved(dispatch.stage) && dispatch.stage !== STAGE.closed) {
    updateJob(feedback.incidentId, STAGE.closed, `Closed after the resident's feedback: ${feedback.rating}/5.`, undefined, "resident");
  }
}

/** The control centre closes a resolved incident itself, for example when the resident does not respond. */
export function closeIncident(id: string) {
  const dispatch = dispatchStore.get()[id];
  if (!dispatch || !isResolved(dispatch.stage) || dispatch.stage === STAGE.closed) return;
  updateJob(id, STAGE.closed, "Closed by the control centre.", undefined, "control");
}
