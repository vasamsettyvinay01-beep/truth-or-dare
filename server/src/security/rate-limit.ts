/**
 * Lightweight in-memory rate limiter for Socket.IO and HTTP.
 * Not distributed — sufficient for a single Railway/Render instance.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
    private readonly maxKeys = 20_000
  ) {}

  /** Returns true if the action is allowed. */
  take(key: string, cost = 1): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.evict();
      bucket = { tokens: this.capacity, updatedAt: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = now - bucket.updatedAt;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
    bucket.updatedAt = now;
    if (bucket.tokens < cost) return false;
    bucket.tokens -= cost;
    return true;
  }

  private evict() {
    // Drop the oldest ~10% of keys.
    const drop = Math.max(1, Math.floor(this.buckets.size * 0.1));
    let i = 0;
    for (const key of this.buckets.keys()) {
      this.buckets.delete(key);
      if (++i >= drop) break;
    }
  }
}

/** Connection / join spam. */
export const connectLimiter = new RateLimiter(30, 30 / 60_000);
/** Chat + reactions. */
export const chatLimiter = new RateLimiter(20, 20 / 10_000);
/** Room create. */
export const createLimiter = new RateLimiter(5, 5 / 60_000);
/** Generic socket events. */
export const eventLimiter = new RateLimiter(60, 60 / 10_000);
/** HTTP API. */
export const httpLimiter = new RateLimiter(60, 60 / 60_000);
