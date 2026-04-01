export type RateLimiterStrategy = "sliding-window-log" | "fixed-window";

export interface RateLimiterConfig {
  windowMs: number; // length of the window in ms
  maxRequests: number; // max allowed requests per window
  strategy: RateLimiterStrategy;
}

export interface RequestRecord {
  id: string;
  clientId: string;
  timestamp: number;
  allowed: boolean;
}

export interface ClientState {
  clientId: string;
  requestLog: number[]; // timestamps of requests within current window
  fixedWindowCount: number;
  fixedWindowStart: number;
}

export interface RateLimiterResult {
  allowed: boolean;
  clientId: string;
  remaining: number; // requests remaining in current window
  resetAt: number; // timestamp when window resets
  retryAfter: number | null; // ms to wait before retrying (if blocked)
}

export interface RateLimiterMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  blockRate: number;
  activeClients: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;

  // Per-client state - keyed by clientId
  private clients: Map<string, ClientState> = new Map();

  // Full request history for the UI
  private requestHistory: RequestRecord[] = [];

  private totalRequests = 0;
  private allowedRequests = 0;
  private blockedRequests = 0;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  configure(config: RateLimiterConfig): void {
    this.config = config;
  }

  reset(): void {
    this.clients.clear();
    this.requestHistory = [];
    this.totalRequests = 0;
    this.allowedRequests = 0;
    this.blockedRequests = 0;
  }

  // --- Core: handle an incoming request ---
  handleRequest(clientId: string): RateLimiterResult {
    const now = Date.now();
    const result =
      this.config.strategy === "sliding-window-log"
        ? this.slidingWindowLog(clientId, now)
        : this.fixedWindow(clientId, now);

    // Record in history
    this.requestHistory.push({
      id: crypto.randomUUID(),
      clientId,
      timestamp: now,
      allowed: result.allowed,
    });

    // Trim history to last 200 entries for memory
    if (this.requestHistory.length > 200) {
      this.requestHistory = this.requestHistory.slice(-200);
    }

    this.totalRequests++;
    if (result.allowed) this.allowedRequests++;
    else this.blockedRequests++;

    return result;
  }

  // --- Strategy 1: Sliding Window Log ---
  // Keeps a log of exact request timestamps per client.
  // On each request, timestamps older than windowMs are pruned.
  // If the remaining log length is under maxRequests, allow.
  //
  // This is the most accurate strategy - used by Stripe and GitHub's API.
  // Cost: O(n) per request where n = requests in window. Fine for most APIs.
  private slidingWindowLog(clientId: string, now: number): RateLimiterResult {
    const client = this.getOrCreateClient(clientId);
    const windowStart = now - this.config.windowMs;

    // Prune timestamps outside the current window
    client.requestLog = client.requestLog.filter((t) => t > windowStart);

    const allowed = client.requestLog.length < this.config.maxRequests;

    if (allowed) {
      client.requestLog.push(now);
    }

    const remaining = Math.max(
      0,
      this.config.maxRequests - client.requestLog.length,
    );

    const oldestInWindow = client.requestLog[0] ?? now;
    const resetAt = oldestInWindow + this.config.windowMs;
    const retryAfter = allowed ? null : resetAt - now;

    return { allowed, clientId, remaining, resetAt, retryAfter };
  }

  // --- Strategy 2: Fixed Window ---
  // Divides time into fixed buckets (e.g. each minute).
  // Counts requests per bucket, resets at the bucket boundary.
  //
  // Simpler and cheaper than sliding window, but has an edge case:
  // a client can fire maxRequests at the end of one window and
  // maxRequests at the start of the next - 2x the intended limit
  // in a short burst. This is the "boundary burst" problem.
  private fixedWindow(clientId: string, now: number): RateLimiterResult {
    const client = this.getOrCreateClient(clientId);
    const windowStart =
      Math.floor(now / this.config.windowMs) * this.config.windowMs;

    // Reset if in a new window
    if (windowStart > client.fixedWindowStart) {
      client.fixedWindowCount = 0;
      client.fixedWindowStart = windowStart;
    }

    const allowed = client.fixedWindowCount < this.config.maxRequests;

    if (allowed) {
      client.fixedWindowCount++;
    }

    const remaining = Math.max(
      0,
      this.config.maxRequests - client.fixedWindowCount,
    );

    const resetAt = windowStart + this.config.windowMs;
    const retryAfter = allowed ? null : resetAt - now;

    return { allowed, clientId, remaining, resetAt, retryAfter };
  }

  private getOrCreateClient(clientId: string): ClientState {
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, {
        clientId,
        requestLog: [],
        fixedWindowCount: 0,
        fixedWindowStart: 0,
      });
    }
    return this.clients.get(clientId)!;
  }

  getMetrics(): RateLimiterMetrics {
    return {
      totalRequests: this.totalRequests,
      allowedRequests: this.allowedRequests,
      blockedRequests: this.blockedRequests,
      blockRate:
        this.totalRequests > 0
          ? Math.round((this.blockedRequests / this.totalRequests) * 100)
          : 0,
      activeClients: this.clients.size,
    };
  }

  getHistory(): RequestRecord[] {
    return [...this.requestHistory].reverse();
  }

  getClientState(clientId: string): ClientState | null {
    return this.clients.get(clientId) ?? null;
  }
}
