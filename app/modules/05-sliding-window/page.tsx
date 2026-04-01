"use client";

import { useState, useEffect, useRef } from "react";
import {
  RateLimiterResult,
  RequestRecord,
  RateLimiterMetrics,
  RateLimiterStrategy,
} from "@/modules/05-sliding-window/core/rateLimiter";

const CLIENTS = ["client-A", "client-B", "client-C"];

interface Status {
  metrics: RateLimiterMetrics;
  history: RequestRecord[];
}

export default function RateLimiterPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [selectedClient, setSelectedClient] = useState("client-A");
  const [lastResult, setLastResult] = useState<RateLimiterResult | null>(null);
  const [burstResults, setBurstResults] = useState<RateLimiterResult[] | null>(
    null,
  );
  const [windowMs, setWindowMs] = useState(10000);
  const [maxRequests, setMaxRequests] = useState(5);
  const [strategy, setStrategy] =
    useState<RateLimiterStrategy>("sliding-window-log");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    const res = await fetch("/api/modules/rate-limiter/status");
    const data = await res.json();
    setStatus(data);
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 800);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleConfigure = async (
    newWindowMs: number,
    newMaxRequests: number,
    newStrategy: RateLimiterStrategy,
  ) => {
    await fetch("/api/modules/rate-limiter/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        windowMs: newWindowMs,
        maxRequests: newMaxRequests,
        strategy: newStrategy,
      }),
    });
  };

  const handleRequest = async () => {
    const res = await fetch("/api/modules/rate-limiter/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClient }),
    });
    const data: RateLimiterResult = await res.json();
    setLastResult(data);
    setBurstResults(null);
    fetchStatus();
  };

  const handleBurst = async () => {
    const res = await fetch("/api/modules/rate-limiter/burst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClient, count: 10 }),
    });
    const data = await res.json();
    setBurstResults(data.results);
    setLastResult(null);
    fetchStatus();
  };

  const handleReset = async () => {
    await fetch("/api/modules/rate-limiter/reset", { method: "POST" });
    setLastResult(null);
    setBurstResults(null);
    fetchStatus();
  };

  // Compute per-client remaining from history
  const getClientRemaining = (clientId: string) => {
    if (!status) return null;
    const clientHistory = status.history.filter((r) => r.clientId === clientId);
    if (clientHistory.length === 0) return null;
    const latest = clientHistory[0]; // history is reversed
    const matchingResult = status.history.find(
      (r) => r.clientId === clientId && r.allowed,
    );
    return matchingResult ? "active" : "limited";
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-neutral-500 font-mono text-sm mb-2">
          05 / Sliding Window
        </p>
        <h1 className="text-3xl font-bold mb-2">Rate Limiter</h1>
        <p className="text-neutral-400 max-w-xl">
          Sliding window log rate limiter with per-client isolation. Fire single
          requests or burst a client to see the limit kick in. Compare sliding
          window vs fixed window behavior.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Controls */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Client selector */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Client
            </h2>
            <div className="flex flex-col gap-2">
              {CLIENTS.map((client) => {
                const state = getClientRemaining(client);
                return (
                  <button
                    key={client}
                    onClick={() => setSelectedClient(client)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-mono transition-colors ${
                      selectedClient === client
                        ? "border-neutral-400 bg-neutral-900"
                        : "border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    <span>{client}</span>
                    {state && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          state === "limited"
                            ? "bg-red-900 text-red-400"
                            : "bg-green-900 text-green-400"
                        }`}
                      >
                        {state}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Fire Requests
            </h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleRequest}
                className="w-full bg-white text-black font-semibold text-sm py-2 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Single Request
              </button>
              <button
                onClick={handleBurst}
                className="w-full border border-neutral-700 text-sm py-2 rounded-lg hover:border-neutral-500 transition-colors"
              >
                Burst × 10
              </button>
              <button
                onClick={handleReset}
                className="w-full border border-neutral-800 text-neutral-500 text-sm py-2 rounded-lg hover:border-neutral-600 transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Single request result */}
            {lastResult && (
              <div
                className={`mt-3 rounded-lg px-4 py-3 text-sm font-mono border ${
                  lastResult.allowed
                    ? "bg-green-950 border-green-800 text-green-300"
                    : "bg-red-950 border-red-900 text-red-400"
                }`}
              >
                <p className="font-semibold">
                  {lastResult.allowed ? "✓ Allowed" : "✗ Blocked - 429"}
                </p>
                <p className="text-xs mt-1 text-neutral-400">
                  remaining: {lastResult.remaining}
                </p>
                {lastResult.retryAfter && (
                  <p className="text-xs text-neutral-500">
                    retry after: {(lastResult.retryAfter / 1000).toFixed(1)}s
                  </p>
                )}
              </div>
            )}

            {/* Burst results */}
            {burstResults && (
              <div className="mt-3 flex flex-col gap-1">
                {burstResults.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-1.5 rounded text-xs font-mono ${
                      r.allowed
                        ? "bg-green-950 text-green-400"
                        : "bg-red-950 text-red-400"
                    }`}
                  >
                    <span>req {i + 1}</span>
                    <span>{r.allowed ? "allowed" : "blocked"}</span>
                    <span>remaining: {r.remaining}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Config */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Configuration
            </h2>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <span>Max Requests</span>
                <span className="font-mono">{maxRequests}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={maxRequests}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxRequests(v);
                  handleConfigure(windowMs, v, strategy);
                }}
                className="w-full accent-white"
              />
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <span>Window</span>
                <span className="font-mono">{windowMs / 1000}s</span>
              </div>
              <input
                type="range"
                min={5000}
                max={60000}
                step={5000}
                value={windowMs}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setWindowMs(v);
                  handleConfigure(v, maxRequests, strategy);
                }}
                className="w-full accent-white"
              />
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-2">Strategy</p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    "sliding-window-log",
                    "fixed-window",
                  ] as RateLimiterStrategy[]
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStrategy(s);
                      handleConfigure(windowMs, maxRequests, s);
                    }}
                    className={`text-left px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                      strategy === s
                        ? "border-neutral-400 bg-neutral-900 text-neutral-200"
                        : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right - Metrics + History */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Metrics */}
          {status && (
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Block Rate"
                value={`${status.metrics.blockRate}%`}
                highlight={status.metrics.blockRate > 50}
              />
              <MetricCard
                label="Allowed"
                value={status.metrics.allowedRequests.toString()}
              />
              <MetricCard
                label="Blocked"
                value={status.metrics.blockedRequests.toString()}
              />
              <MetricCard
                label="Total Requests"
                value={status.metrics.totalRequests.toString()}
              />
              <MetricCard
                label="Active Clients"
                value={status.metrics.activeClients.toString()}
              />
              <MetricCard
                label="Strategy"
                value={strategy === "sliding-window-log" ? "Sliding" : "Fixed"}
              />
            </div>
          )}

          {/* Request History */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              Request History
            </h2>

            {!status || status.history.length === 0 ? (
              <p className="text-neutral-600 text-sm">
                No requests yet. Fire a single request or burst to see the feed.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto pr-1">
                {status.history.map((record) => (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between px-4 py-2 rounded-lg text-xs font-mono ${
                      record.allowed
                        ? "bg-green-950 text-green-300"
                        : "bg-red-950 text-red-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          record.allowed
                            ? "bg-green-900 text-green-300"
                            : "bg-red-900 text-red-400"
                        }`}
                      >
                        {record.allowed ? "200" : "429"}
                      </span>
                      <span className="text-neutral-400">
                        {record.clientId}
                      </span>
                    </div>
                    <span className="text-neutral-600">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p
        className={`text-xl font-bold font-mono ${
          highlight ? "text-red-400" : "text-neutral-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
