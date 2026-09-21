import { useEffect, useMemo, useRef } from "react";

import { prefersReducedMotion } from "@/components/lesedi/motion";

type Point = [number, number];
type Pylon = { cx: number; base: number; height: number; width: number };
type Built = { path: string; tips: { left: Point; right: Point }[]; top: Point };

const LEVELS = 8;
const ARM_AT = [0.66, 0.8, 0.93]; // where the three cross-arms sit, as a share of the tower's height
const ARM_LEN = [0.95, 0.78, 0.58]; // arm length as a share of the tower's base width

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round = (n: number) => Math.round(n * 10) / 10;

/** Half the tower's width at height share `t` (0 at the ground, 1 at the peak). */
const halfWidth = (tower: Pylon, t: number) => lerp(tower.width / 2, tower.width * 0.05, t);

/** A lattice transmission pylon: tapering legs, cross-bracing, three cross-arms and insulators. */
function pylon(tower: Pylon): Built {
  const { cx, base, height } = tower;
  const y = (t: number) => base - height * t;
  const d: string[] = [];

  d.push(`M${round(cx - halfWidth(tower, 0))} ${round(y(0))}L${round(cx - halfWidth(tower, 1))} ${round(y(1))}`);
  d.push(`M${round(cx + halfWidth(tower, 0))} ${round(y(0))}L${round(cx + halfWidth(tower, 1))} ${round(y(1))}`);

  for (let i = 0; i <= LEVELS; i++) {
    const t = i / LEVELS;
    d.push(`M${round(cx - halfWidth(tower, t))} ${round(y(t))}L${round(cx + halfWidth(tower, t))} ${round(y(t))}`);
    if (i < LEVELS) {
      const n = (i + 1) / LEVELS;
      d.push(`M${round(cx - halfWidth(tower, t))} ${round(y(t))}L${round(cx + halfWidth(tower, n))} ${round(y(n))}`);
      d.push(`M${round(cx + halfWidth(tower, t))} ${round(y(t))}L${round(cx - halfWidth(tower, n))} ${round(y(n))}`);
    }
  }

  d.push(`M${round(cx)} ${round(y(1))}L${round(cx)} ${round(y(1) - height * 0.07)}`); // the ground-wire spike

  const tips: Built["tips"] = [];
  ARM_AT.forEach((t, index) => {
    const arm = tower.width * (ARM_LEN[index] ?? 0.6);
    const hw = halfWidth(tower, t);
    const drop = height * 0.045;
    const ay = y(t);
    d.push(`M${round(cx - hw - arm)} ${round(ay)}L${round(cx + hw + arm)} ${round(ay)}`);
    d.push(`M${round(cx - hw - arm)} ${round(ay)}L${round(cx - hw)} ${round(ay + height * 0.05)}`);
    d.push(`M${round(cx + hw + arm)} ${round(ay)}L${round(cx + hw)} ${round(ay + height * 0.05)}`);
    d.push(`M${round(cx - hw - arm)} ${round(ay)}v${round(drop)}M${round(cx + hw + arm)} ${round(ay)}v${round(drop)}`);
    tips.push({ left: [cx - hw - arm, ay + drop], right: [cx + hw + arm, ay + drop] });
  });

  return { path: d.join(""), tips, top: [cx, y(1) - height * 0.07] };
}

/** A sagging conductor between two attachment points. */
const wire = ([ax, ay]: Point, [bx, by]: Point) => `M${round(ax)} ${round(ay)}Q${round((ax + bx) / 2)} ${round(Math.max(ay, by) + Math.abs(bx - ax) * 0.11)} ${round(bx)} ${round(by)}`;

/** Every conductor between neighbouring towers: three arms, so three wires per span. */
function wires(towers: Built[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < towers.length - 1; i++) {
    const from = towers[i];
    const to = towers[i + 1];
    if (!from || !to) continue;
    from.tips.forEach((tip, k) => {
      const other = to.tips[k];
      if (other) out.push(wire(tip.right, other.left));
    });
  }
  return out;
}

type Layer = { towers: Pylon[]; stroke: string; opacity: number; line: number; depth: number; pulses: boolean };

