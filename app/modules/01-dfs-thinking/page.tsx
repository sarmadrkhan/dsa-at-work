"use client";

import { useState, useCallback, useEffect } from "react";
import {
  TracerResult,
  TraversalStep,
  Graph,
} from "@/modules/01-dfs-thinking/core/dependencyTracer";

// --- Types ---
interface Preset {
  key: string;
  label: string;
  description: string;
  startNodeId: string;
  nodeCount: number;
}

interface PresetFull {
  label: string;
  description: string;
  startNodeId: string;
  graph: Graph;
}

const STATUS_COLORS: Record<TraversalStep["status"], string> = {
  visiting: "bg-blue-900 text-blue-300",
  done: "bg-green-900 text-green-300",
  circular: "bg-red-900 text-red-400",
};

const NODE_COLORS: Record<string, string> = {
  visiting: "border-blue-500 text-blue-300 bg-blue-950",
  done: "border-green-500 text-green-300 bg-green-950",
  circular: "border-red-500 text-red-400 bg-red-950",
  unvisited: "border-neutral-700 text-neutral-400 bg-neutral-900",
};

export default function DFSThinkingPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [currentPreset, setCurrentPreset] = useState<PresetFull | null>(null);
  const [result, setResult] = useState<TracerResult | null>(null);
  const [replayIndex, setReplayIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [presetsLoaded, setPresetsLoaded] = useState(false);

  // Load presets on first render
  const loadPresets = useCallback(async () => {
    if (presetsLoaded) return;
    const res = await fetch("/api/modules/dfs-thinking/presets");
    const data = await res.json();
    setPresets(data);
    setPresetsLoaded(true);
  }, [presetsLoaded]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // Load and trace a preset
  const selectPreset = async (key: string) => {
    setSelectedKey(key);
    setResult(null);
    setReplayIndex(-1);
    setLoading(true);

    const res = await fetch(`/api/modules/dfs-thinking/presets/${key}`);
    const preset: PresetFull = await res.json();
    setCurrentPreset(preset);

    // Run trace immediately
    const traceRes = await fetch("/api/modules/dfs-thinking/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        graph: preset.graph,
        startNodeId: preset.startNodeId,
      }),
    });
    const traceData: TracerResult = await traceRes.json();
    if (!traceData.steps) {
      setLoading(false);
      return;
    }
    setResult(traceData);
    setReplayIndex(traceData.steps.length - 1); // show full result by default
    setLoading(false);
  };

  // Compute visible node statuses up to current replay index
  const visibleSteps = result ? result.steps.slice(0, replayIndex + 1) : [];
  const nodeStatusMap: Record<string, TraversalStep["status"]> = {};
  visibleSteps.forEach((s) => {
    nodeStatusMap[s.nodeId] = s.status;
  });

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-neutral-500 font-mono text-sm mb-2">
          01 / DFS Thinking
        </p>
        <h1 className="text-3xl font-bold mb-2">Dependency Tracer</h1>
        <p className="text-neutral-400 max-w-xl">
          Select a graph to trace its dependencies using DFS. Detects circular
          references and shows the full traversal - the same way webpack, tsc,
          and eslint analyze module graphs.
        </p>
      </div>
      <div className="mb-8 border border-yellow-900 bg-yellow-950 rounded-xl px-4 py-3 text-xs text-yellow-600 font-mono">
        ⚠ State is in-memory and resets between server instances. On Vercel,
        each session may start fresh — this is expected behaviour for a
        stateless deployment.
      </div>

      {/* Preset Selector */}
      <div className="mb-8">
        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
          Select a graph
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presets.length === 0 && (
            <p className="text-neutral-600 text-sm col-span-2">
              Click anywhere to load presets...
            </p>
          )}
          {presets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => selectPreset(preset.key)}
              className={`text-left border rounded-xl px-4 py-3 transition-colors ${
                selectedKey === preset.key
                  ? "border-neutral-400 bg-neutral-900"
                  : "border-neutral-800 hover:border-neutral-600"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{preset.label}</span>
                <span className="text-xs font-mono text-neutral-600">
                  {preset.nodeCount} nodes
                </span>
              </div>
              <p className="text-xs text-neutral-500">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-neutral-500 text-sm">Tracing graph...</p>}

      {result && currentPreset && (
        <div className="flex flex-col gap-6">
          {/* Circular Dependency Warning */}
          {result.circularDeps.length > 0 && (
            <div className="border border-red-800 bg-red-950 rounded-xl px-5 py-4">
              <p className="text-red-400 font-semibold text-sm mb-2">
                ⚠ Circular{" "}
                {result.circularDeps.length > 1 ? "Dependencies" : "Dependency"}{" "}
                Detected
              </p>
              {result.circularDeps.map((dep, i) => (
                <p key={i} className="text-red-300 font-mono text-xs">
                  {dep.cycle.join(" → ")}
                </p>
              ))}
              <p className="text-red-700 text-xs mt-2">
                This is the structure that triggers webpack's circular
                dependency warning and slows TypeScript's incremental compiler.
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total Nodes"
              value={result.totalNodes.toString()}
            />
            <StatCard label="Max Depth" value={result.maxDepth.toString()} />
            <StatCard
              label="Circular Deps"
              value={result.circularDeps.length.toString()}
              highlight={result.circularDeps.length > 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Node Status Map */}
            <div className="border border-neutral-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                Node Status
              </h2>
              <div className="flex flex-col gap-2">
                {currentPreset.graph.nodes.map((node) => {
                  const status = nodeStatusMap[node.id] ?? "unvisited";
                  return (
                    <div
                      key={node.id}
                      className={`flex items-center justify-between border rounded-lg px-3 py-2 text-sm transition-colors ${NODE_COLORS[status]}`}
                    >
                      <span className="font-mono text-xs">{node.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-600">
                          {result.depths[node.id] !== undefined
                            ? `depth ${result.depths[node.id]}`
                            : ""}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono ${
                            STATUS_COLORS[status as TraversalStep["status"]] ??
                            "text-neutral-600"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Traversal Steps */}
            <div className="border border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                  Traversal Steps
                </h2>
                <span className="text-xs font-mono text-neutral-600">
                  {replayIndex + 1} / {result.steps.length}
                </span>
              </div>

              {/* Replay controls */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setReplayIndex(0)}
                  className="text-xs px-3 py-1.5 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => setReplayIndex((i) => Math.max(0, i - 1))}
                  disabled={replayIndex <= 0}
                  className="text-xs px-3 py-1.5 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors disabled:opacity-30"
                >
                  ← Prev
                </button>
                <button
                  onClick={() =>
                    setReplayIndex((i) =>
                      Math.min(result.steps.length - 1, i + 1),
                    )
                  }
                  disabled={replayIndex >= result.steps.length - 1}
                  className="text-xs px-3 py-1.5 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors disabled:opacity-30"
                >
                  Next →
                </button>
                <button
                  onClick={() => setReplayIndex(result.steps.length - 1)}
                  className="text-xs px-3 py-1.5 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                >
                  Full
                </button>
              </div>

              {/* Steps list */}
              <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto pr-1">
                {result.steps.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                      i === replayIndex
                        ? "bg-neutral-800"
                        : i < replayIndex
                          ? "opacity-50"
                          : "opacity-20"
                    }`}
                  >
                    <span className="text-neutral-600 w-5 text-right">
                      {i + 1}
                    </span>
                    <span
                      style={{ paddingLeft: `${step.depth * 12}px` }}
                      className="flex-1"
                    >
                      {step.nodeId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded ${STATUS_COLORS[step.status]}`}
                    >
                      {step.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Traversal Order */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Traversal Order
            </h2>
            <div className="flex flex-wrap gap-2">
              {result.traversalOrder.map((nodeId, i) => (
                <div key={nodeId} className="flex items-center gap-1.5">
                  <span className="font-mono text-sm text-neutral-300">
                    {nodeId}
                  </span>
                  {i < result.traversalOrder.length - 1 && (
                    <span className="text-neutral-700">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// --- Reusable components ---
function StatCard({
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
