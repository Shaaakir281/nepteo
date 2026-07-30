"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Comportement clavier partagé des dialogues : focus initial, confinement,
 * fermeture par Échap et retour au déclencheur.
 */
export function useDialogFocus({
  open,
  onClose,
  dialogRef,
  initialFocusRef,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const returnTarget = returnFocusRef?.current ?? null;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : returnTarget;

    const focusFrame = requestAnimationFrame(() => {
      (initialFocusRef?.current ?? dialogRef.current)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      requestAnimationFrame(() => {
        const target = previous?.isConnected ? previous : returnTarget;
        target?.focus();
      });
    };
  }, [dialogRef, initialFocusRef, onClose, open, returnFocusRef]);
}
