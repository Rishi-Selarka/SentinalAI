"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "./Onboarding";
import { Courtroom } from "./Courtroom";
import { Sidebar, type SidebarView } from "./Sidebar";

const NAME_KEY = "sentinelai.userName";

export function AppShell() {
  const [name, setName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<SidebarView>("home");

  // SSR-safe localStorage hydration: localStorage isn't readable during
  // render, so the name must be pulled in after mount. The `hydrated` gate
  // below keeps the first client render matching the server (both show
  // Onboarding) so there is no hydration mismatch.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(NAME_KEY);
    } catch {
      /* localStorage unavailable */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time external-store read on mount; see comment above
    setName(stored && stored.trim() ? stored.trim() : null);
    setHydrated(true);
  }, []);

  if (hydrated && name) {
    return (
      <div className="flex min-h-screen bg-cream">
        <Sidebar
          userName={name}
          active={view}
          onSelect={setView}
          onResetUser={() => {
            try {
              localStorage.removeItem(NAME_KEY);
            } catch {
              /* ignore */
            }
            setName(null);
          }}
        />
        <main className="flex-1 min-w-0">
          <Courtroom userName={name} view={view} />
        </main>
      </div>
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
