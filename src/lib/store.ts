import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store shared by every dashboard in this browser.
 * It also listens for `storage` events, so a second tab (e.g. the dispatcher) updates live.
 * This stands in for a backend until one exists.
 */
export function createStore<T>(key: string, initial: T) {
  let value = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());

  function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) value = JSON.parse(raw) as T;
    } catch {
      /* unreadable storage: start empty */
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== key) return;
      try {
        value = event.newValue ? (JSON.parse(event.newValue) as T) : initial;
      } catch {
        value = initial;
      }
      emit();
    });
  }

  const get = () => {
    load();
    return value;
  };
  const subscribe = (listener: () => void) => {
    load();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function set(next: T) {
    load();
    value = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* quota or blocked: keep in memory only */
    }
    emit();
  }

  return {
    get,
    set,
    /** Back to the starting value, in this tab and (through the storage event) in every other tab. */
    reset: () => set(initial),
    use: () => useSyncExternalStore(subscribe, get, () => initial),
  };
}
