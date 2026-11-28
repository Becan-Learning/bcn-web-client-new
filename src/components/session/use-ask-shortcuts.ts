"use client";

import { useEffect } from "react";

type AskShortcuts = {
  /** False on touch layouts, where there is no keyboard shortcut. */
  enabled: boolean;
  canAsk: boolean;
  /** The microphone is open: a Student question is being spoken. */
  recording: boolean;
  /** A turn is opening or closing. */
  busy: boolean;
  onAsk: () => void;
  onSend: () => void;
  onCancel: () => void;
};

/** Space asks, then sends; Escape cancels. Ignored while typing and while a dialog is open. */
export function useAskShortcuts({ enabled, canAsk, recording, busy, onAsk, onSend, onCancel }: AskShortcuts) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
        (target instanceof HTMLElement && (target.closest("input, textarea, select") || target.isContentEditable)) ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (event.code === "Space") {
        if (recording) {
          event.preventDefault();
          onSend();
        } else if (canAsk) {
          event.preventDefault();
          onAsk();
        }
      } else if (event.key === "Escape" && (recording || busy)) {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, canAsk, recording, busy, onAsk, onSend, onCancel]);
}
