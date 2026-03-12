import { useCallback, useEffect, useState } from "react";
import { usePolling } from "../hooks/usePolling";
import type { AuthUser } from "../lib/api";
import { fetchMyAccessRequest, submitAccessRequest } from "../lib/api";
import type { AccessRequestRow } from "../lib/types";

function RequestAgainButton({
  onRequest,
  isSubmitting,
  label = "Request Again",
}: {
  onRequest: () => void;
  isSubmitting: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={onRequest}
      disabled={isSubmitting}
    >
      {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : label}
    </button>
  );
}

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

  async function handleRequestAgain() {
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
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card bg-base-100 shadow-xl max-w-md w-full">
        <div className="card-body flex flex-col items-center text-center">
          {user.picture && (
            <div className="flex justify-center mb-2">
              <img
                src={user.picture}
                alt=""
                className="w-16 h-16 rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <h2 className="card-title justify-center text-xl">{user.name || user.email}</h2>
          <p className="text-sm text-base-content/60 mb-4">{user.email}</p>

          {!accessRequestsEnabled && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="alert alert-error justify-center w-full max-w-md">
                <span>Access denied. Contact an admin to be added.</span>
              </div>
              <a href="/auth/logout" className="btn btn-ghost btn-sm">
                Sign out
              </a>
            </div>
          )}

          {accessRequestsEnabled && !myRequest && !submitted && (
            <div className="flex flex-col items-center gap-4 w-full">
              <p className="text-base-content/70 text-center max-w-sm">
                You don't have access to the Cinnamon dashboard yet. Request access and an admin
                will review your request.
              </p>
              {error && (
                <div className="alert alert-error justify-center w-full max-w-md">
                  <span>{error}</span>
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Request Access"
                )}
              </button>
              <a href="/auth/logout" className="btn btn-ghost btn-sm">
                Sign out
              </a>
            </div>
          )}

          {accessRequestsEnabled && isPending && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="alert alert-warning justify-center w-full max-w-md">
                <svg
                  role="img"
                  aria-label="Warning"
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <span>Your request is awaiting approval.</span>
              </div>
              {myRequest?.requestedAt && (
                <p className="text-sm text-base-content/50 text-center">
                  Submitted on {new Date(myRequest.requestedAt).toLocaleDateString()}
                </p>
              )}
              <a href="/auth/logout" className="btn btn-ghost btn-sm">
                Sign out
              </a>
            </div>
          )}

          {accessRequestsEnabled && myRequest?.status === "denied" && !submitted && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="alert alert-error justify-center w-full max-w-md">
                <span>Your access request was denied.</span>
              </div>
              {myRequest.notes && (
                <p className="text-sm text-base-content/60 text-center italic max-w-sm">
                  "{myRequest.notes}"
                </p>
              )}
              <div className="flex flex-col gap-2 items-center">
                <RequestAgainButton onRequest={handleRequestAgain} isSubmitting={isSubmitting} />
                <a href="/auth/logout" className="btn btn-ghost btn-sm">
                  Sign out
                </a>
              </div>
            </div>
          )}

          {accessRequestsEnabled &&
            myRequest?.status === "approved" &&
            (user.userId > 0 && user.disabled ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="alert alert-error justify-center w-full max-w-md">
                  <span>Your account has been disabled.</span>
                </div>
                <p className="text-base-content/70 text-center max-w-sm">
                  You can request access again, or contact an administrator.
                </p>
                <div className="flex flex-col gap-2 items-center">
                  <RequestAgainButton
                    onRequest={handleRequestAgain}
                    isSubmitting={isSubmitting}
                    label="Request Access Again"
                  />
                  <a href="/auth/logout" className="btn btn-ghost btn-sm">
                    Sign out
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="alert alert-success justify-center w-full max-w-md">
                  <span>Your request has been approved!</span>
                </div>
                <p className="text-base-content/70 text-center max-w-sm">
                  Please sign in again to access the dashboard with your new permissions.
                </p>
                <a href="/auth/login" className="btn btn-primary">
                  Sign in again
                </a>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
