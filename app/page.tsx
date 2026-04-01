import Link from "next/link";

const modules = [
  {
    id: "01-dfs-thinking",
    number: "01",
    title: "Dependency Tracer",
    pattern: "DFS Thinking",
    description:
      "Traces a component dependency graph, detects circular deps, and shows traversal order.",
    realWorld: "Webpack · React Trees · Microservice Tracing",
    status: "ready",
  },
  {
    id: "02-retry-queue",
    number: "02",
    title: "Retry Queue",
    pattern: "Queue Design",
    description:
      "HTTP retry queue with exponential backoff, dead-letter queue, and concurrency control.",
    realWorld: "AWS SQS · Stripe Webhooks · Resilient Microservices",
    status: "ready",
  },
  {
    id: "03-sorting-tradeoffs",
    number: "03",
    title: "Query Optimizer",
    pattern: "Sorting Trade-offs",
    description:
      "Recommends and benchmarks sort strategies based on your data shape and query type.",
    realWorld: "Database Query Planners · Data Pipelines",
    status: "coming-soon",
  },
  {
    id: "04-hashmap-cache",
    number: "04",
    title: "LRU Cache",
    pattern: "Hashmap Everywhere",
    description:
      "In-memory cache with TTL, eviction policy, and hit/miss stats. Redis, conceptually.",
    realWorld: "CDN Edge Caching · Memoization Layers · Redis",
    status: "ready",
  },
  {
    id: "05-sliding-window",
    number: "05",
    title: "Rate Limiter",
    pattern: "Sliding Window",
    description:
      "Sliding window log rate limiter on an API route. Shows allowed vs rejected over time.",
    realWorld: "GitHub API · Stripe · AWS API Gateway",
    status: "ready",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-16">
        <h1 className="text-4xl font-bold tracking-tight mb-3">dsa-at-work</h1>
        <p className="text-neutral-400 text-lg max-w-xl">
          How CS fundamentals actually show up in real codebases. Each module is
          a working system with the algorithm made explicit.
        </p>
      </div>

      {/* Module Grid */}
      <div className="flex flex-col gap-4">
        {modules.map((mod) => (
          <div
            key={mod.id}
            className={`border rounded-xl p-6 transition-colors ${
              mod.status === "ready"
                ? "border-neutral-700 hover:border-neutral-500 cursor-pointer"
                : "border-neutral-800 opacity-50 cursor-not-allowed"
            }`}
          >
            {mod.status === "ready" ? (
              <Link href={`/modules/${mod.id}`} className="block">
                <ModuleCard mod={mod} />
              </Link>
            ) : (
              <ModuleCard mod={mod} />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-20 text-neutral-600 text-sm">
        <p>
          "The algorithms don't show up at work. The thinking does." - built
          module by module.
        </p>
      </div>
    </main>
  );
}

function ModuleCard({ mod }: { mod: (typeof modules)[0] }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex gap-5 items-start">
        <span className="text-neutral-600 font-mono text-sm mt-1">
          {mod.number}
        </span>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold">{mod.title}</h2>
            <span className="text-xs font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
              {mod.pattern}
            </span>
            {mod.status === "coming-soon" && (
              <span className="text-xs text-neutral-600">coming soon</span>
            )}
          </div>
          <p className="text-neutral-400 text-sm mb-2">{mod.description}</p>
          <p className="text-neutral-600 text-xs font-mono">{mod.realWorld}</p>
        </div>
      </div>
      {mod.status === "ready" && (
        <span className="text-neutral-500 text-lg mt-1">→</span>
      )}
    </div>
  );
}
