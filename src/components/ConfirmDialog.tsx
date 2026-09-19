"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// In-app confirmation modal (replaces the browser's confirm() popup).
// Escape or clicking the backdrop cancels; the destructive button is
// disabled while the action is running so it can't be double-fired.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/40 px-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5"
      >
        <div className="flex items-start gap-3">
          {danger && (
            <span className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
              </svg>
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">{title}</p>
            <p className="text-sm text-neutral-500 mt-1 break-words">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className="text-sm bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-4 py-1.5 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`text-sm disabled:opacity-50 text-white font-medium rounded-md px-4 py-1.5 transition-colors ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-[#228449] hover:bg-[#1B6B3A]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
