"use client";

import { useState, useEffect, useRef } from "react";
import {
  Job,
  QueueMetrics,
  BackoffStrategy,
} from "@/modules/02-retry-queue/core/retryQueue";

// --- Config Panel ---
interface Config {
  batchSize: number;
  failRate: number;
  maxRetries: number;
  maxConcurrency: number;
  baseDelayMs: number;
  backoffStrategy: BackoffStrategy;
}

const defaultConfig: Config = {
  batchSize: 10,
  failRate: 0.4,
  maxRetries: 4,
  maxConcurrency: 3,
  baseDelayMs: 500,
  backoffStrategy: "exponential",
};

const STATUS_COLORS: Record<Job["status"], string> = {
  pending: "bg-neutral-700 text-neutral-300",
  "in-flight": "bg-blue-900 text-blue-300",
  retrying: "bg-yellow-900 text-yellow-300",
  done: "bg-green-900 text-green-300",
  dead: "bg-red-900 text-red-400",
};

export default function RetryQueuePage() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [running, setRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/modules/retry-queue/status");
      const data = await res.json();
      setJobs(data.jobs);
      setMetrics(data.metrics);

      // Stop polling when all jobs are resolved
      if (data.metrics?.isComplete) {
        stopPolling();
        setRunning(false);
      }
    }, 800);
  };

  const handleFire = async () => {
    setRunning(true);
    setJobs([]);
    setMetrics(null);

    await fetch("/api/modules/retry-queue/fire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    startPolling();
  };

  const handleDrain = async () => {
    await fetch("/api/modules/retry-queue/drain", { method: "POST" });
    stopPolling();
    setRunning(false);
  };

  useEffect(() => () => stopPolling(), []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-neutral-500 font-mono text-sm mb-2">
          02 / Queue Design
        </p>
        <h1 className="text-3xl font-bold mb-2">Retry Queue</h1>
        <p className="text-neutral-400 max-w-xl">
          HTTP retry queue with exponential backoff, concurrency control, and a
          dead-letter queue. Fire a batch of jobs and watch them move through
          the queue in real time.
        </p>
      </div>
      <div className="mb-8 border border-yellow-900 bg-yellow-950 rounded-xl px-4 py-3 text-xs text-yellow-600 font-mono">
        ⚠ State is in-memory and resets between server instances. On Vercel,
        each session may start fresh - this is expected behaviour for a
        stateless deployment.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Panel */}
        <div className="lg:col-span-1 border border-neutral-800 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
            Configuration
          </h2>

          <ConfigSlider
            label="Batch Size"
            value={config.batchSize}
            min={1}
            max={20}
            onChange={(v) => setConfig((c) => ({ ...c, batchSize: v }))}
          />
          <ConfigSlider
            label={`Fail Rate - ${Math.round(config.failRate * 100)}%`}
            value={config.failRate}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig((c) => ({ ...c, failRate: v }))}
          />
          <ConfigSlider
            label="Max Retries"
            value={config.maxRetries}
            min={1}
            max={6}
            onChange={(v) => setConfig((c) => ({ ...c, maxRetries: v }))}
          />
          <ConfigSlider
            label="Max Concurrency"
            value={config.maxConcurrency}
            min={1}
            max={10}
            onChange={(v) => setConfig((c) => ({ ...c, maxConcurrency: v }))}
          />
          <ConfigSlider
            label={`Base Delay`}
            value={config.baseDelayMs}
            min={100}
            max={2000}
            step={100}
            onChange={(v) => setConfig((c) => ({ ...c, baseDelayMs: v }))}
          />

          <div>
            <label className="text-xs text-neutral-500 mb-1 block">
              Backoff Strategy
            </label>
            <select
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200"
              value={config.backoffStrategy}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  backoffStrategy: e.target.value as BackoffStrategy,
                }))
              }
            >
              <option value="exponential">Exponential</option>
              <option value="linear">Linear</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleFire}
              disabled={running}
              className="flex-1 bg-white text-black font-semibold text-sm py-2 rounded-lg disabled:opacity-40 hover:bg-neutral-200 transition-colors"
            >
              {running ? "Running..." : "Fire Batch"}
            </button>
            {running && (
              <button
                onClick={handleDrain}
                className="px-3 py-2 text-sm border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
              >
                Drain
              </button>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Metrics */}
          {metrics && (
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Success Rate"
                value={`${metrics.successRate}%`}
              />
              <MetricCard
                label="Avg Attempts"
                value={metrics.avgAttempts.toString()}
              />
              <MetricCard
                label="Dead"
                value={metrics.dead.toString()}
                highlight={metrics.dead > 0}
              />
              <MetricCard label="Done" value={metrics.done.toString()} />
              <MetricCard
                label="Retrying"
                value={metrics.retrying.toString()}
              />
              <MetricCard
                label="In-Flight"
                value={metrics.inFlight.toString()}
              />
            </div>
          )}

          {/* Job Board */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              Job Board
            </h2>

            {jobs.length === 0 ? (
              <p className="text-neutral-600 text-sm">
                Fire a batch to see jobs appear here.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between bg-neutral-900 rounded-lg px-4 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-neutral-600 text-xs w-16 truncate">
                        {job.id.slice(0, 6)}
                      </span>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded ${STATUS_COLORS[job.status]}`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-neutral-500 text-xs font-mono">
                      <span>
                        {job.attempts} attempt{job.attempts !== 1 ? "s" : ""}
                      </span>
                      {job.error && (
                        <span className="text-red-500 truncate max-w-[180px]">
                          {job.error}
                        </span>
                      )}
                    </div>
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

// --- Reusable components ---

function ConfigSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-500 mb-1">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white"
      />
    </div>
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
