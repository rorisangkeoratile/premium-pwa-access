import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Fades and lifts its children in the first time they scroll into view.
 * Anything already on screen when the page loads is left alone, and the server-rendered
 * markup is fully visible, so nothing is hidden if JavaScript never runs.
 */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"ssr" | "hidden" | "shown">("ssr");

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion() || !("IntersectionObserver" in window)) return;
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setState("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined = state === "shown" && delay ? { transitionDelay: `${delay}ms` } : undefined;
  return (
    <div ref={ref} style={style} className={`${state === "hidden" ? "reveal-hidden" : state === "shown" ? "reveal-shown" : ""} ${className}`}>
      {children}
    </div>
  );
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/;

function format(n: number, decimals: number, grouped: boolean) {
  const fixed = n.toFixed(decimals);
  return grouped ? Number(fixed).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : fixed;
}

/**
 * Shows a value such as "8,430", "87%" or "18 min" and counts its first number up to the target.
 * When the value changes later, it counts from the old number to the new one. Times, dates and
 * plain words are shown as they are.
 */
export function CountUp({ value, duration = 1000 }: { value: string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const current = useRef(0);

  useIsoLayoutEffect(() => {
    const match = NUMBER.exec(value);
    if (!match || value.includes(":") || /^0\d/.test(match[0]) || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const target = parseFloat(match[0].replace(/,/g, ""));
    const decimals = match[0].split(".")[1]?.length ?? 0;
    const grouped = match[0].includes(",");
    const from = current.current;
    const start = performance.now();
    setShown(value.replace(match[0], format(from, decimals, grouped)));
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const n = from + (target - from) * eased;
      current.current = n;
      setShown(value.replace(match[0], format(n, decimals, grouped)));
      if (t < 1) frame = requestAnimationFrame(step);
      else setShown(value);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{shown}</>;
}
