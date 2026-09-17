"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeDomain } from "@/lib/domain";
import { LOCATIONS, LANGUAGES } from "@/lib/locations";

export default function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [locationCode, setLocationCode] = useState("2484");
  const [languageCode, setLanguageCode] = useState("es");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain, locationCode, languageCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el proyecto");
      }
      setName("");
      setDomain("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4"
    >
      <input
        className="flex-1 bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        placeholder="Nombre del proyecto"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className="flex-1 bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        placeholder="dominio.com"
        value={domain}
        onChange={(e) => setDomain(normalizeDomain(e.target.value))}
        required
      />
      <select
        className="bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        value={locationCode}
        onChange={(e) => setLocationCode(e.target.value)}
      >
        {LOCATIONS.map((loc) => (
          <option key={loc.code} value={loc.code}>
            {loc.label}
          </option>
        ))}
      </select>
      <select
        className="bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        value={languageCode}
        onChange={(e) => setLanguageCode(e.target.value)}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={loading}
        className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 text-sm transition-colors whitespace-nowrap"
      >
        {loading ? "Creando..." : "Crear proyecto"}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </form>
  );
}
