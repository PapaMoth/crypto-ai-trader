/**
 * Redis Setup Example for Production Rate Limiting
 * Install: npm install redis
 */

import { createClient } from "redis";
import {
  RedisRateLimiter,
  KeyGenerators,
} from "./rate-limiter";

// Initialize Redis client
export async function initializeRedisRateLimiter() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  const redisClient = createClient({
    url: redisUrl,
    // Optional: Add retry strategy
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          console.error("[REDIS] Max retries exceeded");
          return new Error("Max Redis retries exceeded");
        }
        return retries * 50;
      },
    },
  });

  // Handle connection events
  redisClient.on("error", (err) => {
    console.error("[REDIS] Error:", err);
  });

  redisClient.on("connect", () => {
    console.log("[REDIS] Connected");
  });

  redisClient.on("ready", () => {
    console.log("[REDIS] Ready");
  });

  // Connect to Redis
  await redisClient.connect();

  return redisClient;
}

// ============= DIFFERENT RATE LIMITING STRATEGIES =============

/**
 * Strategy 1: Global per-IP rate limiting
 * Limits each IP to 10 requests per minute
 */
export function createGlobalIPRateLimiter(redisClient: any) {
  return new RedisRateLimiter(
    { maxRequests: 10, windowMs: 60 * 1000 },
    redisClient
  );
}

/**
 * Strategy 2: Per-endpoint per-IP rate limiting
 * Different limits for different endpoints
 */
export function createPerEndpointRateLimiter(
  redisClient: any,
  endpoint: string,
  maxRequests: number,
  windowMs: number
) {
  return new RedisRateLimiter(
    { maxRequests, windowMs },
    redisClient
  );
}

/**
 * Strategy 3: Tiered rate limiting based on user tier
 */
export async function checkTieredRateLimit(
  redisClient: any,
  userId: string,
  userTier: "free" | "premium" | "pro"
): Promise<boolean> {
  const limits = {
    free: { maxRequests: 5, windowMs: 60 * 1000 },      // 5 per min
    premium: { maxRequests: 50, windowMs: 60 * 1000 },  // 50 per min
    pro: { maxRequests: 500, windowMs: 60 * 1000 },     // 500 per min
  };

  const config = limits[userTier];
  const limiter = new RedisRateLimiter(config, redisClient);
  const key = `rate-limit:user:${userId}`;

  const result = await limiter.check(key);
  return result.allowed;
}

/**
 * Strategy 4: Combined IP + User ID rate limiting
 * Apply both limits to prevent abuse
 */
export async function checkCombinedRateLimit(
  redisClient: any,
  req: Request,
  userId?: string
): Promise<{ allowed: boolean; reasons?: string[] }> {
  const reasons: string[] = [];

  // Check IP-based limit
  const ipLimiter = new RedisRateLimiter(
    { maxRequests: 100, windowMs: 60 * 1000 },
    redisClient
  );
  const ipKey = KeyGenerators.byIP(req);
  const ipResult = await ipLimiter.check(ipKey);

  if (!ipResult.allowed) {
    reasons.push("IP rate limit exceeded");
  }

  // Check user-based limit if authenticated
  if (userId) {
    const userLimiter = new RedisRateLimiter(
      { maxRequests: 50, windowMs: 60 * 1000 },
      redisClient
    );
    const userKey = KeyGenerators.byUser(req, userId);
    const userResult = await userLimiter.check(userKey);

    if (!userResult.allowed) {
      reasons.push("User rate limit exceeded");
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons: reasons.length > 0 ? reasons : undefined,
  };
}

// ============= MONITORING & METRICS =============

/**
 * Get rate limit stats for monitoring/dashboards
 */
export async function getRateLimitStats(
  redisClient: any,
  pattern: string = "rate-limit:*"
): Promise<{
  totalKeys: number;
  keys: Array<{ key: string; value: number }>;
}> {
  try {
    const keys = await redisClient.keys(pattern);
    const stats = [];

    for (const key of keys) {
      const value = await redisClient.get(key);
      stats.push({
        key,
        value: parseInt(value) || 0,
      });
    }

    return {
      totalKeys: keys.length,
      keys: stats,
    };
  } catch (err) {
    console.error("[REDIS] Error getting stats:", err);
    return { totalKeys: 0, keys: [] };
  }
}

/**
 * Reset rate limit for a specific key (admin function)
 */
export async function resetRateLimit(
  redisClient: any,
  key: string
): Promise<boolean> {
  try {
    await redisClient.del(key);
    console.log(`[RATE_LIMIT] Reset key: ${key}`);
    return true;
  } catch (err) {
    console.error("[RATE_LIMIT] Error resetting:", err);
    return false;
  }
}

/**
 * Reset all rate limits (use with caution!)
 */
export async function resetAllRateLimits(
  redisClient: any
): Promise<number> {
  try {
    const keys = await redisClient.keys("rate-limit:*");
    if (keys.length === 0) return 0;

    await redisClient.del(keys);
    console.log(`[RATE_LIMIT] Reset ${keys.length} keys`);
    return keys.length;
  } catch (err) {
    console.error("[RATE_LIMIT] Error resetting all:", err);
    return 0;
  }
}
