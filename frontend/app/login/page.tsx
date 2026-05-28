"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#080B10] px-4">
      <div className="w-full max-w-sm bg-[#111622] border border-[#1a2540] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📡</div>
          <h1 className="text-2xl font-bold font-mono text-[#00C8FF] tracking-tight">
            SignalSense
          </h1>
          <p className="text-xs text-slate-500 mt-1">AI-Powered Technical Analysis</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[0.7rem] font-semibold uppercase tracking-widest text-slate-500 block mb-1">
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-[#243050] bg-[#0D1420] text-slate-200 font-mono text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00C8FF] focus:border-[#00C8FF]"
            />
          </div>
          <div>
            <label className="text-[0.7rem] font-semibold uppercase tracking-widest text-slate-500 block mb-1">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-[#243050] bg-[#0D1420] text-slate-200 font-mono text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00C8FF] focus:border-[#00C8FF]"
            />
          </div>

          {error && (
            <p className="text-[#FF0055] text-xs bg-[#FF005510] border border-[#FF005533] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-[#00C8FF] bg-[#00C8FF1A] border border-[#00C8FF55] hover:bg-[#00C8FF2A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2 font-mono"
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </form>

        <p className="text-[0.65rem] text-slate-600 text-center mt-5">
          Set <code className="text-slate-400">SS_USERNAME</code> and{" "}
          <code className="text-slate-400">SS_PASSWORD</code> env vars to configure credentials.
        </p>
      </div>
    </main>
  );
}
