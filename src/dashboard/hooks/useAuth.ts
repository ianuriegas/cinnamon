import { useEffect, useState } from "react";
import { type AuthUser, fetchAuthUser } from "../lib/api";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAuthUser()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  return { user, isLoading };
}
