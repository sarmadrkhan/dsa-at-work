# Module 05 - Sliding Window

**Pattern:** Sliding Window  
**Real-world system:** API Rate Limiter  
**Seen at:** GitHub API · Stripe · AWS API Gateway · Every public API

---

## The Big Picture

Every public API has a rate limiter in front of it. Without one, a single misbehaving client - a runaway script, a misconfigured integration, a bad actor - can consume enough server resources to degrade service for everyone else.

A rate limiter answers one question on every incoming request: has this client made too many requests in the recent past? If yes, reject with a 429. If no, allow through and record the request.

The sliding window is the most accurate way to answer that question. Rather than resetting a counter at a fixed clock boundary, it looks at a rolling window of time - the last N seconds from right now. This eliminates the boundary burst problem that simpler fixed-window approaches have, which is why Stripe, GitHub, and AWS all use it for their API rate limiting.

---

## File: `core/rateLimiter.ts`

### Types & Interfaces

```ts
type RateLimiterStrategy = "sliding-window-log" | "fixed-window";
```

Two strategies are implemented. Same interface, different behavior under load - particularly at window boundaries.

---

```ts
interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  strategy: RateLimiterStrategy;
}
```

The two numbers that define a rate limit. `windowMs` is the rolling window size - 60000 for "per minute", 3600000 for "per hour". `maxRequests` is the ceiling within that window.

---

```ts
interface RateLimiterResult {
  allowed: boolean;
  clientId: string;
  remaining: number;
  resetAt: number;
  retryAfter: number | null;
}
```

The response shape on every request decision. `remaining` maps to the `X-RateLimit-Remaining` HTTP header. `retryAfter` maps to the `Retry-After` header - the number of ms a blocked client should wait before retrying. Stripe, GitHub, and AWS all return these headers on 429 responses.

---

```ts
interface ClientState {
  clientId: string;
  requestLog: number[];
  fixedWindowCount: number;
  fixedWindowStart: number;
}
```

Per-client state stored in a Map. `requestLog` is used by the sliding window strategy - a list of exact request timestamps within the current window. `fixedWindowCount` and `fixedWindowStart` are used by the fixed window strategy. In production this state would live in Redis so it's shared across multiple server instances.

---

### Strategy 1: Sliding Window Log

```ts
// Prune timestamps outside the current window
client.requestLog = client.requestLog.filter((t) => t > windowStart);

const allowed = client.requestLog.length < this.config.maxRequests;
```

On every request, timestamps older than `windowMs` are pruned from the log. The remaining log length is the number of requests made in the last `windowMs` milliseconds - the sliding window. If that count is under `maxRequests`, the request is allowed and the current timestamp is appended.

This is the most accurate strategy. The window moves with every request - there are no hard boundaries for clients to exploit. Used by Stripe and GitHub's API rate limiter. The trade-off is memory: the log grows proportionally to requests per window per client.

---

### Strategy 2: Fixed Window

```ts
const windowStart =
  Math.floor(now / this.config.windowMs) * this.config.windowMs;

if (windowStart > client.fixedWindowStart) {
  client.fixedWindowCount = 0;
  client.fixedWindowStart = windowStart;
}
```

Time is divided into fixed buckets aligned to clock boundaries. The counter resets when a new bucket starts. Simpler and cheaper than the sliding window - just a counter and a timestamp per client.

The known weakness is the **boundary burst problem**: a client can make `maxRequests` at the end of window 1 and `maxRequests` at the start of window 2 - effectively `2x` the intended limit within a short burst. The UI makes this exploitable and visible by letting both strategies be compared side by side.

---

### `retryAfter`

```ts
const retryAfter = allowed ? null : resetAt - now;
```

The number of ms until the client's window resets. Returned as `null` on allowed requests, populated on blocked ones. This is what gets sent back in the `Retry-After` HTTP response header - the standard way APIs tell clients when to try again instead of hammering the server repeatedly.

---

### Per-client isolation

```ts
private clients: Map<string, ClientState> = new Map();
```

Each client ID gets completely isolated state. One client hitting the limit has no effect on others. The Map is keyed by client ID - in a real system this would be an IP address, an API key, or a user ID.

---

## File: `api/routes`

- `/request` - single request handler. Accepts a `clientId`, runs it through the rate limiter, returns the full decision including `allowed`, `remaining`, and `retryAfter`. This maps directly to what happens in a real API gateway on every incoming HTTP request - the rate limiter is consulted before the request reaches application code.

- `/burst` - fires N requests for a client in a tight loop. This is the key demo endpoint - it shows the exact moment a client crosses the limit, with some results `allowed` and the rest `blocked`. The burst pattern is how most rate limit violations happen in production - a misconfigured client retrying aggressively.

- `/status` - returns metrics and full request history. Polled by the UI to keep the feed live. History is kept to the last 200 entries on the server to bound memory usage.

- `/reset` - clears all state. Useful between strategy comparisons so results aren't mixed.

- `/configure` - live strategy and limit changes. Switching from sliding window to fixed window mid-session lets the boundary burst behavior be demonstrated without restarting the server.

---

## File: `app/modules/05-sliding-window/page.tsx`

- **Three isolated clients** - each client has completely independent state. Bursting client-A to its limit has no effect on client-B or client-C. This mirrors how production rate limiters work - limits are enforced per API key or per IP, not globally.

- **Single request vs burst** - fsingle request shows the per-request decision clearly with remaining count and retryAfter. Burst × 10 shows the exact cutoff - the first N requests are green, the rest flip to red 429s. This is the pattern seen in production logs when a client hits its limit.

- **Request history feed** - every request logged with HTTP status code (200 or 429), client ID, and timestamp. The feed makes the rate limiting decision visible as a stream - the same way API gateway logs look in CloudWatch or Datadog.

- **Strategy toggle** - sswitching between sliding window log and fixed window is live. Reset first, then burst near a window boundary with fixed window to see the 2x burst behavior that sliding window prevents.

- **Block rate metric** - highlights red above 50%. A legitimately configured rate limiter should have a low block rate under normal traffic. A high block rate means either the limit is too tight or a client is misbehaving.

---

## The Key Insight

A rate limiter is a sliding window problem in production clothing. The window moves forward in time, old data falls off the back, new data is added to the front. The question being asked - "how many events happened in the last N seconds?" - is the same question asked in monitoring dashboards, error rate alerts, and rolling average calculations.

The sliding window shows up wherever a system needs to reason about recent history without keeping all history. The log shrinks as time passes, old entries become irrelevant, and the decision is always based on the freshest slice of data. That property - recency-aware, bounded memory, rolling in time - is what makes it the right tool for rate limiting, error rate monitoring, fraud detection, and anywhere else that recent behavior matters more than total behavior.

---

## References

- [Stripe - Rate Limiting](https://stripe.com/docs/rate-limits)
- [GitHub - Rate Limiting](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [AWS API Gateway - Throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
- [Cloudflare - Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
