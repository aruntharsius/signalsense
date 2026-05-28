"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { username, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Avoid SSR/client mismatch: only render theme-dependent icon after mount
  useEffect(() => setMounted(true), []);

  return (
    <header className="flex items-center gap-3 pb-3 mb-3 border-b border-light-border dark:border-dark-border">
      <span className="text-2xl">📡</span>
      <div>
        <h1 className="text-[1.1rem] font-bold font-mono text-sky-600 dark:text-[#00C8FF] tracking-tight leading-none">
          SignalSense
        </h1>
        <p className="text-[0.65rem] text-slate-500 mt-0.5">
          AI-Powered Technical Analysis
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-[0.68rem] font-semibold text-slate-500 bg-slate-100 dark:bg-[#1a2540] border border-slate-200 dark:border-[#243050] rounded-full px-3 py-1">
          👤 {username}
        </span>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:text-[#00C8FF] dark:hover:bg-[#00C8FF10] transition-colors w-8 h-8 flex items-center justify-center"
          title="Toggle theme"
        >
          {mounted && (theme === "dark" ? <Sun size={16} /> : <Moon size={16} />)}
        </button>
        <button
          onClick={logout}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-[#FF0055] dark:hover:bg-[#FF005510] transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
