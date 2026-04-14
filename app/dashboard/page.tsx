"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AuthMe = {
  id: string;
  email: string;
  plan: "free" | "pro" | "elite" | null;
  subscriptionActive: boolean;
};

type Stats = {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: string;
  balance: number;
  realizedPnl: number;
};

export default function DashboardPage() {
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("nexus_auth_token") || "";
        const userEmail = localStorage.getItem("nexus_user_email") || "";
        if (!token || !userEmail) {
          throw new Error("Please sign in first.");
        }

        const meRes = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.error || "Session expired.");
        setAuth(meData);

        const statsRes = await fetch("/api/stats", {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-user-id": userEmail,
          },
        });
        const statsData = await statsRes.json();
        if (!statsRes.ok) throw new Error(statsData.error || "Failed to load stats.");
        setStats(statsData);
      } catch (e: any) {
        setError(e?.message || "Unable to load dashboard.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const strategyLabel = useMemo(() => {
    if (!auth?.subscriptionActive) return "Locked";
    if (auth.plan === "elite") return "Auto + Adaptive";
    if (auth.plan === "pro") return "Adaptive Signals";
    return "Paper Strategy";
  }, [auth]);

  const confidenceLabel = useMemo(() => {
    if (!stats) return "0%";
    const wr = Number(stats.winRate || 0);
    const adjusted = Math.max(35, Math.min(95, wr));
    return `${adjusted.toFixed(0)}%`;
  }, [stats]);

  const formatUsd = (n?: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">User Dashboard</h1>
            <p className="mt-2 text-gray-400">Live account, subscription, and trading performance.</p>
          </div>
          <Link
            href="/signup"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            Manage Plan
          </Link>
        </div>

        {loading && <p className="mt-8 text-gray-300">Loading dashboard...</p>}
        {!loading && error && (
          <div className="mt-8 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-5 gap-4">
              <KpiCard label="Balance" value={formatUsd(stats?.balance)} />
              <KpiCard label="Win Rate" value={`${stats?.winRate || "0.00"}%`} />
              <KpiCard label="Active Trades" value={(stats?.totalTrades ? "1" : "0")} />
              <KpiCard label="Strategy" value={strategyLabel} />
              <KpiCard label="Confidence" value={confidenceLabel} />
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Panel title="Account">
                <p className="text-sm text-gray-300">Email: {auth?.email}</p>
                <p className="text-sm text-gray-300 mt-2">Plan: {(auth?.plan || "free").toUpperCase()}</p>
                <p className="text-sm text-gray-300 mt-2">
                  Subscription: {auth?.subscriptionActive ? "Active" : "Inactive"}
                </p>
              </Panel>
              <Panel title="Performance">
                <p className="text-sm text-gray-300">Trades: {stats?.totalTrades || 0}</p>
                <p className="text-sm text-gray-300 mt-2">Wins: {stats?.wins || 0}</p>
                <p className="text-sm text-gray-300 mt-2">Losses: {stats?.losses || 0}</p>
                <p className="text-sm text-gray-300 mt-2">
                  Realized PnL: {formatUsd(stats?.realizedPnl)}
                </p>
              </Panel>
              <Panel title="Feature Access">
                <p className="text-sm text-gray-300">Paper Trading: Enabled</p>
                <p className="text-sm text-gray-300 mt-2">
                  Live Signals: {auth?.plan === "pro" || auth?.plan === "elite" ? "Enabled" : "Locked"}
                </p>
                <p className="text-sm text-gray-300 mt-2">
                  Auto Trading: {auth?.plan === "elite" ? "Enabled" : "Locked"}
                </p>
              </Panel>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-white/10 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-white/10 p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
