import { ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { NavLink } from "react-router";

const CLOSE_DELAY_MS = 300;

interface NavDropdownProps {
  label: string;
  isActive?: boolean;
  items: readonly { to: string; label: string }[];
}

export function NavDropdown({ label, isActive, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      closeTimer.current = null;
    }, CLOSE_DELAY_MS);
  }, []);

  return (
    <nav className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        type="button"
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
          isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 pt-1 w-48 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg py-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive: active }) =>
                  `block px-4 py-2 text-sm transition-colors ${
                    active
                      ? "text-foreground hover:bg-accent"
                      : "text-muted-foreground hover:bg-accent"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
