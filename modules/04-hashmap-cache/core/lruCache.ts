export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number | null; // null = no TTL
  hitCount: number;
}

export interface LRUCacheConfig {
  maxSize: number; // max number of entries
  ttlMs: number | null; // time-to-live per entry in ms, null = no expiry
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  hitRate: number; // percentage
  currentSize: number;
  maxSize: number;
}

export interface CacheSnapshot<T> {
  entries: CacheEntry<T>[];
  metrics: CacheMetrics;
}

export class LRUCache<T> {
  // The core data structure - a Map preserves insertion order in JS,
  // which is what makes it ideal for LRU: most recently used entries
  // are moved to the end, least recently used stay at the front.
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: LRUCacheConfig;

  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(config: LRUCacheConfig) {
    this.config = config;
  }

  // --- Get ---
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL expiry
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.expirations++;
      this.misses++;
      return null;
    }

    // Cache hit - move to end (most recently used position)
    // This is the LRU mechanism: delete and re-insert to move to tail
    this.cache.delete(key);
    entry.lastAccessedAt = Date.now();
    entry.hitCount++;
    this.cache.set(key, entry);

    this.hits++;
    return entry.value;
  }

  // --- Set ---
  set(key: string, value: T): void {
    // If key exists, remove it first - will be re-inserted at tail
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // If at capacity, evict the least recently used entry (head of Map)
    if (this.cache.size >= this.config.maxSize) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
        this.evictions++;
      }
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: this.config.ttlMs ? now + this.config.ttlMs : null,
      hitCount: 0,
    };

    this.cache.set(key, entry);
  }

  // --- Delete ---
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // --- Reset ---
  reset(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }

  // --- Reconfigure ---
  configure(config: LRUCacheConfig): void {
    this.config = config;
  }

  // --- Purge expired entries ---
  // In production this would run on a background interval
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.cache.delete(key);
        this.expirations++;
        purged++;
      }
    }

    return purged;
  }

  getMetrics(): CacheMetrics {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
      currentSize: this.cache.size,
      maxSize: this.config.maxSize,
    };
  }

  getSnapshot(): CacheSnapshot<T> {
    // Return entries in MRU order (most recently used first) for the UI
    const entries = Array.from(this.cache.values()).reverse();
    return {
      entries,
      metrics: this.getMetrics(),
    };
  }
}
