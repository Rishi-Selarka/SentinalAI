"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "./Onboarding";
import { Courtroom } from "./Courtroom";

const NAME_KEY = "sentinelai.userName";

export function AppShell() {
  const [name, setName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAME_KEY);
      if (stored && stored.trim()) setName(stored.trim());
    } catch {
      /* localStorage unavailable */
    }
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  if (!name) {
    return (
      <Onboarding
        onContinue={(n) => {
          try {
            localStorage.setItem(NAME_KEY, n);
          } catch {
            /* ignore */
          }
          setName(n);
        }}
      />
    );
  }

  return (
    <Courtroom
      userName={name}
      onResetUser={() => {
        try {
          localStorage.removeItem(NAME_KEY);
        } catch {
          /* ignore */
        }
        setName(null);
      }}
    />
  );
}
