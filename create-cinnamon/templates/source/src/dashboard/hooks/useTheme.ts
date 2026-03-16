import { useCallback, useSyncExternalStore } from "react";

const LIGHT = "gruvbox-light";
const DARK = "gruvbox-dark";
const STORAGE_KEY = "cinnamon-theme";

function getTheme(): string {
  return document.documentElement.getAttribute("data-theme") || LIGHT;
}

function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => LIGHT);
  const isDark = theme === DARK;

  const toggle = useCallback(() => {
    const next = getTheme() === DARK ? LIGHT : DARK;
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { theme, isDark, toggle };
}
