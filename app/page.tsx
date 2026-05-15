import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  return (
    <main className="flex-1 bg-background relative">
      <AppShell />
      <Link
        href="/repo"
        className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-full bg-surface text-cream text-xs font-medium shadow-lg hover:shadow-xl hover:bg-surface-200 transition"
      >
        Analyze GitHub repo →
      </Link>
    </main>
  );
}
