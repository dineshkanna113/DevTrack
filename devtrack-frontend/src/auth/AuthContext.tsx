import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const hasToken = Boolean(tokenStore.get());

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: hasToken,
    retry: false,
    staleTime: Infinity,
  });

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    queryClient.setQueryData(["me"], null);
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.login(email, password);
      tokenStore.set(access_token);
      const me = await api.me();
      queryClient.setQueryData(["me"], me);
    },
    [queryClient],
  );

  const value = useMemo<AuthState>(
    () => ({ user: user ?? null, isLoading: hasToken && isLoading, login, logout }),
    [user, hasToken, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with its provider
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
