"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  History,
  LogOut,
  FolderGit2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { AetherLogo } from "./AetherLogo";

export type SidebarView = "home" | "repo" | "history";

const NAV: { id: SidebarView; label: string; icon: typeof MessageSquare }[] = [
  { id: "home", label: "New Trial", icon: MessageSquare },
  { id: "history", label: "History", icon: History },
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
  const [collapsed, setCollapsed] = useState(false);
  const initial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <motion.aside
      className="shrink-0 bg-surface text-cream flex flex-col h-screen sticky top-0 border-r border-surface-300 overflow-hidden"
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header — brand mark + collapse/back toggle */}
      <div
        className={`py-5 flex items-center border-b border-surface-300 ${
          collapsed ? "px-0 justify-center" : "px-5 justify-between"
        }`}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center shrink-0">
              <AetherLogo className="w-4 h-4 text-suits-600" />
            </div>
            <span className="text-cream text-sm font-semibold tracking-widest uppercase truncate">
              Sentinel<span className="text-suits-400">AI</span>
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-lg text-surface-600 hover:text-cream hover:bg-surface-200 transition-colors shrink-0"
          title={collapsed ? "Open panel" : "Close panel"}
          aria-label={collapsed ? "Open panel" : "Close panel"}
        >
          {collapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Features nav */}
      <div className="flex-1 flex flex-col gap-1 px-3 py-5 overflow-y-auto">
        {!collapsed && (
          <div className="text-[10px] uppercase tracking-[0.25em] text-surface-500 px-3 mb-2">
            Features
          </div>
        )}
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors text-left ${
                collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
              } ${
                isActive
                  ? "bg-suits-500/15 text-suits-300"
                  : "text-surface-700 hover:bg-surface-200 hover:text-cream"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}

        {/* GitHub repo analysis — separate feature, its own route */}
        <div
          className={`mt-4 pt-4 border-t border-surface-300 ${
            collapsed ? "px-0" : ""
          }`}
        >
          {!collapsed && (
            <div className="text-[10px] uppercase tracking-[0.25em] text-surface-500 px-3 mb-2">
              Repository
            </div>
          )}
          <button
            type="button"
            onClick={() => onSelect("repo")}
            title={collapsed ? "Analyze GitHub Repo" : undefined}
            className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors text-left w-full ${
              collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
            } ${
              active === "repo"
                ? "bg-suits-500/15 text-suits-300"
                : "text-surface-700 hover:bg-surface-200 hover:text-cream"
            }`}
          >
            <FolderGit2 className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Analyze Repo</span>}
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="px-3 py-4 border-t border-surface-300">
        {!collapsed && (
          <div className="text-[10px] uppercase tracking-[0.25em] text-surface-500 px-3 mb-2">
            Account
          </div>
        )}
        <div
          className={`flex items-center gap-3 rounded-lg bg-surface-200 ${
            collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-suits-500/20 text-suits-300 flex items-center justify-center text-sm font-semibold shrink-0">
            {initial}
          </div>
          {!collapsed && (
            <>
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
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
