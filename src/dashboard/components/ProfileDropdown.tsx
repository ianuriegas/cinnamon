import { ChevronDown, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div>
      <label htmlFor="tz-select-btn" className="text-sm text-muted-foreground mb-3 block">
        Timezone
      </label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-background border border-border text-foreground hover:border-muted-foreground/50 transition-colors text-sm"
        >
          {formatTzLabel(timezone)}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
            {COMMON_TIMEZONES.map((tz) => (
              <button
                key={tz}
                type="button"
                onClick={() => {
                  setTimezone(tz);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-accent transition-colors ${
                  timezone === tz ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {formatTzLabel(tz)}
                {timezone === tz && <span style={{ color: "var(--gruvbox-green-bright)" }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const modal = (
    <div
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h2 className="text-foreground">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-5 space-y-4">
          <TimezoneSelect />
        </div>
        <div className="border-t border-border" />
        <div className="px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-sm transition-all hover:opacity-90"
            style={{
              backgroundColor: "var(--gruvbox-orange-bright)",
              color: "var(--gruvbox-bg0)",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

interface ProfileDropdownProps {
  user: AuthUser | null;
  isLoading: boolean;
  authEnabled: boolean;
  mobile?: boolean;
}

export function ProfileDropdown({ user, isLoading, authEnabled, mobile }: ProfileDropdownProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />;
  }

  if (mobile) {
    return (
      <>
        <MobileProfileSection
          user={user}
          authEnabled={authEnabled}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }

  const initials = user?.name
    ? getInitials(user.name)
    : user?.email
      ? user.email[0].toUpperCase()
      : "?";

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium hover:scale-105 transition-transform"
          style={{
            backgroundColor: "var(--gruvbox-green)",
            color: "var(--gruvbox-bg0)",
          }}
          aria-label="Profile menu"
        >
          {authEnabled && user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-10 h-10 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            initials
          )}
        </button>
        {menuOpen && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            {authEnabled && user ? (
              <div className="px-4 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt=""
                      className="w-12 h-12 rounded-full shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: "var(--gruvbox-green)",
                        color: "var(--gruvbox-bg0)",
                      }}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate">{user.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                  </div>
                </div>
              </div>
            ) : !authEnabled ? (
              <div className="px-4 py-3 border-b border-border text-sm text-muted-foreground">
                Dev mode
              </div>
            ) : null}
            <div className="py-2">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
              >
                Settings
              </button>
              {authEnabled && user && (
                <a
                  href="/auth/logout"
                  className="block px-4 py-2.5 text-sm transition-colors"
                  style={{ color: "var(--gruvbox-red-bright)" }}
                >
                  Logout
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function MobileProfileSection({
  user,
  authEnabled,
  onOpenSettings,
}: {
  user: AuthUser | null;
  authEnabled: boolean;
  onOpenSettings: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const initials = user?.name
    ? getInitials(user.name)
    : user?.email
      ? user.email[0].toUpperCase()
      : "?";

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="px-4 py-3 flex items-center gap-3 w-full hover:bg-accent/50 transition-colors rounded-lg"
      >
        {authEnabled && user?.picture ? (
          <img
            src={user.picture}
            alt=""
            className="w-10 h-10 rounded-full shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-medium shrink-0"
            style={{
              backgroundColor: "var(--gruvbox-green)",
              color: "var(--gruvbox-bg0)",
            }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <div className="text-sm text-foreground truncate">
            {authEnabled && user ? user.name || user.email : "Dev mode"}
          </div>
          {authEnabled && user?.email && user.name && (
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="ml-4 mt-1 flex flex-col gap-1 border-l-2 border-border pl-3">
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-left px-3 py-1.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors"
          >
            Settings
          </button>
          {authEnabled && user && (
            <a
              href="/auth/logout"
              className="px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: "var(--gruvbox-red-bright)" }}
            >
              Logout
            </a>
          )}
        </div>
      )}
    </div>
  );
}
