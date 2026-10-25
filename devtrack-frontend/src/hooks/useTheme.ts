import { useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const KEY = "devtrack.theme";
const media = () => window.matchMedia?.("(prefers-color-scheme: dark)");

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function resolve(): Theme {
  return readStored() ?? (media()?.matches ? "dark" : "light");
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = media();
  mq?.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    mq?.removeEventListener("change", listener);
  };
}

export function applyTheme(theme: Theme = resolve()) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Light/dark theme: follows the OS until the user picks one explicitly. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, resolve, () => "light" as Theme);

  useEffect(() => applyTheme(theme), [theme]);

  const toggle = useCallback(() => {
    try {
      localStorage.setItem(KEY, resolve() === "dark" ? "light" : "dark");
    } catch {
      /* storage unavailable: theme just won't persist */
    }
    listeners.forEach((l) => l());
  }, []);

  return { theme, toggle };
}
