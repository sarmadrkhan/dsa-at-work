"use client";

import { useState, useEffect, useRef } from "react";
import {
  CacheEntry,
  CacheMetrics,
} from "@/modules/04-hashmap-cache/core/lruCache";

interface Snapshot {
  entries: CacheEntry<string>[];
  metrics: CacheMetrics;
}

interface GetResult {
  hit: boolean;
  value: string | null;
  metrics: CacheMetrics;
}

const PRESET_KEYS = [
  "user:1001",
  "user:1002",
  "product:55",
  "session:abc",
  "config:theme",
  "product:99",
  "user:1003",
];

export default function LRUCachePage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [getKey, setGetKey] = useState("");
  const [setKey, setSetKey] = useState("");
  const [setValue, setSetValue] = useState("");
  const [lastResult, setLastResult] = useState<GetResult | null>(null);
  const [maxSize, setMaxSize] = useState(5);
  const [ttlMs, setTtlMs] = useState(10000);
  const [recentlyEvicted, setRecentlyEvicted] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshot = async () => {
    const res = await fetch("/api/modules/lru-cache/snapshot");
    const data = await res.json();
    setSnapshot(data);
  };

  useEffect(() => {
    fetchSnapshot();
    pollRef.current = setInterval(fetchSnapshot, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleGet = async (key: string) => {
    const k = key || getKey;
    if (!k) return;
    const res = await fetch(
      `/api/modules/lru-cache/get?key=${encodeURIComponent(k)}`,
    );
    const data: GetResult = await res.json();
    setLastResult(data);
    setGetKey(k);
    fetchSnapshot();
  };

  const handleSet = async () => {
    if (!setKey || !setValue) return;

    const prevKeys = snapshot?.entries.map((e) => e.key) ?? [];

    const res = await fetch("/api/modules/lru-cache/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: setKey, value: setValue }),
    });
    const data = await res.json();

    // Detect eviction by comparing keys before and after
    const newKeys = data.snapshot.entries.map((e: CacheEntry<string>) => e.key);
    const evicted = prevKeys.find((k) => !newKeys.includes(k));
    if (evicted) {
      setRecentlyEvicted(evicted);
      setTimeout(() => setRecentlyEvicted(null), 2000);
    }

    setSnapshot(data.snapshot);
    setSetKey("");
    setSetValue("");
  };

  const handleDelete = async (key: string) => {
    const res = await fetch(
      `/api/modules/lru-cache/delete?key=${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    setSnapshot(data.snapshot);
  };

  const handleReset = async () => {
    await fetch("/api/modules/lru-cache/reset", { method: "POST" });
    setLastResult(null);
    setRecentlyEvicted(null);
    fetchSnapshot();
  };

  const handleConfigure = async (newMaxSize: number, newTtlMs: number) => {
    await fetch("/api/modules/lru-cache/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxSize: newMaxSize, ttlMs: newTtlMs }),
    });
    fetchSnapshot();
  };

  const ttlRemaining = (entry: CacheEntry<string>) => {
    if (!entry.expiresAt) return null;
    const remaining = entry.expiresAt - Date.now();
    if (remaining <= 0) return "expired";
    return `${(remaining / 1000).toFixed(1)}s`;
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-neutral-500 font-mono text-sm mb-2">
          04 / Hashmap Everywhere
        </p>
        <h1 className="text-3xl font-bold mb-2">LRU Cache</h1>
        <p className="text-neutral-400 max-w-xl">
          In-memory cache with LRU eviction and TTL. Get, set, and delete keys -
          watch the cache reorder on every access and evict the least recently
          used entry when full.
        </p>
      </div>
      <div className="mb-8 border border-yellow-900 bg-yellow-950 rounded-xl px-4 py-3 text-xs text-yellow-600 font-mono">
        ⚠ State is in-memory and resets between server instances. On Vercel,
        each session may start fresh - this is expected behaviour for a
        stateless deployment.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Controls */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Get */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Get
            </h2>
            <input
              type="text"
              placeholder="key"
              value={getKey}
              onChange={(e) => setGetKey(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 mb-2 font-mono"
            />
            <button
              onClick={() => handleGet(getKey)}
              className="w-full bg-white text-black font-semibold text-sm py-2 rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Get
            </button>

            {/* Preset keys */}
            <div className="mt-3">
              <p className="text-xs text-neutral-600 mb-2">Try a preset key:</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_KEYS.map((k) => (
                  <button
                    key={k}
                    onClick={() => handleGet(k)}
                    className="text-xs font-mono px-2 py-1 border border-neutral-800 rounded hover:border-neutral-600 transition-colors text-neutral-400"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Get result */}
            {lastResult && (
              <div
                className={`mt-3 rounded-lg px-4 py-3 text-sm font-mono ${
                  lastResult.hit
                    ? "bg-green-950 border border-green-800 text-green-300"
                    : "bg-red-950 border border-red-900 text-red-400"
                }`}
              >
                <p className="font-semibold mb-1">
                  {lastResult.hit ? "✓ Cache Hit" : "✗ Cache Miss"}
                </p>
                {lastResult.hit && (
                  <p className="text-xs text-neutral-400">
                    value: {lastResult.value}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Set */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Set
            </h2>
            <input
              type="text"
              placeholder="key"
              value={setKey}
              onChange={(e) => setSetKey(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 mb-2 font-mono"
            />
            <input
              type="text"
              placeholder="value"
              value={setValue}
              onChange={(e) => setSetValue(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 mb-2 font-mono"
            />
            <button
              onClick={handleSet}
              className="w-full bg-white text-black font-semibold text-sm py-2 rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Set
            </button>
          </div>

          {/* Config */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Configuration
            </h2>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <span>Max Size</span>
                <span className="font-mono">{maxSize}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={maxSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxSize(v);
                  handleConfigure(v, ttlMs);
                }}
                className="w-full accent-white"
              />
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <span>TTL</span>
                <span className="font-mono">{ttlMs / 1000}s</span>
              </div>
              <input
                type="range"
                min={2000}
                max={30000}
                step={1000}
                value={ttlMs}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTtlMs(v);
                  handleConfigure(maxSize, v);
                }}
                className="w-full accent-white"
              />
            </div>
            <button
              onClick={handleReset}
              className="w-full text-sm border border-neutral-700 py-2 rounded-lg hover:border-neutral-500 transition-colors text-neutral-400"
            >
              Reset Cache
            </button>
          </div>
        </div>

        {/* Right - Cache Board + Metrics */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Metrics */}
          {snapshot && (
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Hit Rate"
                value={`${snapshot.metrics.hitRate}%`}
                highlight={
                  snapshot.metrics.hitRate < 50 &&
                  snapshot.metrics.hits + snapshot.metrics.misses > 0
                }
              />
              <MetricCard
                label="Hits"
                value={snapshot.metrics.hits.toString()}
              />
              <MetricCard
                label="Misses"
                value={snapshot.metrics.misses.toString()}
              />
              <MetricCard
                label="Evictions"
                value={snapshot.metrics.evictions.toString()}
              />
              <MetricCard
                label="Expirations"
                value={snapshot.metrics.expirations.toString()}
              />
              <MetricCard
                label="Fill"
                value={`${snapshot.metrics.currentSize} / ${snapshot.metrics.maxSize}`}
              />
            </div>
          )}

          {/* Cache Board */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                Cache Board
              </h2>
              <span className="text-xs text-neutral-600 font-mono">
                MRU → LRU
              </span>
            </div>

            {!snapshot || snapshot.entries.length === 0 ? (
              <p className="text-neutral-600 text-sm">
                Cache is empty. Set some keys to get started.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {snapshot.entries.map((entry, i) => {
                  const remaining = ttlRemaining(entry);
                  const isLRU = i === snapshot.entries.length - 1;
                  const isEvicted = recentlyEvicted === entry.key;

                  return (
                    <div
                      key={entry.key}
                      className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm border transition-all ${
                        isEvicted
                          ? "border-red-700 bg-red-950 opacity-50"
                          : isLRU
                            ? "border-neutral-700 bg-neutral-900 border-dashed"
                            : "border-neutral-800 bg-neutral-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-600 font-mono w-4">
                          {i + 1}
                        </span>
                        <div>
                          <span className="font-mono text-neutral-200 text-sm">
                            {entry.key}
                          </span>
                          <span className="text-neutral-600 mx-2">→</span>
                          <span className="font-mono text-neutral-400 text-sm">
                            {entry.value}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono">
                        {entry.hitCount > 0 && (
                          <span className="text-neutral-500">
                            {entry.hitCount} hit
                            {entry.hitCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {remaining && (
                          <span
                            className={
                              remaining === "expired"
                                ? "text-red-500"
                                : Number(remaining.replace("s", "")) < 3
                                  ? "text-yellow-600"
                                  : "text-neutral-600"
                            }
                          >
                            {remaining}
                          </span>
                        )}
                        {isLRU && (
                          <span className="text-neutral-600 text-xs">
                            next eviction
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(entry.key)}
                          className="text-neutral-700 hover:text-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {recentlyEvicted && (
              <div className="mt-3 text-xs font-mono text-red-500 border border-red-900 bg-red-950 rounded-lg px-3 py-2">
                ↳ evicted: {recentlyEvicted}
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
        className={`text-xl font-bold font-mono ${highlight ? "text-red-400" : "text-neutral-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
