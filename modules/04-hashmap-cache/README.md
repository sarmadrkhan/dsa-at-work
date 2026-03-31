# Module 04 - Hashmap Everywhere

**Pattern:** Hashmaps / LRU Cache  
**Real-world system:** In-memory LRU Cache with TTL  
**Seen at:** Redis · CDN Edge Caching · Browser HTTP Cache · Memoization Layers

---

## The Big Picture

Every system that calls something slow - a database, an external API, a heavy computation - eventually puts a cache in front of it. The cache trades memory for speed: store the result the first time, return it instantly every time after.

But a cache that grows forever isn't a cache - it's a memory leak. Something has to decide what to keep and what to throw away. LRU (Least Recently Used) is the most widely used eviction strategy: when the cache is full, discard the entry that hasn't been touched the longest. The assumption is that if something hasn't been used recently, it probably won't be needed soon.

This is the algorithm inside Redis, the browser's HTTP cache, CPU L1/L2 caches, and every CDN edge node.

---

## File: `core/lruCache.ts`

### Types & Interfaces

```ts
interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number | null;
  hitCount: number;
}
```

The shape of a single cached item. `expiresAt` is a Unix timestamp - if the current time has passed it, the entry is treated as if it doesn't exist. `hitCount` tracks how many times an entry has been served, which feeds the UI's hotness indicator.

---

```ts
interface LRUCacheConfig {
  maxSize: number;
  ttlMs: number | null;
}
```

Two knobs: how many entries the cache holds, and how long each entry lives. `ttlMs: null` means entries never expire on their own - only evicted when the cache is full.

---

```ts
interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  hitRate: number;
  currentSize: number;
  maxSize: number;
}
```

The numbers that matter when operating a cache in production. Hit rate is the headline metric - a well-tuned cache should sit above 90%. Evictions going up means the cache is too small for the working set. Expirations going up means TTL might be too short.

---

### `Map` as the Core Data Structure

```ts
private cache: Map<string, CacheEntry<T>> = new Map();
```

JavaScript's `Map` preserves insertion order. That single property is what makes it perfect for LRU - no linked list, no separate ordering structure needed. The head of the Map is always the least recently used entry, the tail is always the most recently used. All operations cost `O(1)`.

---

### `get` - The LRU Mechanism

```ts
// Cache hit - move to end (most recently used position)
this.cache.delete(key);
entry.lastAccessedAt = Date.now();
this.cache.set(key, entry);
```

On every cache hit, the entry is deleted and re-inserted. That single delete-reinsert is the entire LRU algorithm - it moves the entry to the tail of the Map, marking it as the most recently used. Everything that wasn't touched stays closer to the head, closer to eviction.

TTL is also checked here at read time - if the entry has expired, it's deleted and counted as a miss. This is exactly how Redis handles TTL: expiry is enforced lazily at access time, not eagerly in the background.

---

### `set` - Eviction

```ts
// If at capacity, evict the least recently used entry (head of Map)
const lruKey = this.cache.keys().next().value;
if (lruKey !== undefined) {
  this.cache.delete(lruKey);
  this.evictions++;
}
```

`this.cache.keys().next().value` gets the first key in the Map - the head - which is always the least recently used entry. Deleting it makes room for the new entry. The entire eviction decision is one line. This is why LRU with a Map is preferred over more complex implementations - the ordering is maintained automatically by Map's insertion-order guarantee.

---

### `purgeExpired`

A sweep that removes all entries past their TTL. In production Redis runs this as a background job every 100ms, sampling random keys and deleting expired ones. Here it's called from the API on demand so the UI reflects accurate cache state without running a background interval on the server.

---

### `getSnapshot`

```ts
const entries = Array.from(this.cache.values()).reverse();
```

Returns entries in MRU order - most recently used first. The top entry in the UI is the hottest item in the cache, the bottom entry is next in line for eviction if a new item arrives and the cache is full.

---

## File: `api/routes`

- `/set` - writes a key/value pair. Returns the full snapshot immediately after the write so the UI reflects any eviction that just happened.

- `/get` - lookup by key, returns hit/miss result plus updated metrics. Every read updates the LRU order on the server so the snapshot always reflects the true cache state.

- `/delete` - manual cache invalidation. This is the operation that runs in production when a record is updated - the cached version is explicitly removed so the next read fetches fresh data.

- `/snapshot` - calls purgeExpired() before returning so expired entries are swept out before the UI renders them. Polled by the UI on an interval to keep the cache board live.

- `/reset` - wipes the cache and resets all metrics.

- `/configure` - live reconfiguration without a reset. Reducing maxSize below the current fill won't immediately evict - eviction happens on the next set call. This matches how Redis handles maxmemory config changes.

---

## File: `app/modules/04-hashmap-cache/page.tsx`

- **Cache board in MRU order** - entry 1 is the most recently used, the bottom entry is next in line for eviction. The bottom entry has a dashed border and a "next eviction" label - making the LRU decision visible before it happens.

- **Eviction indicator** - when a `Set` causes an eviction, the evicted key is briefly shown in a red banner at the bottom of the board. The LRU decision is usually invisible in production; surfacing it here makes the algorithm tangible.

- **TTL countdown** - each entry shows remaining TTL in seconds, updating live via polling. Entries turn yellow below 3 seconds, making imminent expiry obvious. Expired entries disappear on the next poll cycle when `purgeExpired` runs.

- **Preset keys** - clicking a preset key fires a `Get` request. Since the cache starts empty, all presets are misses initially. Setting some keys and then getting them shows the hit/miss cycle clearly.

- **Hit rate highlight** - urns red when below 50% (with at least one request made). A cache with a sub-50% hit rate is worse than no cache at all - it adds latency without saving reads.

- **Live polling** - snapshot is fetched every second so TTL countdowns stay accurate and any server-side changes are reflected immediately.

- **Config controls** - max size and TTL can be adjusted live. Shrinking max size below the current fill triggers immediate eviction of the least recently used entries.

---

## The Key Insight

LRU isn't just a cache eviction policy. It's an assumption about access patterns: recent usage predicts future usage. That assumption holds surprisingly well across most real workloads - hot keys stay hot, cold keys stay cold.

The hashmap is what makes it fast. Without it, every lookup would require scanning through entries to find the right one. With it, every operation - get, set, delete, evict - is `O(1)` regardless of cache size.

This combination - `O(1)` lookups via hashmap, `O(1)` ordering via insertion-ordered Map - is why LRU is the default eviction policy in Redis, the browser cache, and most CDN implementations. It's the right trade-off between simplicity, speed, and effectiveness.

---
