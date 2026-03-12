import { NavLink, Outlet, useLocation } from "react-router";
import { NavDropdown } from "../components/NavDropdown";
import { ProfileDropdown } from "../components/ProfileDropdown";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

const NAV_ITEMS = [
  { to: "/", label: "Runs", end: true },
  { to: "/definitions", label: "Definitions" },
  { to: "/schedules", label: "Schedules" },
] as const;

const ADMIN_ITEMS = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/api-keys", label: "API Keys" },
  { to: "/admin/teams", label: "Teams" },
] as const;

export function BaseLayout() {
  const { isDark, toggle } = useTheme();
  const { user, isLoading } = useAuth();
  const location = useLocation();

  const isAdminActive = ADMIN_ITEMS.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
      <div className="navbar bg-base-100 shadow-sm px-4">
        <div className="flex-1">
          <NavLink to="/" className="text-xl font-bold tracking-tight">
            🫙 Cinnamon
          </NavLink>
        </div>
        <div className="flex-none gap-1">
          <ul className="menu menu-horizontal px-1 gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={"end" in item ? item.end : false}
                  className={({ isActive }) => (isActive ? "menu-active" : "")}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            {user?.isSuperAdmin && (
              <NavDropdown label="Admin" isActive={isAdminActive}>
                {ADMIN_ITEMS.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => (isActive ? "menu-active" : "")}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </NavDropdown>
            )}
          </ul>
          <button
            type="button"
            className="btn btn-ghost btn-circle ml-1"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg
                role="img"
                aria-label="Light mode"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg
                role="img"
                aria-label="Dark mode"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
          <ProfileDropdown user={user} isLoading={isLoading} />
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Outlet />
      </main>
    </>
  );
}
