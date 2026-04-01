"use client";

import { useState } from "react";
import {
  DataProfile,
  QueryType,
  OptimizerResult,
  SortAlgorithm,
} from "@/modules/03-sorting-tradeoffs/core/queryOptimizer";

const DATA_PROFILES: {
  value: DataProfile;
  label: string;
  description: string;
}[] = [
  {
    value: "random",
    label: "Random",
    description: "Uniformly distributed, no existing order",
  },
  {
    value: "nearly-sorted",
    label: "Nearly Sorted",
    description: "Mostly ordered with ~5% random swaps",
  },
  {
    value: "reversed",
    label: "Reversed",
    description: "Fully descending order",
  },
  {
    value: "many-duplicates",
    label: "Many Duplicates",
    description: "Low cardinality, values in range 0–9",
  },
  {
    value: "small-dataset",
    label: "Small Dataset",
    description: "20 elements or fewer",
  },
];

const QUERY_TYPES: { value: QueryType; label: string; description: string }[] =
  [
    {
      value: "one-time-sort",
      label: "One-time Sort",
      description: "Sort once, read result",
    },
    {
      value: "repeated-reads",
      label: "Repeated Reads",
      description: "Sort once, read many times",
    },
    {
      value: "stream-sort",
      label: "Stream Sort",
      description: "Memory-constrained, data arrives in chunks",
    },
    {
      value: "stable-required",
      label: "Stable Required",
      description: "Equal elements must preserve original order",
    },
  ];

const ALGORITHM_COLORS: Record<SortAlgorithm, string> = {
  quicksort: "text-blue-400",
  mergesort: "text-purple-400",
  timsort: "text-green-400",
  heapsort: "text-yellow-400",
  "insertion-sort": "text-orange-400",
  "counting-sort": "text-pink-400",
};

export default function QueryOptimizerPage() {
  const [dataProfile, setDataProfile] = useState<DataProfile>("random");
  const [queryType, setQueryType] = useState<QueryType>("one-time-sort");
  const [dataSize, setDataSize] = useState(1000);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOptimize = async () => {
    setLoading(true);
    const res = await fetch("/api/modules/query-optimizer/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataProfile, queryType, dataSize }),
    });
    const data: OptimizerResult = await res.json();
    setResult(data);
    setLoading(false);
  };

  const maxDuration = result
    ? Math.max(...result.benchmarks.map((b) => b.durationMs))
    : 1;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-neutral-500 font-mono text-sm mb-2">
          03 / Sorting Trade-offs
        </p>
        <h1 className="text-3xl font-bold mb-2">Query Optimizer</h1>
        <p className="text-neutral-400 max-w-xl">
          Select a data profile and query type. The optimizer recommends a sort
          strategy and benchmarks all six algorithms on real data - the same
          reasoning a database query planner uses before executing a sort.
        </p>
      </div>
      <div className="mb-8 border border-yellow-900 bg-yellow-950 rounded-xl px-4 py-3 text-xs text-yellow-600 font-mono">
        ⚠ State is in-memory and resets between server instances. On Vercel,
        each session may start fresh - this is expected behaviour for a
        stateless deployment.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Config */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Data Profile */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Data Profile
            </h2>
            <div className="flex flex-col gap-2">
              {DATA_PROFILES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDataProfile(p.value)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    dataProfile === p.value
                      ? "border-neutral-400 bg-neutral-900"
                      : "border-neutral-800 hover:border-neutral-600"
                  }`}
                >
                  <p className="font-medium text-neutral-200">{p.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Query Type */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Query Type
            </h2>
            <div className="flex flex-col gap-2">
              {QUERY_TYPES.map((q) => (
                <button
                  key={q.value}
                  onClick={() => setQueryType(q.value)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    queryType === q.value
                      ? "border-neutral-400 bg-neutral-900"
                      : "border-neutral-800 hover:border-neutral-600"
                  }`}
                >
                  <p className="font-medium text-neutral-200">{q.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {q.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Data Size */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Data Size
            </h2>
            <div className="flex justify-between text-xs text-neutral-500 mb-1">
              <span>Elements</span>
              <span className="font-mono">{dataSize.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={10}
              max={50000}
              step={100}
              value={dataSize}
              onChange={(e) => setDataSize(Number(e.target.value))}
              className="w-full accent-white mb-4"
            />
            <button
              onClick={handleOptimize}
              disabled={loading}
              className="w-full bg-white text-black font-semibold text-sm py-2 rounded-lg disabled:opacity-40 hover:bg-neutral-200 transition-colors"
            >
              {loading ? "Running benchmarks..." : "Run Optimizer"}
            </button>
          </div>
        </div>

        {/* Right - Results */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {!result && !loading && (
            <div className="border border-neutral-800 rounded-xl p-8 text-center">
              <p className="text-neutral-600 text-sm">
                Select a profile and run the optimizer to see the recommendation
                and benchmark results.
              </p>
            </div>
          )}

          {loading && (
            <div className="border border-neutral-800 rounded-xl p-8 text-center">
              <p className="text-neutral-500 text-sm">
                Running benchmarks on {dataSize.toLocaleString()} elements...
              </p>
            </div>
          )}

          {result && (
            <>
              {/* Recommendation */}
              <div className="border border-neutral-600 bg-neutral-900 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Recommendation
                  </h2>
                  <span
                    className={`font-mono font-bold text-sm ${
                      ALGORITHM_COLORS[result.recommendation]
                    }`}
                  >
                    {result.recommendation}
                  </span>
                </div>
                <p className="text-neutral-300 text-sm leading-relaxed mb-3">
                  {result.recommendationReason}
                </p>
                <div className="border-t border-neutral-800 pt-3">
                  <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">
                    Trade-off
                  </p>
                  <p className="text-neutral-500 text-xs leading-relaxed">
                    {result.tradeoffSummary}
                  </p>
                </div>
              </div>

              {/* Benchmark Table */}
              <div className="border border-neutral-800 rounded-xl p-5">
                <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                  Benchmark Results
                </h2>
                <div className="flex flex-col gap-2">
                  {result.benchmarks.map((b) => (
                    <div
                      key={b.algorithm}
                      className={`rounded-lg px-4 py-3 border transition-colors ${
                        b.recommended
                          ? "border-neutral-500 bg-neutral-900"
                          : "border-neutral-800 bg-neutral-950"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-sm font-semibold ${
                              ALGORITHM_COLORS[b.algorithm]
                            }`}
                          >
                            {b.algorithm}
                          </span>
                          {b.recommended && (
                            <span className="text-xs bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded font-mono">
                              recommended
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-sm text-neutral-300">
                          {b.durationMs}ms
                        </span>
                      </div>

                      {/* Duration bar */}
                      <div className="w-full bg-neutral-800 rounded-full h-1 mb-2">
                        <div
                          className={`h-1 rounded-full ${
                            b.recommended ? "bg-white" : "bg-neutral-600"
                          }`}
                          style={{
                            width: `${Math.max(2, (b.durationMs / maxDuration) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-neutral-600">
                        <span>{b.operationCount.toLocaleString()} ops</span>
                        <span>{b.memoryProfile}</span>
                        <span>{b.stable ? "stable" : "unstable"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
