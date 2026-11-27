/**
 * Folio Assistant — Generic TTL cache.
 *
 * @module folio-assistant/core/cache
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, ts: Date.now() });
  }

  /** Invalidate entries matching a prefix, or all entries if no prefix. */
  invalidate(prefix?: string): void {
    if (prefix) {
      for (const k of [...this.store.keys()]) {
        if (k.startsWith(prefix)) this.store.delete(k);
      }
    } else {
      this.store.clear();
    }
  }
}
