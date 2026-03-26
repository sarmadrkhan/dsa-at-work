import { RetryQueue } from "@/modules/02-retry-queue/core/retryQueue";

// Module-level singleton - persists across requests in the same server process.
// This is the standard pattern for in-memory state in Next.js API routes.
const globalForQueue = global as unknown as { retryQueue: RetryQueue };

if (!globalForQueue.retryQueue) {
  globalForQueue.retryQueue = new RetryQueue({
    maxConcurrency: 3,
    maxRetries: 4,
    baseDelayMs: 500,
    backoffStrategy: "exponential",
    failRate: 0.4,
  });
}

export const retryQueue = globalForQueue.retryQueue;
