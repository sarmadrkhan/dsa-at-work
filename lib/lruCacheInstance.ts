import { LRUCache } from "@/modules/04-hashmap-cache/core/lruCache";

const globalForCache = global as unknown as { lruCache: LRUCache<string> };

if (!globalForCache.lruCache) {
  globalForCache.lruCache = new LRUCache<string>({
    maxSize: 5,
    ttlMs: 10000, // 10 seconds default
  });
}

export const lruCache = globalForCache.lruCache;
