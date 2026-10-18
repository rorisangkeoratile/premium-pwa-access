import { useEffect, useState, type ReactNode } from "react";
import { Bell, Check, CheckCircle2, HardHat, House, MapPin, Pause, Phone, Play, Pointer, Star, Truck, TriangleAlert, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/components/lesedi/motion";
import type { TourDemoName } from "@/lib/tour";

/** How long each frame shows, and the longer hold on the last one before the animation starts again. */
const FRAME_MS = 1900;
const LAST_MS = 3000;

const fade = (shown: boolean) => `transition-all duration-500 ${shown ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"}`;

/** A finger that glides to a spot on the little screen (in percent) and taps it. */
function Finger({ at, tap, frame }: { at: [number, number] | null; tap: boolean; frame: number }) {
  return (
    <span className={`absolute z-20 transition-all duration-700 ease-in-out ${at ? "opacity-100" : "opacity-0"}`} style={{ left: `${at?.[0] ?? 50}%`, top: `${at?.[1] ?? 110}%` }}>
      {tap && <span key={frame} className="tour-tap absolute -left-3 -top-3 size-6 rounded-full bg-primary/50" />}
      <Pointer className="relative -ml-[7px] -mt-px size-6 fill-card text-navy drop-shadow" />
    </span>
  );
}

const sendRows: { icon: typeof MapPin; text: string }[] = [
  { icon: MapPin, text: "Mamelodi East · 12 Tsamaya Rd" },
  { icon: TriangleAlert, text: "My street or area · No power" },
  { icon: Phone, text: "We call you on 082 000 0000" },
];

type Scene = { captions: string[]; render: (frame: number) => ReactNode };

const scenes: Record<TourDemoName, Scene> = {
  alerts: {
    captions: ["An update comes in about your outage", "The bell shows a new alert", "Tap it to read every update", "Tap “Turn on” to get alerts on this phone"],
    render: (frame) => (
      <>
        <div className="flex h-9 items-center justify-between bg-navy-gradient px-3 text-[11px] font-extrabold text-primary-foreground">
          LesediLink
          <span className="relative grid size-7 place-items-center rounded-full bg-primary-foreground/10">
            <Bell className="size-4" />
            <span className={`absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-accent text-[9px] text-accent-foreground transition-transform duration-300 ${frame >= 1 ? "scale-100" : "scale-0"}`}>1</span>
          </span>
        </div>
        <div className={`absolute right-2 top-10 w-[78%] rounded-md border border-border bg-card p-2 text-[10px] shadow-lg ${fade(frame >= 2)}`}>
          <p className="rounded bg-secondary px-2 py-1"><strong>On the way</strong> · Thabo · ETA 14:20</p>
          <p className="mt-1 px-2 text-muted-foreground">Technician assigned · 13:52</p>
          <div className="mt-1.5 flex items-center justify-between border-t border-border px-2 pt-1.5">
            <span>Alerts on this phone</span>
            <span className={`rounded px-2 py-0.5 font-bold transition-colors duration-300 ${frame >= 3 ? "bg-success text-primary-foreground" : "bg-primary text-primary-foreground"}`}>{frame >= 3 ? "On ✓" : "Turn on"}</span>
          </div>
        </div>
        <Finger frame={frame} at={frame === 0 ? null : frame <= 2 ? [88, 16] : [86, 84]} tap={frame >= 2} />
      </>
    ),
  },
  home: {
    captions: ["Your home area has power", "The power goes off at home", "We alert you, wherever you are"],
    render: (frame) => (
      <>
        <div className={`absolute inset-x-3 top-9 rounded-md border p-3 transition-colors duration-500 ${frame >= 1 ? "border-destructive bg-danger-soft" : "border-border bg-card"}`}>
          <p className="text-[9px] font-extrabold uppercase text-primary">Home · Mamelodi East</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-extrabold text-navy"><House className="size-3.5" /> {frame >= 1 ? "Power outage at Mamelodi East" : "Power is on at home"}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{frame >= 1 ? "We are tracking it for you." : "No outages reported."}</p>
        </div>
        <div className={`absolute inset-x-3 top-1.5 flex items-center gap-2 rounded-md bg-navy-gradient px-2.5 py-1.5 text-[10px] text-primary-foreground shadow-lg ${fade(frame >= 2)}`}>
          <Zap className="size-3.5 shrink-0 text-accent" /> <span><strong>LesediLink</strong> · Power outage at your home area</span>
        </div>
      </>
    ),
  },
  tracker: {
    captions: ["Your report is received", "A technician, Thabo, is assigned", "Watch Thabo on the map, with his ETA", "Thabo is at the fault, fixing it", "Your power is back on"],
    render: (frame) => {
      const steps = ["Reported", "Assigned", "On the way", "On site", "Restored"];
      return (
        <div className="p-3">
          <ol className="flex items-center gap-1">
            {steps.map((step, index) => (
              <li key={step} className="flex flex-1 flex-col items-center gap-1">
                <span className={`grid size-5 place-items-center rounded-full text-[9px] font-bold transition-colors duration-500 ${index < frame ? "bg-success text-primary-foreground" : index === frame ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{index < frame || frame === 4 ? <Check className="size-3" /> : index + 1}</span>
                <span className={`text-center text-[8.5px] font-bold leading-tight ${index <= frame ? "text-navy" : "text-muted-foreground"}`}>{step}</span>
              </li>
            ))}
          </ol>
          <div className="relative mt-3 h-12 rounded-md bg-secondary">
            <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-border" />
            <span className={`absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out ${frame >= 1 ? "opacity-100" : "opacity-0"}`} style={{ left: `${[4, 6, 42, 74, 74][frame]}%` }}>
              <Truck className="size-5 text-primary" />
            </span>
            <span className={`absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full transition-colors duration-500 ${frame === 4 ? "bg-accent text-accent-foreground" : "bg-card text-navy"}`}>{frame === 4 ? <Zap className="size-4" /> : <House className="size-4" />}</span>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{frame === 0 ? "Waiting for a crew to be assigned" : frame === 1 ? "Thabo · leaving the depot" : frame === 2 ? <><strong className="text-navy">Thabo · ETA 14:20</strong> · done by 16:00</> : frame === 3 ? <><strong className="text-navy">Thabo is on site</strong> · done by 16:00</> : <strong className="text-success">Power restored · 15:41</strong>}</p>
        </div>
      );
    },
  },
  send: {
    captions: ["Location, problem and number are filled in", "Tap “Send outage report”", "It goes to the control centre", "You get a reference number straight away"],
    render: (frame) => (
      <div className="p-3">
        <ul className={`space-y-1 text-[10px] transition-opacity duration-500 ${frame === 3 ? "opacity-0" : ""}`}>
          {sendRows.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-1.5 rounded bg-secondary px-2 py-1"><Icon className="size-3 text-primary" /> <span className="flex-1">{text}</span> <Check className="size-3 text-success" /></li>
          ))}
        </ul>
        <span className={`absolute inset-x-3 bottom-3 flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary text-[11px] font-bold text-primary-foreground transition-opacity duration-500 ${frame === 3 ? "opacity-0" : ""}`}><Zap className="size-3.5" /> {frame === 2 ? "Sending…" : "Send outage report"}</span>
        <div className={`absolute inset-0 grid place-items-center bg-card text-center ${fade(frame === 3)}`}>
          <div>
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-1 text-sm font-extrabold text-navy">Report received</p>
            <p className="text-[10px] text-muted-foreground">Reference #LL-5012</p>
          </div>
        </div>
        <Finger frame={frame} at={frame === 0 || frame === 3 ? null : [55, 84]} tap={frame === 2} />
      </div>
    ),
  },
  visit: {
    captions: ["The technician gives you a Visit code at your gate", "Type it on your dashboard", "Check every number", "It matches, so you can let them in", "After the repair, confirm your power is back"],
    render: (frame) => {
      const typed = ["", "48", "4821", "4821", "4821"][frame] ?? "";
      return (
        <div className="p-3">
          <div className="flex items-start gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><HardHat className="size-4" /></span>
            <p className="rounded-md rounded-tl-none bg-secondary px-2.5 py-1.5 text-[10px]">Hi, I am Thabo. My Visit code is <strong className="tracking-widest">4 8 2 1</strong></p>
          </div>
          <div className={`mt-2.5 transition-opacity duration-500 ${frame === 4 ? "opacity-0" : ""}`}>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((slot) => (
                <span key={slot} className={`grid size-8 place-items-center rounded-md border-2 text-sm font-extrabold transition-colors duration-300 ${frame === 3 ? "border-success text-success" : typed[slot] ? "border-primary text-navy" : "border-border"}`}>{typed[slot] ?? ""}</span>
              ))}
            </div>
            <p className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold text-success ${fade(frame === 3)}`}><CheckCircle2 className="size-3.5" /> Code matches · Thabo is your technician</p>
          </div>
          <div className={`absolute inset-x-3 bottom-3 flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-2 text-[10px] ${fade(frame === 4)}`}>
            <span className="font-bold text-navy">Is your power back on?</span>
            <span className="rounded bg-primary px-2.5 py-1 font-bold text-primary-foreground">Yes</span>
          </div>
          <Finger frame={frame} at={frame === 4 ? [88, 86] : null} tap={frame === 4} />
        </div>
      );
    },
  },
  feedback: {
    captions: ["“How did we do?” appears once it is fixed", "Tap a star to rate the service", "Add a comment if you like", "Send it, and the finished report clears"],
    render: (frame) => (
      <div className="p-3">
        <div className={`rounded-md border border-border bg-card p-2.5 transition-all duration-500 ${frame === 3 ? "scale-95 opacity-0" : ""}`}>
          <p className="text-xs font-extrabold text-navy">How did we do?</p>
          <p className="text-[10px] text-muted-foreground">Mamelodi East · fixed in 1h 49m</p>
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`size-5 transition-colors duration-300 ${frame >= 1 && star <= 4 ? "fill-accent text-accent" : "text-muted-foreground"}`} />)}
          </div>
          <p className={`mt-1.5 h-6 rounded border border-input px-2 py-1 text-[10px] ${frame >= 2 ? "" : "text-muted-foreground"}`}>{frame >= 2 ? "Quick and friendly, thank you" : "Add a comment (optional)"}</p>
        </div>
        <div className={`absolute inset-0 grid place-items-center text-center ${fade(frame === 3)}`}>
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-success"><CheckCircle2 className="size-5" /> Thank you for your feedback</p>
        </div>
        <Finger frame={frame} at={frame === 1 ? [37, 53] : frame === 2 ? [60, 76] : null} tap={frame === 1} />
      </div>
    ),
  },
};

/**
 * A short looping animation of one part of the dashboard at work, like a little video, with a caption for each
 * moment. It plays by itself, can be paused, and each dot jumps to that moment. With reduced motion it starts
 * paused and changes without movement, so the resident steps through it with the dots or Play.
 */
export function TourDemo({ name }: { name: TourDemoName }) {
  const scene = scenes[name];
  const count = scene.captions.length;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!playing) return;
    const last = frame === count - 1;
    const timer = setTimeout(() => setFrame(last ? 0 : frame + 1), last ? LAST_MS : FRAME_MS);
    return () => clearTimeout(timer);
  }, [playing, frame, count]);

  return (
    <figure className="mt-3 overflow-hidden rounded-md border border-border">
      <div className="tour-demo relative h-36 overflow-hidden bg-background" aria-hidden="true">{scene.render(frame)}</div>
      <figcaption className="flex items-center gap-1 border-t border-border bg-secondary py-1 pl-1 pr-2">
        <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={playing ? "Pause the animation" : "Play the animation"} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</Button>
        <p className="min-w-0 flex-1 text-xs font-bold text-navy">{scene.captions[frame]}</p>
        <span className="flex shrink-0">
          {scene.captions.map((caption, index) => (
            <button key={caption} type="button" className="grid size-6 place-items-center rounded-full" aria-label={`Show moment ${index + 1} of ${count}: ${caption}`} aria-current={index === frame ? "step" : undefined} onClick={() => { setFrame(index); setPlaying(false); }}>
              <span className={`size-1.5 rounded-full transition-colors ${index === frame ? "bg-primary" : "bg-muted-foreground/40"}`} />
            </button>
          ))}
        </span>
      </figcaption>
    </figure>
  );
}
