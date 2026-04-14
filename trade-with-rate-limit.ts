import Binance from "binance-api-node";
import {
  InMemoryRateLimiter,
  RedisRateLimiter,
  KeyGenerators,
  RateLimitConfig,
} from "./rate-limiter";

// ============= CONFIGURATION =============
const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_SECRET_KEY;

if (!apiKey || !apiSecret) {
  throw new Error("Missing BINANCE_API_KEY or BINANCE_SECRET_KEY");
}

const client = Binance({ apiKey, apiSecret });

// ============= RATE LIMIT CONFIGURATION =============
// Choose one based on your environment:
// - InMemoryRateLimiter: Good for development or single-server deployments
// - RedisRateLimiter: Recommended for production/distributed systems

const USE_REDIS = process.env.REDIS_URL ? true : false;

// Rate limit configs for different scenarios
const TradeRateLimitConfig: RateLimitConfig = {
  maxRequests: 10,        // 10 trades
  windowMs: 60 * 1000,    // per minute
};

const StrictRateLimitConfig: RateLimitConfig = {
  maxRequests: 5,         // 5 trades
  windowMs: 60 * 1000,    // per minute (for high-risk users)
};

let rateLimiter: InMemoryRateLimiter | RedisRateLimiter;

// Initialize rate limiter
if (USE_REDIS) {
  // Redis setup (you need to initialize and pass the client)
  // For example:
  // import { createClient } from "redis";
  // const redisClient = createClient({ url: process.env.REDIS_URL });
  // await redisClient.connect();
  // rateLimiter = new RedisRateLimiter(TradeRateLimitConfig, redisClient);

  console.log("[INIT] Using Redis rate limiter");
} else {
  rateLimiter = new InMemoryRateLimiter(TradeRateLimitConfig);
  console.log("[INIT] Using in-memory rate limiter");

  // Cleanup old entries every 5 minutes
  setInterval(() => {
    if (rateLimiter instanceof InMemoryRateLimiter) {
      rateLimiter.cleanup();
    }
  }, 5 * 60 * 1000);
}

// ============= REQUEST VALIDATION =============
function validateAuth(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  return authHeader === `Bearer ${process.env.INTERNAL_API_KEY}`;
}

interface TradeRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
}

function validateTradeRequest(data: unknown): TradeRequest {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid request body");
  }

  const { symbol, side, quantity } = data as Record<string, unknown>;

  if (!symbol || typeof symbol !== "string" || !/^[A-Z0-9]{6,10}$/.test(symbol)) {
    throw new Error("Invalid symbol format");
  }

  if (side !== "BUY" && side !== "SELL") {
    throw new Error("Side must be BUY or SELL");
  }

  if (typeof quantity !== "number" || quantity <= 0) {
    throw new Error("Quantity must be a positive number");
  }

  if (quantity > 1000) {
    throw new Error("Quantity exceeds maximum");
  }

  return { symbol, side, quantity };
}

// ============= MAIN ROUTE HANDLER =============
export async function POST(req: Request) {
  try {
    // 1. Authenticate request
    if (!validateAuth(req)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Rate limiting check
    const rateLimitKey = KeyGenerators.byIP(req);
    let rateLimitResult;

    if (rateLimiter instanceof RedisRateLimiter) {
      rateLimitResult = await rateLimiter.check(rateLimitKey);
    } else {
      rateLimitResult = rateLimiter.check(rateLimitKey);
    }

    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.retryAfter || 60;
      console.warn(
        `[RATE_LIMIT] Too many requests from ${rateLimitKey}. Retry after ${retryAfter}s`
      );

      return new Response(
        JSON.stringify({
          error: "Too many requests",
          retryAfter,
          resetTime: new Date(rateLimitResult.resetTime).toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            "RateLimit-Limit": TradeRateLimitConfig.maxRequests.toString(),
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
          },
        }
      );
    }

    // 3. Validate input
    let tradeParams: TradeRequest;
    try {
      const body = await req.json();
      tradeParams = validateTradeRequest(body);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Invalid request",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Execute order with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let order;
    try {
      order = await Promise.race([
        client.order({
          symbol: tradeParams.symbol,
          side: tradeParams.side,
          quantity: tradeParams.quantity,
          type: "MARKET",
        }),
        new Promise((_, reject) =>
          controller.signal.addEventListener("abort", () =>
            reject(new Error("Request timeout"))
          )
        ),
      ]);
    } finally {
      clearTimeout(timeout);
    }

    // 5. Log successful trade
    console.log(
      `[TRADE] ${tradeParams.side} ${tradeParams.quantity} ${tradeParams.symbol} - Order ID: ${order.orderId}`
    );

    // 6. Return success with rate limit info
    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.orderId,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "RateLimit-Limit": TradeRateLimitConfig.maxRequests.toString(),
          "RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    // Classify errors
    if (errorMsg.includes("Insufficient balance")) {
      console.error(`[TRADE ERROR] Insufficient balance`);
      return new Response(
        JSON.stringify({ error: "Insufficient balance" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMsg.includes("Invalid symbol")) {
      return new Response(
        JSON.stringify({ error: "Invalid trading pair" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMsg.includes("Request timeout")) {
      console.error(`[TRADE ERROR] Request timeout`);
      return new Response(
        JSON.stringify({ error: "Trade request timed out" }),
        { status: 504, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generic server error
    console.error(`[TRADE ERROR] ${errorMsg}`);
    return new Response(
      JSON.stringify({ error: "Trade execution failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
