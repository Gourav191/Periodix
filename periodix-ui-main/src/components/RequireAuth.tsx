// src/components/RequireAuth.tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken, me, setAuthToken } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { authUser, setAuthUser, logout } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // already loaded
      if (authUser) {
        setLoading(false);
        return;
      }

      const res = await me();
      if (cancelled) return;

      if (res.error || !res.data) {
        logout(); // clears token + authUser
        setLoading(false);
        return;
      }

      setAuthUser(res.data);
      setLoading(false);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [authUser, setAuthUser, logout]);

  if (loading) return null;

  if (!getAuthToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
