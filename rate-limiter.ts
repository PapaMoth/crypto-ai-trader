/**
 * Rate Limiter - Supports both in-memory and Redis backends
 * Usage: per-IP, per-user, per-endpoint combinations
 */

export interface RateLimitConfig {
  maxRequests: number;       // Max requests allowed
  windowMs: number;          // Time window in milliseconds
  keyGenerator?: (req: Request) => string; // Custom key generator
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * In-Memory Rate Limiter (for development/single server)
 */
export class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(private config: RateLimitConfig) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    // Initialize or reset if window expired
    if (!entry || now > entry.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    // Increment counter
    entry.count++;

    if (entry.count > this.config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  // Cleanup old entries (call periodically to prevent memory leaks)
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis Rate Limiter (for production/distributed systems)
 * Requires redis package: npm install redis
 */
export class RedisRateLimiter {
  private redisClient: any;

  constructor(
    private config: RateLimitConfig,
    redisClient: any
  ) {
    this.redisClient = redisClient;
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const resetTime = now + this.config.windowMs;

    try {
      // Use Redis INCR with expiration
      const count = await this.redisClient.incr(key);

      // Set expiration on first request
      if (count === 1) {
        await this.redisClient.expire(key, Math.ceil(this.config.windowMs / 1000));
      }

      if (count > this.config.maxRequests) {
        const ttl = await this.redisClient.ttl(key);
        const retryAfter = ttl > 0 ? ttl : 1;

        return {
          allowed: false,
          remaining: 0,
          resetTime: now + ttl * 1000,
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining: this.config.maxRequests - count,
        resetTime,
      };
    } catch (err) {
      console.error("[RATE_LIMIT] Redis error:", err);
      // Fail open (allow request) if Redis is down
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime,
      };
    }
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Default key generators for different strategies
 */
export const KeyGenerators = {
  // Per-IP address
  byIP: (req: Request) => `rate-limit:ip:${getClientIP(req)}`,

  // Per authenticated user (requires user ID in custom header or JWT)
  byUser: (req: Request, userId?: string) =>
    userId ? `rate-limit:user:${userId}` : `rate-limit:ip:${getClientIP(req)}`,

  // Per endpoint + IP
  byEndpoint: (req: Request, endpoint: string) =>
    `rate-limit:${endpoint}:${getClientIP(req)}`,

  // Per endpoint + user
  byEndpointAndUser: (req: Request, endpoint: string, userId?: string) =>
    userId
      ? `rate-limit:${endpoint}:user:${userId}`
      : `rate-limit:${endpoint}:${getClientIP(req)}`,
};
