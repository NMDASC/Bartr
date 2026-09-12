"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthDialog } from "./auth-dialog";
import type { AuthMode, AuthSession } from "@/lib/auth/types";

interface AuthContextValue {
  session: AuthSession | null;
  openAuth: (mode: AuthMode, nextPath?: string | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

export function AuthProvider({
  initialSession,
  children,
}: {
  initialSession: AuthSession | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    if (session) window.localStorage.setItem("bartr:user", session.email);
  }, [session]);

  const openAuth = useCallback((nextMode: AuthMode, requestedNext?: string | null) => {
    setMode(nextMode);
    setNextPath(safeNext(requestedNext ?? null));
  }, []);

  function closeAuth() {
    setMode(null);
    if (window.location.pathname === "/" && window.location.search) {
      window.history.replaceState({}, "", "/");
    }
  }

  async function authenticate(authMode: AuthMode, fields: Record<string, string>) {
    const response = await fetch(`/api/auth/${authMode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    });
    const body = (await response.json()) as { user?: AuthSession; error?: string };
    if (!response.ok || !body.user) throw new Error(body.error || "Unable to continue.");

    setSession(body.user);
    window.localStorage.setItem("bartr:user", body.user.email);
    const destination =
      body.user.role === "admin" ? "/admin" : safeNext(nextPath) || "/overview";
    setMode(null);
    setNextPath(null);
    router.push(destination);
    router.refresh();
  }

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.localStorage.removeItem("bartr:user");
    setSession(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, openAuth, logout }),
    [session, openAuth, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog
        mode={mode}
        onClose={closeAuth}
        onModeChange={setMode}
        onSubmit={authenticate}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthQueryPrompt() {
  const searchParams = useSearchParams();
  const { openAuth } = useAuth();

  useEffect(() => {
    const requestedMode = searchParams.get("auth");
    if (requestedMode !== "login" && requestedMode !== "signup") return;
    const requestedNext = safeNext(searchParams.get("next"));
    queueMicrotask(() => openAuth(requestedMode, requestedNext));
  }, [openAuth, searchParams]);

  return null;
}
