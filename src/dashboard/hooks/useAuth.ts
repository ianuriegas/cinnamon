import { useEffect, useState } from "react";
import { type AuthUser, fetchAuthUser } from "../lib/api";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessRequestsEnabled, setAccessRequestsEnabled] = useState(false);

  useEffect(() => {
    fetchAuthUser()
      .then((res) => {
        setUser(res.user);
        setAccessRequestsEnabled(res.accessRequestsEnabled);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { user, isLoading, accessRequestsEnabled };
}
