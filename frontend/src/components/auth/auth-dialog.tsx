"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";

import type { AuthMode } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthDialogProps {
  mode: AuthMode | null;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (mode: AuthMode, fields: Record<string, string>) => Promise<void>;
}

export function AuthDialog({
  mode,
  onClose,
  onModeChange,
  onSubmit,
}: AuthDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (mode && !node.open) node.showModal();
    if (!mode && node.open) node.close();
  }, [mode]);

  const activeMode = mode ?? "login";
  const isSignup = activeMode === "signup";

  function close() {
    setError("");
    setShowPassword(false);
    onClose();
  }

  function changeMode(nextMode: AuthMode) {
    setError("");
    setShowPassword(false);
    onModeChange(nextMode);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<
      string,
      string
    >;
    try {
      await onSubmit(activeMode, fields);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="auth-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[440px] border border-line bg-background p-0 text-foreground backdrop:bg-foreground/25"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onClose={onClose}
    >
      <div className="flex h-10 items-center justify-between border-b border-line px-4">
        <Label>{isSignup ? "New account" : "Account access"}</Label>
        <button
          type="button"
          aria-label="Close"
          className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={close}
        >
          <X className="size-4" />
        </button>
      </div>

      <form key={activeMode} className="p-6 sm:p-8" onSubmit={submit}>
        <h2 id="auth-title" className="text-[28px] leading-[1.15]">
          {isSignup ? "Create your account" : "Welcome back"}
        </h2>

        <div className="mt-7 space-y-4">
          {isSignup ? (
            <div>
              <label
                htmlFor="auth-name"
                className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
              >
                Name
              </label>
              <Input
                id="auth-name"
                name="name"
                autoComplete="name"
                minLength={2}
                required
                autoFocus
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="auth-email"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              {isSignup ? "Email" : "Email or username"}
            </label>
            <Input
              id="auth-email"
              name="email"
              type={isSignup ? "email" : "text"}
              autoComplete={isSignup ? "email" : "username"}
              required
              autoFocus={!isSignup}
            />
          </div>

          {/* No number here. Getting in is email and password; pairing an iMessage
              number is a separate, later decision and lives in the Agent section.
              An autofilled `tel` field also had no business failing a login. */}
          <div>
            <label
              htmlFor="auth-password"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="auth-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={isSignup ? 8 : undefined}
                required
                className="pr-11"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-[13px] text-down">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" disabled={busy}>
          {busy ? "Please wait" : isSignup ? "Create account" : "Login"}
        </Button>

        <div className="mt-5 flex items-center justify-center gap-2 text-[13px]">
          <span className="text-muted-foreground">
            {isSignup ? "Already registered?" : "New to Bartr?"}
          </span>
          <button
            type="button"
            className="text-accent-deep underline decoration-accent-deep/40 underline-offset-[0.2em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => changeMode(isSignup ? "login" : "signup")}
          >
            {isSignup ? "Login" : "Create account"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
