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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAME_KEY);
      if (stored && stored.trim()) setName(stored.trim());
    } catch {
      /* localStorage unavailable */
    }
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
