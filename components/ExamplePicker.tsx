"use client";

import { EXAMPLE_PROMPTS, type ExamplePrompt } from "@/lib/examples";
import { DOMAIN_LABELS } from "@/lib/jury/prompts";

export function ExamplePicker({
  onPick,
  disabled,
}: {
  onPick: (ex: ExamplePrompt) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-[0.25em] text-brass/80">
        Or call a pre-seeded case
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {EXAMPLE_PROMPTS.map((ex) => (
          <button
            key={ex.id}
            disabled={disabled}
            onClick={() => onPick(ex)}
            className="text-left wood-panel rounded-xl p-3 hover:border-brass transition disabled:opacity-40"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-brass">
              {DOMAIN_LABELS[ex.domain]}
            </div>
            <div className="text-sm font-semibold text-parchment mt-1">
              {ex.title}
            </div>
            <div className="text-xs text-parchment-soft/70 mt-1 line-clamp-2">
              {ex.prompt}
            </div>
            <div className="text-[10px] text-brass-bright/80 mt-2 italic">
              {ex.catchHint}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
