import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "cinnamon-theme";

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getSnapshot(): boolean {
  return isDarkMode();
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export function useTheme() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = isDarkMode() ? "light" : "dark";
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { isDark, toggle };
}
