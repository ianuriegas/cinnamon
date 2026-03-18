import { ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { NavDropdown } from "../components/NavDropdown";
import { ProfileDropdown } from "../components/ProfileDropdown";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

const NAV_ITEMS = [
  { to: "/", label: "Runs", end: true },
  { to: "/jobs", label: "Jobs" },
] as const;

const ADMIN_ITEMS = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/api-keys", label: "API Keys" },
  { to: "/admin/teams", label: "Teams" },
] as const;

function NavItem({
  to,
  label,
  end,
  mobile,
}: {
  to: string;
  label: string;
  end?: boolean;
  mobile?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${mobile ? "w-full" : ""} ${
          isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export function BaseLayout() {
  const { isDark, toggle } = useTheme();
  const { user, isLoading, authEnabled } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pathname = location.pathname;
  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isAdminActive = ADMIN_ITEMS.some((item) => location.pathname.startsWith(item.to));

  const filteredAdminItems = ADMIN_ITEMS.filter(
    (item) => authEnabled || item.to !== "/admin/users",
  );

  return (
    <>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: "var(--gruvbox-orange-bright)" }}
              />
              <NavLink to="/" className="text-xl font-semibold text-foreground">
                Cinnamon
              </NavLink>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  end={"end" in item ? item.end : false}
                />
              ))}
              {user?.isSuperAdmin && (
                <NavDropdown label="Admin" isActive={isAdminActive} items={filteredAdminItems} />
              )}
            </nav>

            <div className="flex items-center gap-2 md:gap-4">
              <button
                type="button"
                onClick={toggle}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="hidden md:block">
                <ProfileDropdown user={user} isLoading={isLoading} authEnabled={authEnabled} />
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="md:hidden pb-4 pt-2 border-t border-border mt-2">
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavItem
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    end={"end" in item ? item.end : false}
                    mobile
                  />
                ))}
                {user?.isSuperAdmin && (
                  <MobileAdminSection items={filteredAdminItems} isActive={isAdminActive} />
                )}
                <div className="border-t border-border mt-2 pt-2">
                  <ProfileDropdown
                    user={user}
                    isLoading={isLoading}
                    authEnabled={authEnabled}
                    mobile
                  />
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-7xl">
        <Outlet />
      </main>
    </>
  );
}

function MobileAdminSection({
  items,
  isActive,
}: {
  items: readonly { to: string; label: string }[];
  isActive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between w-full ${
          isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        Admin
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="ml-4 mt-1 flex flex-col gap-1 border-l-2 border-border pl-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: active }) =>
                `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:bg-accent"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
