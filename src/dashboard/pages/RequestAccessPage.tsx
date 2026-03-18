import { AlertTriangle, LogOut, ShieldCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePolling } from "../hooks/usePolling";
import type { AuthUser } from "../lib/api";
import { fetchMyAccessRequest, submitAccessRequest } from "../lib/api";
import type { AccessRequestRow } from "../lib/types";

interface Props {
  user: AuthUser;
  accessRequestsEnabled: boolean;
}

export function RequestAccessPage({ user, accessRequestsEnabled }: Props) {
  const [myRequest, setMyRequest] = useState<AccessRequestRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = submitted || myRequest?.status === "pending";

  const load = useCallback(async () => {
    try {
      const res = await fetchMyAccessRequest();
      setMyRequest(res.data);
      setError(null);
    } catch {
      setMyRequest(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessRequestsEnabled) {
      load();
    } else {
      setIsLoading(false);
    }
  }, [accessRequestsEnabled, load]);

  usePolling(load, 5000, isPending);

  async function handleRequest() {
    setIsSubmitting(true);
    setError(null);
    try {
      await submitAccessRequest();
      setSubmitted(true);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("409")) {
        await load();
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

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
          <h2 className="text-xl font-bold text-foreground">{user.name || user.email}</h2>
          <p className="text-sm text-muted-foreground mb-6">{user.email}</p>

          {/* No access requests system */}
          {!accessRequestsEnabled && (
            <StatusCard
              icon={<XCircle className="w-5 h-5" />}
              bg="var(--gruvbox-red)"
              message="Access denied. Contact an admin to be added."
            />
          )}

          {/* First-time request */}
          {accessRequestsEnabled && !myRequest && !submitted && (
            <>
              <p className="text-muted-foreground text-center max-w-sm mb-5">
                You don't have access to the Cinnamon dashboard yet. Request access and an admin
                will review your request.
              </p>
              {error && (
                <StatusCard
                  icon={<XCircle className="w-5 h-5" />}
                  bg="var(--gruvbox-red)"
                  message={error}
                  className="mb-4"
                />
              )}
              <ActionButton
                onClick={handleRequest}
                isSubmitting={isSubmitting}
                label="Request Access"
              />
            </>
          )}

          {/* Pending */}
          {accessRequestsEnabled && isPending && (
            <>
              <StatusCard
                icon={<AlertTriangle className="w-5 h-5" />}
                bg="var(--gruvbox-yellow)"
                message="Your request is awaiting approval."
              />
              {myRequest?.requestedAt && (
                <p className="text-sm text-muted-foreground mt-3">
                  Submitted on {new Date(myRequest.requestedAt).toLocaleDateString()}
                </p>
              )}
            </>
          )}

          {/* Denied */}
          {accessRequestsEnabled && myRequest?.status === "denied" && !submitted && (
            <>
              <StatusCard
                icon={<XCircle className="w-5 h-5" />}
                bg="var(--gruvbox-red)"
                message="Your access request was denied."
              />
              {myRequest.notes && (
                <p className="text-sm text-muted-foreground mt-3 italic max-w-sm">
                  &ldquo;{myRequest.notes}&rdquo;
                </p>
              )}
              <div className="mt-4">
                <ActionButton
                  onClick={handleRequest}
                  isSubmitting={isSubmitting}
                  label="Request Again"
                />
              </div>
            </>
          )}

          {/* Approved but disabled */}
          {accessRequestsEnabled &&
            myRequest?.status === "approved" &&
            user.userId > 0 &&
            user.disabled && (
              <>
                <StatusCard
                  icon={<XCircle className="w-5 h-5" />}
                  bg="var(--gruvbox-red)"
                  message="Your account has been disabled."
                />
                <p className="text-muted-foreground text-center max-w-sm mt-3">
                  You can request access again, or contact an administrator.
                </p>
                <div className="mt-4">
                  <ActionButton
                    onClick={handleRequest}
                    isSubmitting={isSubmitting}
                    label="Request Access Again"
                  />
                </div>
              </>
            )}

          {/* Approved and ready */}
          {accessRequestsEnabled &&
            myRequest?.status === "approved" &&
            !(user.userId > 0 && user.disabled) && (
              <>
                <StatusCard
                  icon={<ShieldCheck className="w-5 h-5" />}
                  bg="var(--gruvbox-green)"
                  message="Your request has been approved!"
                />
                <p className="text-muted-foreground text-center max-w-sm mt-3">
                  Please sign in again to access the dashboard with your new permissions.
                </p>
                <a
                  href="/auth/login"
                  className="mt-4 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 inline-flex items-center gap-2"
                  style={{
                    backgroundColor: "var(--gruvbox-orange-bright)",
                    color: "var(--gruvbox-bg0)",
                  }}
                >
                  Sign in again
                </a>
              </>
            )}
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

function StatusCard({
  icon,
  bg,
  message,
  className = "",
}: {
  icon: React.ReactNode;
  bg: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-4 flex items-center gap-3 w-full ${className}`}
      style={{ backgroundColor: bg, color: "var(--gruvbox-bg0)" }}
    >
      {icon}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

function ActionButton({
  onClick,
  isSubmitting,
  label,
}: {
  onClick: () => void;
  isSubmitting: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
      style={{
        backgroundColor: "var(--gruvbox-orange-bright)",
        color: "var(--gruvbox-bg0)",
      }}
      onClick={onClick}
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      ) : (
        label
      )}
    </button>
  );
}
