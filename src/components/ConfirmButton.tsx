"use client";

import { useState } from "react";

// A delete/remove button that asks inline ("¿Seguro? Si / No") instead of
// a browser confirm() popup — click once to arm it, click "Si" to commit.
export function ConfirmButton({
  onConfirm,
  label,
  confirmText = "¿Seguro?",
  className,
  confirmingClassName,
}: {
  onConfirm: () => void | Promise<void>;
  label: React.ReactNode;
  confirmText?: string;
  className?: string;
  confirmingClassName?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (confirming) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${confirmingClassName ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[13px] text-neutral-500 whitespace-nowrap">{confirmText}</span>
        <button
          type="button"
          disabled={loading}
          onClick={async (e) => {
            e.stopPropagation();
            setLoading(true);
            await onConfirm();
            setLoading(false);
            setConfirming(false);
          }}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {loading ? "..." : "Si"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
          className="text-xs text-neutral-400 hover:text-neutral-600"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      className={className}
    >
      {label}
    </button>
  );
}
