import { useEffect, useRef, useState } from "react";

/**
 * Light/dark theme. The colour tokens for both already exist in styles.css (a `.dark` block, toggled by
 * the `dark` class on <html>); this is what was missing to actually reach it.
 */
export type Theme = "light" | "dark";
const KEY = "lesedilink.theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked: the choice just will not survive a reload */
  }
}

/**
 * Applying the class before first paint (so there is no flash of the wrong theme) happens in an inline
 * script in __root.tsx, which runs before React hydrates. This hook picks up from there; `STORAGE_KEY`
 * lets that script use the same localStorage key instead of a second hard-coded copy of it.
 */
export const STORAGE_KEY = KEY;

/** The current theme and a way to flip it. Every component using this hook re-renders together when it changes. */
export function useTheme(): [Theme, () => void] {
  // Starts as "light" on every render, including the client's first one (during hydration), because that
  // is what the server rendered too — the server cannot read localStorage. Reading the real value here
  // instead would make the client's first render disagree with the server's and React would discard and
  // rebuild the whole tree. The real value is picked up in the effect below, once hydration is done.
  const [theme, setTheme] = useState<Theme>("light");
  // Guards the very first run of the apply-effect (the one caused by the mount-sync below correcting the
  // placeholder), so it does not write "light" over a stored "dark" preference before that correction lands.
  const skipNextApply = useRef(true);

  // The inline script in __root.tsx already put the right class on <html> before hydration; this just
  // brings React's own state into agreement with it.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (skipNextApply.current) {
      skipNextApply.current = false;
      return;
    }
    apply(theme);
  }, [theme]);

  // Another tab changed the theme: stay in sync with it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY && (event.newValue === "light" || event.newValue === "dark")) setTheme(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [theme, () => setTheme((current) => (current === "dark" ? "light" : "dark"))];
}
