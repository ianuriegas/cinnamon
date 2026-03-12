import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTimezoneContext } from "../contexts/TimezoneContext";
import type { AuthUser } from "../lib/api";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function formatTzLabel(tz: string): string {
  try {
    const offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    return `${tz.replace(/_/g, " ")} (${offset})`;
  } catch {
    return tz;
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function TimezoneSelect() {
  const { timezone, setTimezone } = useTimezoneContext();
  return (
    <div>
      <label className="label" htmlFor="tz-select">
        <span className="label-text">Timezone</span>
      </label>
      <select
        id="tz-select"
        className="select select-bordered w-full"
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
      >
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz} value={tz}>
            {formatTzLabel(tz)}
          </option>
        ))}
      </select>
    </div>
  );
}

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const modal = (
    <div
      data-settings-modal
      className={`modal ${open ? "modal-open" : ""}`}
      aria-hidden={!open}
      style={!open ? { pointerEvents: "none" } : undefined}
    >
      <section
        className="modal-box"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg">Settings</h3>
        <div className="py-4">
          <TimezoneSelect />
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close modal"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />
    </div>
  );

  return createPortal(modal, document.body);
}

interface ProfileDropdownProps {
  user: AuthUser | null;
  isLoading: boolean;
}

export function ProfileDropdown({ user, isLoading }: ProfileDropdownProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function openSettings() {
    setSettingsOpen(true);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (!detailsRef.current) return;
      if (detailsRef.current.contains(target)) return;
      const inModal = document.querySelector("[data-settings-modal]")?.contains(target);
      if (inModal) return;
      detailsRef.current.removeAttribute("open");
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full skeleton" />;
  }

  return (
    <>
      <details ref={detailsRef} className="dropdown dropdown-end">
        <summary className="btn btn-ghost btn-circle avatar" aria-label="Profile menu">
          {user?.picture ? (
            <div className="w-8 rounded-full">
              <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
            </div>
          ) : user ? (
            <div className="w-8 h-8 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
              <span className="text-xs">{getInitials(user.name || user.email)}</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>User avatar</title>
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </svg>
            </div>
          )}
        </summary>

        <ul className="dropdown-content menu bg-base-100 rounded-box z-10 w-64 p-2 shadow-lg mt-2">
          {user && (
            <>
              <li className="menu-title px-3 pt-2 pb-1">
                <div className="flex items-center gap-3">
                  {user.picture && (
                    <img
                      src={user.picture}
                      alt=""
                      className="w-10 h-10 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{user.name}</div>
                    <div className="text-xs text-base-content/60 truncate">{user.email}</div>
                  </div>
                </div>
              </li>
              <li className="h-px bg-base-300 my-1" />
            </>
          )}

          <li>
            <button type="button" onClick={openSettings}>
              Settings
            </button>
          </li>

          {user && (
            <>
              <li className="h-px bg-base-300 my-1" />
              <li>
                <a href="/auth/logout" className="text-error">
                  Logout
                </a>
              </li>
            </>
          )}
        </ul>
      </details>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
