# Module 02 - Retry Queue

**Pattern:** Queue Design  
**Real-world system:** HTTP Retry Queue with exponential backoff  
**Seen at:** AWS SQS · Stripe Webhooks · Any resilient microservice

---

## The Big Picture

When your app calls another service - an API, a database, a webhook - that call can fail. Network blips, the other service being overloaded, timeouts. A naive app just crashes or shows an error. A production app **queues the failed job and tries again**, intelligently. That's what this module builds.

---

## File: `core/retryQueue.ts`

### Types & Interfaces

```ts
type JobStatus = "pending" | "in-flight" | "retrying" | "done" | "dead";
```

Every job in the queue has a lifecycle. Think of it like a package delivery status:

| Status      | Meaning                               |
| ----------- | ------------------------------------- |
| `pending`   | Sitting in the queue, not started yet |
| `in-flight` | Currently being attempted             |
| `retrying`  | Failed once, scheduled to try again   |
| `done`      | Succeeded                             |
| `dead`      | Failed too many times, gave up        |

Jobs that reach `dead` go to the **dead-letter queue** - a holding area for jobs that couldn't be saved, so you can inspect them later. Every serious queue system (AWS SQS, RabbitMQ, Azure Service Bus) has this concept.

---

```ts
interface Job { ... }
```

The shape of a single unit of work. Key fields:

- `attempts` - how many times we've tried this job
- `maxRetries` - the ceiling before we mark it dead
- `nextRetryAt` - timestamp of when the next retry is scheduled
- `error` - the last error message, so you know _why_ it failed

---

```ts
interface RetryQueueConfig { ... }
```

The knobs you turn when you create the queue:

- `maxConcurrency` - how many jobs can run at the same time. If this is 3, only 3 HTTP calls happen simultaneously, others wait. This prevents you from hammering a struggling service.
- `maxRetries` - global ceiling for all jobs in this queue
- `baseDelayMs` - the starting point for backoff calculations
- `backoffStrategy` - exponential, linear, or fixed
- `failRate` - simulated failure probability (0–1). In real life this would be the actual failure rate of the service you're calling.

---

### `calculateBackoff` - The Core Algorithm

```ts
case "exponential":
  return baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
```

Instead of retrying immediately (which would hammer a struggling server), you wait longer each time:

- Attempt 1 fails → wait 1s
- Attempt 2 fails → wait 2s
- Attempt 3 fails → wait 4s
- Attempt 4 fails → wait 8s

That's `base * 2^attempt` - exponential growth.

The `+ Math.random() * 200` part adds **jitter** - a tiny random extra delay. Why? Imagine 1000 jobs all fail at the same time and retry at exactly the same second. You've just created a traffic spike that could take the server down again. Random jitter spreads them out. This is called avoiding the **thundering herd problem** and it's why AWS, Stripe, and Google all use exponential backoff with jitter.

| Strategy    | Pattern           | When to use                           |
| ----------- | ----------------- | ------------------------------------- |
| Exponential | 1s → 2s → 4s → 8s | Default. Best for overloaded services |
| Linear      | 1s → 2s → 3s → 4s | Simpler, less aggressive              |
| Fixed       | 1s → 1s → 1s → 1s | When delay amount doesn't matter      |

---

### `simulateHttpCall` - Fake Network

```ts
await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
```

Simulates 200–500ms of network latency so the demo feels real.

```ts
const errors = ["503 Service Unavailable", "429 Too Many Requests", ...]
```

These are all real HTTP errors you'd see in production:

| Error                       | Meaning                                            |
| --------------------------- | -------------------------------------------------- |
| `503 Service Unavailable`   | Server is down or overloaded                       |
| `429 Too Many Requests`     | You're being rate limited                          |
| `500 Internal Server Error` | The server crashed                                 |
| `ECONNRESET`                | Connection was cut mid-request                     |
| `Gateway Timeout`           | A proxy between you and the server gave up waiting |

---

### `RetryQueue` Class

```ts
private queue: Map<string, Job>
```

A `Map` (key-value store) where the key is the job ID and the value is the job. We use a `Map` instead of an array because looking up a specific job by ID is instant - `O(1)`. With an array you'd have to scan through every item - `O(n)`.

