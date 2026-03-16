import { type ReactNode, useCallback, useRef, useState } from "react";

const CLOSE_DELAY_MS = 300;

interface NavDropdownProps {
  label: string;
  isActive?: boolean;
  children: ReactNode;
}

export function NavDropdown({ label, isActive, children }: NavDropdownProps) {
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
    <li className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        type="button"
        className={`flex items-center gap-1 ${isActive ? "menu-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <title>Toggle menu</title>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="absolute top-full right-0 mt-1 bg-base-100 rounded-box z-50 min-w-36 shadow-lg menu p-2">
          {children}
        </ul>
      )}
    </li>
  );
}
