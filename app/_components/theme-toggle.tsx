"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY, applyTheme, readTheme, type Theme } from "@/src/lib/theme";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

/** Keeps the status-bar color in step with the saved theme on every page. Renders nothing. */
export function ThemeSync() {
  useEffect(() => applyTheme(readTheme()), []);
  return null;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      aria-label={`${theme === "dark" ? "Dark" : "Light"} mode. Switch to ${next} mode`}
      onClick={() => {
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          // Private mode: the choice still applies until the page is closed.
        }
        applyTheme(next);
        listeners.forEach((cb) => cb());
      }}
      className="flex size-11 items-center justify-center rounded-full bg-card text-brand shadow-sm ring-1 ring-separator transition active:scale-90 active:opacity-70"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
