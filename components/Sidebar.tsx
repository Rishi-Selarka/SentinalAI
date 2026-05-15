"use client";

import {
  MessageSquare,
  Users,
  Sparkles,
  History,
  Settings,
  LogOut,
} from "lucide-react";
import { AetherLogo } from "./AetherLogo";

export type SidebarView = "home" | "jurors" | "examples" | "history" | "settings";

const NAV: { id: SidebarView; label: string; icon: typeof MessageSquare }[] = [
  { id: "home", label: "New Trial", icon: MessageSquare },
  { id: "jurors", label: "Jurors", icon: Users },
  { id: "examples", label: "Examples", icon: Sparkles },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  userName,
  active,
  onSelect,
  onResetUser,
}: {
  userName: string;
  active: SidebarView;
  onSelect: (id: SidebarView) => void;
  onResetUser?: () => void;
}) {
  const initial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <aside className="w-64 shrink-0 bg-surface text-cream flex flex-col h-screen sticky top-0 border-r border-surface-300">
      {/* Brand mark — small, sidebar-only */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-surface-300">
        <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center">
          <AetherLogo className="w-4 h-4 text-suits-600" />
        </div>
        <span className="text-cream text-sm font-semibold tracking-widest uppercase">
          Sentinel<span className="text-suits-400">AI</span>
        </span>
      </div>

      {/* Features nav */}
      <div className="flex-1 flex flex-col gap-1 px-3 py-5 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-[0.25em] text-surface-500 px-3 mb-2">
          Features
        </div>
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? "bg-suits-500/15 text-suits-300"
                  : "text-surface-700 hover:bg-surface-200 hover:text-cream"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Account */}
      <div className="px-3 py-4 border-t border-surface-300">
        <div className="text-[10px] uppercase tracking-[0.25em] text-surface-500 px-3 mb-2">
          Account
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-200">
          <div className="w-9 h-9 rounded-full bg-suits-500/20 text-suits-300 flex items-center justify-center text-sm font-semibold shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-cream truncate">{userName}</div>
            <div className="text-[10px] text-surface-500">Signed in</div>
          </div>
          {onResetUser && (
            <button
              type="button"
              onClick={onResetUser}
              className="p-1.5 rounded-md text-surface-600 hover:text-cream hover:bg-surface-300 transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
