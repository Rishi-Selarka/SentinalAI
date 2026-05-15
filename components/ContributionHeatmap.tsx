"use client";

import { useMemo } from "react";

/**
 * A GitHub-contributions-style activity grid in powder blue. Used as the
 * left panel of the onboarding screen. The pattern is deterministic
 * (seeded by cell coordinates) so it doesn't flicker on re-render, and
 * the right edge is masked + blurred so the grid blends smoothly into the
 * cream form area on the right half of the screen.
 */
export function ContributionHeatmap({
  cols = 68,
  rows = 11,
}: {
  cols?: number;
  rows?: number;
}) {
  const cells = useMemo(() => {
    const out: number[][] = [];
    for (let y = 0; y < rows; y++) {
      const row: number[] = [];
      for (let x = 0; x < cols; x++) {
        // Mix several sinusoids at different frequencies to get organic
        // looking clusters of activity (some weeks dense, some sparse).
        const n =
          Math.sin(x * 0.41 + y * 1.7) * 0.55 +
          Math.cos(x * 0.27 - y * 0.9) * 0.45 +
          Math.sin((x + y) * 0.13) * 0.30 +
          Math.cos(x * 0.07 + y * 0.5) * 0.20 +
          Math.sin(x * 0.91 + y * 0.33) * 0.18 +
          Math.cos(x * 1.7 - y * 0.21) * 0.12;
        // Normalize roughly to [0, 1].
        const v = Math.max(0, Math.min(1, (n + 1.8) / 3.6));
        // Bucket into 7 density levels (0 = empty, 6 = deepest blue).
        const level =
          v < 0.22
            ? 0
            : v < 0.36
              ? 1
              : v < 0.50
                ? 2
                : v < 0.64
                  ? 3
                  : v < 0.77
                    ? 4
                    : v < 0.89
                      ? 5
                      : 6;
        row.push(level);
      }
      out.push(row);
    }
    return out;
  }, [cols, rows]);

  return (
    <div
      role="img"
      aria-label="Activity heatmap"
      className="w-full h-full grid gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        // A whisper of blur softens the squares' edges, giving the field
        // more depth without making individual cells indistinct.
        filter: "blur(0.35px)",
      }}
    >
      {cells.flatMap((row, y) =>
        row.map((level, x) => (
          <div
            key={`${x}-${y}`}
            className={`rounded-[3px] aspect-square ${LEVEL_CLASS[level]}`}
          />
        )),
      )}
    </div>
  );
}

const LEVEL_CLASS = [
  // 0 — empty cell, barely visible on the powder-blue bg.
  "bg-cream-200/55",
  // 1 — faintest tint
  "bg-suits-100",
  // 2 — light powder
  "bg-suits-200",
  // 3 — powder anchor
  "bg-suits-300",
  // 4 — mid powder blue
  "bg-suits-400",
  // 5 — saturated brand blue
  "bg-suits-600",
  // 6 — deepest accent (used sparingly for "loud" weeks)
  "bg-suits-700",
];
