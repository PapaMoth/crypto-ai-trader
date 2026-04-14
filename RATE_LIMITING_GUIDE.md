# Rate Limiting Implementation Guide

This guide covers the rate limiting system for the Binance trading endpoint.

## Overview

The rate limiting system provides:
- **In-memory rate limiter** for development/single-server deployments
- **Redis rate limiter** for production/distributed systems
- **Multiple strategies**: per-IP, per-user, per-endpoint, tiered limits
- **Standard rate limit headers** (429 responses, Retry-After, etc.)

## Quick Start

### 1. Development (In-Memory)

No setup needed! The endpoint automatically uses in-memory rate limiting:

```bash
# Install dependencies
npm install binance-api-node

# Set environment variables
export BINANCE_API_KEY=your_key
export BINANCE_SECRET_KEY=your_secret
export INTERNAL_API_KEY=your_internal_key

# Run your Next.js app
npm run dev
```

The in-memory limiter defaults to **10 requests per 60 seconds per IP**.

### 2. Production (Redis)

#### Option A: Docker

```bash
# Start Redis
docker run -d -p 6379:6379 redis:latest

# Or with persistence
docker run -d -p 6379:6379 -v redis-data:/data redis:latest redis-server --appendonly yes
```

#### Option B: AWS ElastiCache

```bash
# Create ElastiCache cluster in AWS Console
# Get endpoint: your-cluster.abc123.ng.0001.use1.cache.amazonaws.com:6379

# Set env variable
export REDIS_URL=rediss://your-cluster.abc123.ng.0001.use1.cache.amazonaws.com:6379
```

#### Option C: Heroku Redis

```bash
# Add Redis addon
heroku addons:create heroku-redis:premium-0

# Automatically sets REDIS_URL env variable
```

#### Install Redis Client

```bash
npm install redis
```

#### Update Your Endpoint

```typescript
import { initializeRedisRateLimiter } from "./redis-setup";

// In your app initialization:
const redisClient = await initializeRedisRateLimiter();
// Pass redisClient to RedisRateLimiter
```

## Configuration

### Default Limits

```typescript
const TradeRateLimitConfig = {
  maxRequests: 10,        // 10 requests
  windowMs: 60 * 1000,    // per 60 seconds
};
```

### Customizing Limits

Edit `trade-with-rate-limit.ts`:

```typescript
const TradeRateLimitConfig = {
  maxRequests: 50,        // Increase to 50 requests
  windowMs: 60 * 1000,    // per minute
};

// For strict users
const StrictRateLimitConfig = {
  maxRequests: 5,         // 5 requests
  windowMs: 60 * 1000,    // per minute
};
```

## Rate Limiting Strategies

### Strategy 1: Per-IP (Default)

Every IP address gets its own limit:

```typescript
const rateLimitKey = KeyGenerators.byIP(req);
// Results in: "rate-limit:ip:192.168.1.1"
```

**Use case**: Public APIs, web applications

### Strategy 2: Per-User

Different limits for different users:

```typescript
const rateLimitKey = KeyGenerators.byUser(req, userId);
// Results in: "rate-limit:user:user123"
```

**Use case**: Authenticated APIs, SaaS platforms

### Strategy 3: Per-Endpoint

Different limits for different endpoints:

```typescript
const rateLimitKey = KeyGenerators.byEndpoint(req, "/api/trade");
// Results in: "rate-limit:/api/trade:192.168.1.1"
```

**Use case**: Multiple endpoints with different load requirements

### Strategy 4: Tiered Rate Limiting

Different limits based on user tier (free/premium/pro):

```typescript
const allowed = await checkTieredRateLimit(
  redisClient,
  userId,
  userTier  // "free" | "premium" | "pro"
);

// Limits:
// free:    5 requests per minute
// premium: 50 requests per minute
// pro:     500 requests per minute
```

**Use case**: SaaS with subscription tiers

### Strategy 5: Combined Limits

Apply multiple limits simultaneously:

```typescript
const result = await checkCombinedRateLimit(
  redisClient,
  req,
  userId
);

if (!result.allowed) {
  // Check result.reasons for which limit was exceeded:
  // ["IP rate limit exceeded"] or ["User rate limit exceeded"]
}
```

**Use case**: Premium security, prevent abuse from compromised accounts

## Understanding Responses

### Success Response (200)

```json
{
  "success": true,
  "orderId": "12345678"
}
```

**Headers:**
```
RateLimit-Limit: 10
RateLimit-Remaining: 3
RateLimit-Reset: 2026-04-14T10:15:30.000Z
```

### Rate Limited Response (429)

```json
{
  "error": "Too many requests",
  "retryAfter": 45,
  "resetTime": "2026-04-14T10:15:30.000Z"
}
```

**Headers:**
```
Retry-After: 45
RateLimit-Limit: 10
RateLimit-Remaining: 0
RateLimit-Reset: 2026-04-14T10:15:30.000Z
```

## Client Implementation

