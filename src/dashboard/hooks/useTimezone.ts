import { useCallback, useState } from "react";

const STORAGE_KEY = "cinnamon-timezone";

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getStoredTimezone(): string {
  return localStorage.getItem(STORAGE_KEY) ?? getBrowserTimezone();
}

export function useTimezone() {
  const [timezone, setTimezoneState] = useState(getStoredTimezone);

  const setTimezone = useCallback((tz: string) => {
    localStorage.setItem(STORAGE_KEY, tz);
    setTimezoneState(tz);
  }, []);

  return { timezone, setTimezone };
}

export function formatInTimezone(isoString: string | null, timezone: string): string {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleString(undefined, {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return isoString;
  }
}
