export type JobStatus = "pending" | "in-flight" | "retrying" | "done" | "dead";

export type BackoffStrategy = "exponential" | "linear" | "fixed";

export interface Job {
  id: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxRetries: number;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;
  createdAt: number;
  resolvedAt: number | null;
  error: string | null;
  backoffStrategy: BackoffStrategy;
  baseDelayMs: number;
}

export interface RetryQueueConfig {
  maxConcurrency: number; // max jobs in-flight at once
  maxRetries: number; // before moving to dead-letter
  baseDelayMs: number; // base delay for backoff
  backoffStrategy: BackoffStrategy;
  failRate: number; // 0–1, simulated failure probability
}

export interface QueueMetrics {
  total: number;
  pending: number;
  inFlight: number;
  retrying: number;
  done: number;
  dead: number;
  successRate: number; // percentage
  avgAttempts: number;
}

// --- Backoff calculation ---
export function calculateBackoff(
  attempt: number,
  strategy: BackoffStrategy,
  baseDelayMs: number,
): number {
  switch (strategy) {
    case "exponential":
      // Classic exponential backoff with jitter - what AWS, Stripe use
      // delay = base * 2^attempt + small random jitter to avoid thundering herd
      return baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
    case "linear":
      return baseDelayMs * (attempt + 1);
    case "fixed":
      return baseDelayMs;
  }
}

// --- Simulate an HTTP call that can fail ---
async function simulateHttpCall(
  job: Job,
  failRate: number,
): Promise<{ success: boolean; error?: string }> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  if (Math.random() < failRate) {
    const errors = [
      "503 Service Unavailable",
      "429 Too Many Requests",
      "500 Internal Server Error",
      "ECONNRESET",
      "Gateway Timeout",
    ];
    return {
      success: false,
      error: errors[Math.floor(Math.random() * errors.length)],
    };
  }

  return { success: true };
}

// --- The Queue ---
export class RetryQueue {
  private queue: Map<string, Job> = new Map();
  private config: RetryQueueConfig;
  private inFlightCount = 0;
  private draining = false;
  private onUpdate: ((jobs: Job[]) => void) | null = null;

  constructor(config: RetryQueueConfig) {
    this.config = config;
  }

  // Register a callback so the UI can react to state changes
  subscribe(fn: (jobs: Job[]) => void) {
    this.onUpdate = fn;
  }

  private notify() {
    if (this.onUpdate) {
      this.onUpdate(Array.from(this.queue.values()));
    }
  }

  // Enqueue a batch of jobs
  enqueue(payloads: Record<string, unknown>[]): Job[] {
    const jobs: Job[] = payloads.map((payload) => ({
      id: crypto.randomUUID(),
      payload,
      status: "pending",
      attempts: 0,
      maxRetries: this.config.maxRetries,
      lastAttemptAt: null,
      nextRetryAt: null,
      createdAt: Date.now(),
      resolvedAt: null,
      error: null,
      backoffStrategy: this.config.backoffStrategy,
      baseDelayMs: this.config.baseDelayMs,
    }));

    jobs.forEach((job) => this.queue.set(job.id, job));
    this.notify();
    return jobs;
  }

  // Process all pending + retrying jobs
  async process() {
    if (this.draining) return;

    const processJob = async (job: Job) => {
      if (this.inFlightCount >= this.config.maxConcurrency) return;

      // Update status to in-flight
      this.inFlightCount++;
      job.status = "in-flight";
      job.lastAttemptAt = Date.now();
      job.attempts++;
      this.notify();

      const result = await simulateHttpCall(job, this.config.failRate);

      if (result.success) {
        job.status = "done";
        job.resolvedAt = Date.now();
        job.error = null;
      } else {
        job.error = result.error ?? "Unknown error";

        if (job.attempts >= job.maxRetries) {
          // Exhausted retries - move to dead-letter
          job.status = "dead";
          job.resolvedAt = Date.now();
        } else {
          // Schedule retry with backoff
          const delay = calculateBackoff(
            job.attempts,
            job.backoffStrategy,
            job.baseDelayMs,
          );
          job.status = "retrying";
          job.nextRetryAt = Date.now() + delay;

          // Re-attempt after delay
          setTimeout(() => processJob(job), delay);
        }
      }

      this.inFlightCount--;
      this.notify();
    };

    // Kick off all eligible jobs up to concurrency limit
    const eligible = Array.from(this.queue.values()).filter(
      (j) => j.status === "pending",
    );

    await Promise.all(eligible.map((job) => processJob(job)));
  }

  // Graceful shutdown - wait for in-flight to finish, cancel pending
  async drain() {
    this.draining = true;

    // Cancel anything still pending
    this.queue.forEach((job) => {
      if (job.status === "pending" || job.status === "retrying") {
        job.status = "dead";
        job.error = "Drained - queue shut down";
        job.resolvedAt = Date.now();
      }
    });

    // Wait for in-flight jobs to settle
    while (this.inFlightCount > 0) {
      await new Promise((r) => setTimeout(r, 100));
    }

    this.notify();
    this.draining = false;
  }

  // Reset the queue entirely
  reset() {
    this.queue.clear();
    this.inFlightCount = 0;
    this.draining = false;
    this.notify();
  }

  getJobs(): Job[] {
    return Array.from(this.queue.values());
  }

  getMetrics(): QueueMetrics {
    const jobs = this.getJobs();
    const total = jobs.length;
    const done = jobs.filter((j) => j.status === "done").length;
    const dead = jobs.filter((j) => j.status === "dead").length;
    const resolved = done + dead;

    return {
      total,
      pending: jobs.filter((j) => j.status === "pending").length,
      inFlight: jobs.filter((j) => j.status === "in-flight").length,
      retrying: jobs.filter((j) => j.status === "retrying").length,
      done,
      dead,
      successRate: resolved > 0 ? Math.round((done / resolved) * 100) : 0,
      avgAttempts:
        total > 0
          ? Math.round(
              (jobs.reduce((sum, j) => sum + j.attempts, 0) / total) * 10,
            ) / 10
          : 0,
    };
  }
}
