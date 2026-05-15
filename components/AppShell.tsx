"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "./Onboarding";
import { Courtroom } from "./Courtroom";

const NAME_KEY = "sentinelai.userName";

export function AppShell() {
  // Render onboarding on first paint; swap to Courtroom after we read localStorage.
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

  // Until hydrated we don't know the user's name yet, so show onboarding.
  // After hydration, if we recovered a name, swap to the Courtroom.
  if (hydrated && name) {
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
