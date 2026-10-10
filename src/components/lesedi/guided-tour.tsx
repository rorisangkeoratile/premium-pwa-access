import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/components/lesedi/motion";
import type { TourStep } from "@/lib/tour";

const GAP = 12;
const PAD = 6;
const CARD_W = 384;
/** Below this width the card docks to the bottom of the screen instead of sitting beside what it explains. */
const DOCK_BELOW = 640;
/** Clear of the sticky dashboard header. */
const HEADER = 72;

type Box = { top: number; left: number; width: number; height: number };

function findTarget(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  // Hidden (e.g. a desktop-only element on a phone) counts as not on the page.
  return element && element.getClientRects().length > 0 ? element : null;
}

/** Scrolls so the target is in view: centred if it fits, otherwise its top just under the header. */
function bringIntoView(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const room = window.innerHeight - HEADER;
  const offset = rect.height + 2 * PAD < room * 0.6 ? HEADER + (room - rect.height) / 2 : HEADER + 16;
  // A target inside the sticky header is always in view.
  if (element.closest("header")) return;
  window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - offset), behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/**
 * A step-by-step guide over a dashboard. Each cue card points at one part of the page, which is lit up while
 * the rest is dimmed. Back and Next move between cards, and Skip (or Escape) ends the guide.
 * The page cannot be used underneath while the guide is open, so a stray tap does not start a report.
 */
export function GuidedTour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: (finished: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ width: 1024, height: 768 });
  const [cardHeight, setCardHeight] = useState(240);
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Start from the first card each time the guide opens, and give focus back to the page when it closes.
  useEffect(() => {
    if (!open) return;
    setIndex(0);
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => returnFocus.current?.focus?.();
  }, [open]);

  const measure = useCallback(() => {
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const element = findTarget(step?.target);
    if (!element) {
      setBox(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    if (element.closest("header")) {
      setBox({ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD });
      return;
    }
    // Clip to the screen below the header, so a tall section (the report form) still gets a sensible highlight.
    const top = Math.max(rect.top - PAD, HEADER - PAD);
    const bottom = Math.min(rect.bottom + PAD, window.innerHeight - PAD);
    setBox({ top, left: Math.max(PAD, rect.left - PAD), width: Math.min(rect.width + 2 * PAD, window.innerWidth - 2 * PAD), height: Math.max(0, bottom - top) });
  }, [step?.target]);

  // New card: scroll its target into view, then keep the highlight on it while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const element = findTarget(step?.target);
    if (element) bringIntoView(element);
    measure();
    heading.current?.focus({ preventScroll: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [open, index, measure]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (open && card.current) setCardHeight(card.current.offsetHeight);
  }, [open, index, viewport.width]);

  const back = () => setIndex((current) => Math.max(0, current - 1));
  const next = () => (last ? onClose(true) : setIndex((current) => Math.min(steps.length - 1, current + 1)));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(false);
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
      else if (event.key === "Tab" && card.current) {
        // Keep keyboard focus inside the card while the guide is open.
        const focusable = Array.from(card.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        const first = focusable[0];
        const end = focusable.at(-1);
        if (!first || !end) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); end.focus(); }
        else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); first.focus(); }
        else if (!card.current.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }); // re-bound each render so `next` and `back` see the current card

  if (!open || !step) return null;

  // Where the card goes: beside the highlight on a wide screen (below it if there is room, else above),
  // docked to the bottom on a phone or when neither fits, and in the middle when there is nothing to point at.
  const docked = viewport.width < DOCK_BELOW;
  let placement: CSSProperties;
  if (!box) {
    placement = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else {
    const left = Math.min(Math.max(16, box.left), viewport.width - CARD_W - 16);
    const below = box.top + box.height + GAP;
    const above = box.top - GAP - cardHeight;
    if (!docked && below + cardHeight <= viewport.height - 16) placement = { top: below, left };
    else if (!docked && above >= HEADER) placement = { top: above, left };
    else placement = { bottom: 16, left: 16, right: 16, marginInline: "auto" };
  }

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Catches taps on the page while the guide is open. The highlight's shadow does the dimming. */}
      <div className={`absolute inset-0 ${box ? "" : "bg-black/55"}`} aria-hidden="true" />
      {box && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-accent transition-[top,left,width,height] duration-300 motion-reduce:transition-none"
          style={{ ...box, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)" }}
        />
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute w-auto max-w-[min(24rem,calc(100vw-2rem))] rounded-md border border-border bg-card p-5 shadow-2xl sm:w-96"
        style={placement}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-primary"><Compass className="size-4" /> How it works · {index + 1} of {steps.length}</p>
          <Button variant="ghost" size="icon" className="-mr-2 size-9 shrink-0" aria-label="Close the guide" onClick={() => onClose(false)}><X /></Button>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {steps.map((item, position) => <span key={item.title} className={`h-1 flex-1 rounded-full ${position <= index ? "bg-primary" : "bg-muted"}`} />)}
        </div>
        <h2 id="tour-title" ref={heading} tabIndex={-1} className="mt-3 text-lg font-extrabold text-navy outline-none">{step.title}</h2>
        <p id="tour-body" className="mt-1 text-sm text-muted-foreground" aria-live="polite">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="min-h-11 px-2 text-muted-foreground" onClick={() => onClose(false)}>{last ? "Close" : "Skip guide"}</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11" disabled={index === 0} onClick={back}><ArrowLeft /> Back</Button>
            <Button className="min-h-11" onClick={next}>{last ? <><Check /> Got it</> : <>Next <ArrowRight /></>}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