---

```ts
private inFlightCount = 0
```

Tracks how many jobs are currently running. Checked before starting a new job - if we're at the concurrency limit, we wait. This is how connection pools, thread pools, and worker limits work in production systems.

---

```ts
subscribe(fn: (jobs: Job[]) => void)
```

The **subscriber pattern** (also called the observer pattern). Instead of the UI constantly polling "what's the queue state?" every second, the queue _tells_ the UI whenever something changes. The UI hands the queue a function, the queue calls it on every update. This is how React state updates, WebSocket events, and event emitters all work conceptually. Much more efficient than polling.

---

```ts
enqueue(payloads);
```

Takes a batch of work, wraps each one in a `Job` object with a unique ID (`crypto.randomUUID()`), adds them all to the Map, notifies subscribers.

---

```ts
async process()
```

The main engine. Grabs all pending jobs, fires them concurrently up to the concurrency limit. Each job:

1. Marks itself `in-flight`
2. Makes the (simulated) HTTP call
3. On success → marks `done`
4. On failure → checks if retries are exhausted → `dead`, or schedules a retry with `setTimeout` after the backoff delay

---

```ts
async drain()
```

Graceful shutdown - a real production concern. When you deploy a new version of your service, you don't want to kill jobs mid-flight. `drain()` cancels anything waiting and lets in-flight jobs finish before shutting down. Kubernetes, PM2, and AWS Lambda all have shutdown hooks designed to trigger something exactly like this.

---

```ts
getMetrics();
```

Computes live stats from the current queue state - success rate, avg attempts, counts by status. This feeds the metrics panel in the UI. In production this would pipe into something like Datadog, CloudWatch, or Prometheus.

---

## File: `api/routes`

### Three routes, each with a single responsibility:

- `/fire` - accepts config from the UI (batch size, fail rate, backoff strategy etc.), resets the queue, enqueues a fresh batch, then calls `process()` without awaiting it. The "fire and forget" pattern - the HTTP response returns immediately while the queue runs in the background. This mirrors how job queues work in production: you enqueue and move on, you don't wait.

- `/status` - a polling endpoint. Returns the full job list and metrics snapshot. The UI hits this every second to update the live board. In a real system this would be a WebSocket or SSE stream, but polling is simpler and sufficient here.

- `/drain` - triggers graceful shutdown. Cancels pending jobs, waits for in-flight to finish.

### Singleton pattern

Next.js API routes are stateless by default (each request is a fresh function call). To keep the queue alive between `/fire` and `/status` calls, the queue instance is attached to the Node.js `global` object. This is the standard pattern for in-memory state in Next.js dev environments.

## File: `app/modules/02-retry-queue/page.tsx`

- **Config panel with sliders** - every parameter from RetryQueueConfig is exposed. Changing fail rate, concurrency, or backoff strategy and watching how it affects the job board makes the algorithm tangible.

- **Fire and forget on the client** - handleFire posts to /fire then immediately starts polling /status every 800ms. The UI doesn't wait for jobs to finish before rendering - it reacts to state as it changes.

- **Polling with setInterval** - stored in a ref so it survives re-renders without resetting. Stops automatically when all jobs reach a terminal state (done or dead). Cleaned up on unmount via the useEffect return.

- **Job board** - each job row shows its ID, current status with color coding, attempt count, and last error. Color coding makes the queue state readable at a glance - the same reason Datadog and AWS console use color for job states.

- **Metrics grid** - computed fresh from the server on every poll. Shows success rate, avg attempts, and dead count - the three numbers that matter most when debugging a retry system.

- **Drain button** - only appears while running. Triggers graceful shutdown so the demo of drain() from the core logic is actually reachable from the UI.

## The Key Insight

A queue isn't just a data structure from a CS textbook. It's the architectural pattern behind every resilient system.

The queue **decouples** the producer (the thing that fires jobs) from the consumer (the thing that processes them). That separation is what lets you add retries, concurrency limits, backoff, and dead-letter handling - without any of that complexity leaking into the code that originally triggered the work.

This is why AWS SQS exists. This is why Stripe retries webhooks for 72 hours. This is why every job processing system (Sidekiq, BullMQ, Celery) is built on this exact pattern.

---
