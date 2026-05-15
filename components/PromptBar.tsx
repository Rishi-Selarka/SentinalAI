"use client";

import { useEffect, useState } from "react";
import type { Domain } from "@/lib/openrouter";
import { DOMAIN_LABELS } from "@/lib/jury/prompts";

const DOMAINS: Domain[] = ["software", "engineering", "mixed", "finance"];

export function PromptBar({
  initialPrompt = "",
  initialDomain = "software",
  disabled,
  onSubmit,
  onClear,
}: {
  initialPrompt?: string;
  initialDomain?: Domain;
  disabled?: boolean;
  onSubmit: (prompt: string, domain: Domain) => void;
  onClear?: () => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [domain, setDomain] = useState<Domain>(initialDomain);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    setDomain(initialDomain);
  }, [initialDomain]);

  return (
    <form
      className="card p-5 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!prompt.trim() || disabled) return;
        onSubmit(prompt.trim(), domain);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted font-medium">
          Domain
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DOMAINS.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setDomain(d)}
              disabled={disabled}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                domain === d
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-ink-soft border-border hover:border-ink-muted"
              } disabled:opacity-40`}
            >
              {DOMAIN_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Type the technical question to put on trial…"
        rows={3}
        disabled={disabled}
        className="w-full bg-white border border-border rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition resize-y min-h-[88px]"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-ink-muted">
          {disabled ? (
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-ring" />
              Trial in session…
            </span>
          ) : (
            "Ready"
          )}
        </span>
        <div className="flex gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-border text-ink-soft hover:bg-bg-subtle disabled:opacity-40 transition"
            >
              New case
            </button>
          )}
          <button
            type="submit"
            disabled={disabled || !prompt.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-ink text-white hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Convene jury
          </button>
        </div>
      </div>
    </form>
  );
}
