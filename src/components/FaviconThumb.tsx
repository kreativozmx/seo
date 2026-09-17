"use client";

import { useState } from "react";

// Real site favicon (via Google's public favicon service — no API key)
// used as a small thumbnail next to a project's name, falling back to a
// generic globe glyph if the domain has no favicon or the request fails.
export default function FaviconThumb({ domain, size = 36 }: { domain: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="shrink-0 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-400"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 6 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-6-3.8-9s1.3-6.3 3.8-9Z" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?sz=${size * 2}&domain=${domain}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-md bg-neutral-100"
      onError={() => setFailed(true)}
    />
  );
}
