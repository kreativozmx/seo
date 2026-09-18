"use client";

// Small pieces shared by more than one dashboard tab module. Anything
// used by only one tab should live in that tab's own file instead of
// growing this one back into a second ProjectDashboard.tsx.

// Where the "quiero que me ayude un experto" banner points. Change this to
// a contact page, WhatsApp link, or booking page whenever you decide —
// defaults to a mailto so it works out of the box.
export const EXPERT_CONTACT_URL =
  process.env.NEXT_PUBLIC_EXPERT_CONTACT_URL ||
  "mailto:israel@kreativoz.com.mx?subject=Quiero%20ayuda%20con%20la%20velocidad%20de%20mi%20sitio";

export function ExpertBanner() {
  return (
    <a
      href={EXPERT_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 text-xs bg-white border border-dashed border-neutral-200 hover:border-[#228449]/40 rounded-lg px-3 py-2 text-neutral-500 hover:text-neutral-700 transition-colors"
    >
      <span>¿Prefieres que un experto te ayude a corregir esto?</span>
      <span className="text-[#228449] font-medium whitespace-nowrap">Quiero que me ayude un experto →</span>
    </a>
  );
}
