"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]';

/** Portaled to keep dialogs above animated pages; keyboard focus stays inside. */
export function Dialog({ children, label, onClose, drawer = false, className = "" }: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  drawer?: boolean;
  className?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (panel.current?.querySelector<HTMLElement>(focusable) ?? panel.current)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`fixed inset-0 z-50 bg-[#161b30]/40 ${drawer ? "" : "flex items-center justify-center p-4 sm:p-5"}`}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key !== "Tab") return;
        const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>(focusable) ?? []).filter(node => node.getClientRects().length > 0);
        const first = nodes[0], last = nodes.at(-1);
        if (!first) { event.preventDefault(); panel.current?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <section ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className={`${drawer ? "absolute inset-y-0 right-0 w-full max-w-[620px] overflow-y-auto bg-white p-6 md:p-8" : "dashboard-panel max-h-[90dvh] w-full max-w-3xl overflow-y-auto p-6"} ${className}`}>
        {children}
      </section>
    </div>, document.body,
  );
}
