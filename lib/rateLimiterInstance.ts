import { RateLimiter } from "@/modules/05-sliding-window/core/rateLimiter";

const globalForLimiter = global as unknown as { rateLimiter: RateLimiter };

if (!globalForLimiter.rateLimiter) {
  globalForLimiter.rateLimiter = new RateLimiter({
    windowMs: 10000,
    maxRequests: 5,
    strategy: "sliding-window-log",
  });
}

export const rateLimiter = globalForLimiter.rateLimiter;
