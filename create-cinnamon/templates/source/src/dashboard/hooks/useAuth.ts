import { useEffect, useState } from "react";
import { type AuthUser, fetchAuthUser } from "../lib/api";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessRequestsEnabled, setAccessRequestsEnabled] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);

  useEffect(() => {
    fetchAuthUser()
      .then((res) => {
        setUser(res.user);
        setAccessRequestsEnabled(res.accessRequestsEnabled);
        setAuthEnabled(res.authEnabled);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { user, isLoading, accessRequestsEnabled, authEnabled };
}