const LAYERS: Layer[] = [
  { towers: [-40, 170, 380, 590, 800, 1010, 1220].map((cx) => ({ cx, base: 500, height: 130, width: 44 })), stroke: "oklch(0.85 0.05 240)", opacity: 0.16, line: 1, depth: 6, pulses: false },
  { towers: [60, 470, 880, 1290].map((cx) => ({ cx, base: 545, height: 250, width: 88 })), stroke: "oklch(0.88 0.04 240)", opacity: 0.3, line: 1.4, depth: 14, pulses: true },
  { towers: [640, 1160].map((cx) => ({ cx, base: 640, height: 500, width: 190 })), stroke: "oklch(0.93 0.03 240)", opacity: 0.55, line: 2.6, depth: 26, pulses: true },
];

/**
 * Decorative electricity-tower artwork for the hero. It is purely visual (hidden from screen readers),
 * sits behind the text, drifts gently with scroll and pointer movement, and sends pulses of light along the wires.
 */
export function TowerScape({ className = "" }: { className?: string }) {
  const groups = useRef<(SVGGElement | null)[]>([]);
  const built = useMemo(() => LAYERS.map((layer) => layer.towers.map(pylon)), []);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    let pointer = 0;
    const apply = () => {
      frame = 0;
      const scroll = Math.min(window.scrollY, 700);
      groups.current.forEach((group, index) => {
        const depth = LAYERS[index]?.depth ?? 0;
        group?.setAttribute("transform", `translate(${round(pointer * depth)} ${round(scroll * depth * 0.012)})`);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onMove = (event: PointerEvent) => {
      pointer = event.clientX / window.innerWidth - 0.5;
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg className={className} viewBox="0 0 1200 640" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="hill-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.3 0.08 252)" stopOpacity="0.55" /><stop offset="1" stopColor="oklch(0.2 0.06 254)" stopOpacity="0.9" /></linearGradient>
        <linearGradient id="hill-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.24 0.07 252)" stopOpacity="0.85" /><stop offset="1" stopColor="oklch(0.17 0.05 255)" /></linearGradient>
      </defs>

      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} className="spark" cx={(i * 197) % 1200} cy={((i * 83) % 260) + 12} r={i % 3 === 0 ? 1.6 : 1} fill="oklch(0.95 0.03 230)" style={{ animationDelay: `${(i % 9) * 0.7}s` }} />
      ))}

      <path d="M0 470C160 430 300 455 470 425S800 395 1000 430 1150 450 1200 440V640H0Z" fill="url(#hill-far)" />

      {LAYERS.map((layer, index) => {
        const towers = built[index] ?? [];
        const lines = wires(towers);
        return (
          <g key={index} className="tower-layer" ref={(node) => { groups.current[index] = node; }}>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" stroke={layer.stroke} opacity={layer.opacity}>
              {towers.map((tower, i) => <path key={i} d={tower.path} strokeWidth={layer.line} />)}
              {lines.map((d, i) => <path key={`w${i}`} d={d} strokeWidth={Math.max(0.8, layer.line * 0.55)} />)}
            </g>
            {layer.pulses && (
              <g fill="none" strokeLinecap="round" stroke="oklch(0.85 0.15 60)" strokeWidth={Math.max(1.4, layer.line * 0.9)} opacity={Math.min(1, layer.opacity + 0.35)}>
                {lines.map((d, i) => <path key={`p${i}`} d={d} pathLength={100} className="wire-pulse" style={{ animationDelay: `${(i % 6) * 0.7}s`, animationDuration: `${3.6 + (i % 4) * 0.6}s` }} />)}
              </g>
            )}
            {towers.map((tower, i) => <circle key={`b${i}`} className="beacon" cx={tower.top[0]} cy={tower.top[1]} r={layer.line * 1.6} fill="oklch(0.72 0.2 30)" style={{ animationDelay: `${(i % 4) * 0.6}s` }} />)}
          </g>
        );
      })}

      <path d="M0 585C220 555 380 590 600 570S980 545 1200 575V640H0Z" fill="url(#hill-near)" />
    </svg>
  );
}
