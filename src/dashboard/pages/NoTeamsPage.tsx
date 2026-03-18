import { LogOut, Users } from "lucide-react";
import type { AuthUser } from "../lib/api";

interface Props {
  user: AuthUser;
}

export function NoTeamsPage({ user }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-8 flex flex-col items-center text-center">
          {/* Avatar */}
          {user.picture ? (
            <img
              src={user.picture}
              alt=""
              className="w-16 h-16 rounded-full mb-4"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl mb-4"
              style={{
                backgroundColor: "var(--gruvbox-orange-bright)",
                color: "var(--gruvbox-bg0)",
              }}
            >
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="text-xl font-bold text-foreground mb-1">No teams assigned</h2>
          <p className="text-muted-foreground text-sm mb-6">
            You haven&apos;t been assigned to any teams yet.
          </p>

          <div
            className="rounded-xl p-4 flex items-center gap-3 w-full"
            style={{ backgroundColor: "var(--gruvbox-yellow)", color: "var(--gruvbox-bg0)" }}
          >
            <Users className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              Contact an administrator to get team access.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-8 py-4 flex justify-center">
          <a
            href="/auth/logout"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