### JavaScript/Fetch

```javascript
async function placeOrder(symbol, side, quantity) {
  const response = await fetch("/api/trade", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbol, side, quantity }),
  });

  if (response.status === 429) {
    const data = await response.json();
    const retryAfter = response.headers.get("Retry-After");
    console.log(`Rate limited. Retry after ${retryAfter}s`);
    
    // Wait and retry
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return placeOrder(symbol, side, quantity); // Retry
  }

  return response.json();
}
```

### Exponential Backoff

```javascript
async function placeOrderWithRetry(symbol, side, quantity, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch("/api/trade", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbol, side, quantity }),
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After")) || 60;
      const delay = retryAfter * (Math.pow(2, i) + Math.random());
      console.log(`Rate limited. Waiting ${delay}ms before retry ${i + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  throw new Error("Max retries exceeded");
}
```

## Monitoring

### Get Rate Limit Stats

```typescript
import { getRateLimitStats } from "./redis-setup";

// Get all rate limit keys and their values
const stats = await getRateLimitStats(redisClient);
console.log(`Total tracked IPs/users: ${stats.totalKeys}`);
console.log(stats.keys); // [{key: "rate-limit:ip:1.2.3.4", value: 8}, ...]
```

### Reset Rate Limits

```typescript
import { resetRateLimit, resetAllRateLimits } from "./redis-setup";

// Reset for specific user
await resetRateLimit(redisClient, "rate-limit:user:user123");

// Reset all (use with caution!)
const count = await resetAllRateLimits(redisClient);
console.log(`Reset ${count} rate limit entries`);
```

## Advanced Topics

### Distributed Rate Limiting

For multiple servers, Redis ensures consistent limits across all instances:

```
Server 1 ──┐
           ├─→ Redis (single source of truth)
Server 2 ──┤
           │
Server 3 ──┘
```

Each server queries Redis for current request count.

### Sliding Window vs Fixed Window

This implementation uses **sliding window** (more accurate):

```
Fixed Window (less accurate):
|--min 1--|--min 2--|--min 3--|
[req1, req2, req3] [req4] [req5, req6]
Spike at boundary!

Sliding Window (this implementation):
[req1][req2][req3] <- counted
         [req4] <- counted
              [req5] [req6] <- not counted yet (within window)
No spike at boundaries
```

### Connection Pooling (Redis)

For high traffic, consider connection pooling:

```typescript
import * as redis from "redis";

const redisPool = redis.createPool({
  host: "localhost",
  port: 6379,
  max: 100,  // Max connections
});
```

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping
# Expected: PONG

# Check Redis info
redis-cli info stats

# Check keys
redis-cli keys "rate-limit:*"
```

### High Memory Usage

The in-memory limiter keeps old entries. Clean up periodically:

```typescript
// Called automatically every 5 minutes in the code
if (rateLimiter instanceof InMemoryRateLimiter) {
  rateLimiter.cleanup();
}

// Or manually
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
```

### Testing Rate Limits

```bash
# Test with curl
for i in {1..15}; do
  curl -H "Authorization: Bearer YOUR_KEY" \
       -H "Content-Type: application/json" \
       -d '{"symbol":"ETHUSDT","side":"BUY","quantity":0.01}' \
       http://localhost:3000/api/trade
  echo "Request $i"
done

# Should see 10 succeed, 5 get 429
```

## Best Practices

1. **Always respect Retry-After header** - Don't retry before the specified time
2. **Implement exponential backoff** - Increases delay between retries
3. **Monitor rate limit metrics** - Track which users/IPs are hitting limits
4. **Set reasonable limits** - Balance between protection and usability
5. **Document limits** - Tell clients what the limits are
6. **Use Redis in production** - More reliable than in-memory for distributed systems
7. **Set up alerts** - Notify when many IPs are hitting rate limits (possible DDoS)
8. **Include user ID when authenticated** - More accurate limiting than IP alone

## Example: Complete Setup

```typescript
// 1. Initialize
import { initializeRedisRateLimiter } from "./redis-setup";
const redisClient = await initializeRedisRateLimiter();

// 2. Use in route
import { checkCombinedRateLimit } from "./redis-setup";

export async function POST(req: Request) {
  const userId = extractUserIdFromAuth(req);
  
  const rateLimitResult = await checkCombinedRateLimit(
    redisClient,
    req,
    userId
  );

  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({
      error: "Rate limited",
      reasons: rateLimitResult.reasons
    }), { status: 429 });
  }

  // Process request...
}

// 3. Monitor
setInterval(async () => {
  const stats = await getRateLimitStats(redisClient);
  console.log(`Active users/IPs: ${stats.totalKeys}`);
}, 60000);
```

## References

- [RFC 6585 - HTTP 429 Status Code](https://tools.ietf.org/html/rfc6585)
- [Redis Commands](https://redis.io/commands/)
- [Rate Limiting Patterns](https://en.wikipedia.org/wiki/Rate_limiting)
