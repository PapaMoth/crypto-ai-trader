# Client-Side Trade Executor Guide

This guide covers the production-ready trade client and React component for executing trades with proper rate limiting, retries, and error handling.

## Files

1. **trade-client.ts** - Core trading client class
2. **trade-executor.tsx** - React component for UI
3. **This guide**

## Quick Start

### 1. Initialize Client

```typescript
import { TradeClient } from "./trade-client";

const client = new TradeClient({
  apiUrl: "http://localhost:3000",
  apiKey: "your_internal_api_key",
  maxRetries: 3,
  onRateLimited: (info) => {
    console.warn(`Rate limited until ${info.resetTime}`);
  },
  onError: (error) => {
    console.error(`Trade failed: ${error.type} - ${error.message}`);
  },
});
```

### 2. Execute a Trade

```typescript
const result = await client.executeTrade({
  symbol: "ETHUSDT",
  side: "BUY",
  quantity: 0.01,
});

if (result.success) {
  console.log(`✓ Order placed: ${result.data.orderId}`);
  console.log(`Rate limit remaining: ${result.rateLimit.remaining}`);
} else {
  console.error(`✗ Failed: ${result.error.message}`);
}
```

### 3. Use React Component

```typescript
import TradeExecutor from "./trade-executor";

function App() {
  return (
    <TradeExecutor
      apiUrl="http://localhost:3000"
      apiKey="your_internal_api_key"
      onTradeSuccess={(orderId) => console.log(`Trade: ${orderId}`)}
      onTradeError={(error) => console.error(error)}
    />
  );
}
```

## Key Features

### ✅ Automatic Retries with Exponential Backoff

```
Attempt 1: Fail
Attempt 2: Wait ~1000ms + jitter, retry
Attempt 3: Wait ~2000ms + jitter, retry
Attempt 4: Wait ~4000ms + jitter, retry
Max: 60 seconds between retries
```

**Configuration:**
```typescript
const client = new TradeClient({
  maxRetries: 3,           // Number of retry attempts
  initialBackoffMs: 1000,  // First retry delay
  maxBackoffMs: 60000,     // Maximum delay between retries
});
```

### ✅ Rate Limit Handling

**Automatic detection and respect for 429 responses:**

```typescript
// If rate limited, automatically waits Retry-After header
// Updates local tracking from RateLimit-* headers
// Retries without counting against max retries
```

**Check current status:**

```typescript
if (client.isNearRateLimit()) {
  console.log("Close to limit! Pause trading.");
}

const secondsUntilReset = client.getResetInSeconds();
console.log(`Reset in ${secondsUntilReset}s`);

const info = client.getRateLimit();
console.log(`${info.remaining} / ${info.limit} requests remaining`);
```

### ✅ Error Classification

Errors are classified into categories:

```typescript
enum ErrorType {
  NETWORK          // Network connectivity issues (retryable)
  RATE_LIMITED     // 429 Too Many Requests (retryable, auto-handled)
  INVALID_REQUEST  // 400 Bad Request (not retryable)
  INSUFFICIENT_BALANCE  // Account balance too low (not retryable)
  INVALID_SYMBOL   // Trading pair doesn't exist (not retryable)
  TIMEOUT          // Request exceeded timeout (retryable)
  SERVER_ERROR     // 5xx errors (retryable)
  UNKNOWN          // Unknown error
}
```

**Example error handling:**

```typescript
const result = await client.executeTrade(request);

if (!result.success) {
  switch (result.error.type) {
    case "RATE_LIMITED":
      console.log(`Wait ${result.error.retryAfter}s`);
      break;
    case "INSUFFICIENT_BALANCE":
      console.log("Add funds to account");
      break;
    case "INVALID_SYMBOL":
      console.log("Check symbol format (e.g., ETHUSDT)");
      break;
    case "NETWORK":
      console.log("Check internet connection");
      break;
  }
}
```

### ✅ Proper Authorization Headers

All requests include:

```
Authorization: Bearer {apiKey}
Content-Type: application/json
```

**Set your API key:**

```typescript
const client = new TradeClient({
  apiKey: "your_secure_api_key", // Stored in .env
  // ...
});
```

### ✅ Request Timeout

```typescript
const client = new TradeClient({
  timeoutMs: 10000, // 10 second timeout
});
```

If request exceeds timeout, it's retried (if retryable).

### ✅ Detailed Response

Every trade returns comprehensive info:

```typescript
interface TradeResult {
  success: boolean;
  data?: TradeResponse;           // { orderId: "..." }
  error?: TradeError;             // Error details
  rateLimit?: RateLimitInfo;      // Current rate limit state
  attempts: number;               // Number of attempts made
}
```

## React Component Usage

### Basic Setup

```typescript
<TradeExecutor
  apiUrl="http://localhost:3000"
  apiKey={process.env.REACT_APP_API_KEY}
  onTradeSuccess={(orderId) => {
    // Handle successful trade
  }}
  onTradeError={(error) => {
    // Handle error
  }}
/>
```

### Features Included

- ✅ Manual trade execution buttons
- ✅ AI signal simulator for testing
- ✅ Rate limit display with warnings
- ✅ Last trade info
- ✅ Error details display
- ✅ Cooldown enforcement (1 min per symbol)
- ✅ Confidence threshold checking (>70%)
- ✅ Prevents overlapping trades

## Advanced Patterns

### Pattern 1: AI Signal Integration

```typescript
async function processAISignal(signal: {
  symbol: string;
  action: "BUY" | "SELL";
  confidence: number;
}) {
  // Skip low confidence signals
  if (signal.confidence < 0.75) {
    console.log("Low confidence, skipping");
    return;
  }

  // Check rate limit before attempting
  if (client.isNearRateLimit()) {
    console.log("Near rate limit, waiting");
    return;
  }

  // Execute trade
  const result = await client.executeTrade({
    symbol: signal.symbol,
    side: signal.action,
    quantity: 0.01,
  });

  if (result.success) {
    console.log(`Trade executed: ${result.data.orderId}`);
  }
}
```

### Pattern 2: Batch Trades with Rate Limiting

```typescript
async function executeBatchTrades(trades: TradeRequest[]) {
  for (const trade of trades) {
    // Check rate limit before each trade
    const info = client.getRateLimit();
    
    if (info.remaining === 0) {
      console.log(`Waiting for rate limit reset...`);
      const secondsToWait = client.getResetInSeconds();
      await sleep(secondsToWait * 1000);
    }

    const result = await client.executeTrade(trade);
    console.log(`Trade ${trade.symbol}: ${result.success ? "✓" : "✗"}`);

    // Small delay between trades
    await sleep(100);
  }
}
```

### Pattern 3: Trading with Position Tracking

```typescript
class PositionTracker {
  private positions: Map<string, {
    symbol: string;
    side: "BUY" | "SELL";
    entryPrice: number;
    quantity: number;
    orderId: string;
  }> = new Map();

  async openPosition(
    client: TradeClient,
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    entryPrice: number
  ) {
    // Check if position already open
    if (this.positions.has(symbol)) {
      console.warn(`Position already open for ${symbol}`);
      return;
    }

    const result = await client.executeTrade({
      symbol,
      side,
      quantity,
    });

    if (result.success) {
      this.positions.set(symbol, {
        symbol,
        side,
        quantity,
        entryPrice,
        orderId: result.data.orderId,
      });
      console.log(`Opened ${side} position: ${symbol}`);
    }
  }

  getPosition(symbol: string) {
    return this.positions.get(symbol);
  }

  closePosition(symbol: string) {
    this.positions.delete(symbol);
  }
}
```

### Pattern 4: Health Checks & Monitoring

```typescript
// Periodic health check
setInterval(() => {
  const rateLimit = client.getRateLimit();
  
  console.log({
    timestamp: new Date().toISOString(),
    rateLimit: {
      remaining: rateLimit.remaining,
      limit: rateLimit.limit,
      resetIn: client.getResetInSeconds(),
      percentUsed: (100 - (rateLimit.remaining / rateLimit.limit * 100)).toFixed(1),
    },
  });

  // Alert if near limit
  if (client.isNearRateLimit()) {
    console.warn("⚠️ Approaching rate limit!");
    sendAlert("Rate limit approaching");
  }
}, 60000);
```

## Error Handling Best Practices

### ❌ Bad

```typescript
try {
  const result = await client.executeTrade(request);
  console.log(result.data.orderId);
} catch (err) {
  console.log("Failed");
}
```

### ✅ Good

```typescript
const result = await client.executeTrade(request);

if (!result.success) {
  // Type-safe error handling
  const error = result.error;

  // Log with full context
  console.error({
    type: error.type,
    message: error.message,
    statusCode: error.statusCode,
    retryable: error.retryable,
    attempts: result.attempts,
    rateLimitInfo: result.rateLimit,
  });

  // Send to error tracking
  sendErrorToSentry({
    error: error.type,
    message: error.message,
    context: {
      request: { symbol, side, quantity },
      attempts: result.attempts,
    },
  });

  // User-facing message
  if (error.type === "RATE_LIMITED") {
    showAlert("Too many trades. Please wait before trying again.");
  } else if (!error.retryable) {
    showAlert(`Cannot complete trade: ${error.message}`);
  }
}
```

## Environment Setup

### .env

```bash
REACT_APP_API_URL=http://localhost:3000
REACT_APP_API_KEY=your_internal_api_key
```

### Production

```bash
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_API_KEY=${INTERNAL_API_KEY} # Use secrets management
```

## Testing

### Unit Tests

```typescript
import { TradeClient } from "./trade-client";

describe("TradeClient", () => {
  it("should retry on rate limit", async () => {
    const client = new TradeClient({
      apiUrl: "http://localhost:3000",
      apiKey: "test-key",
    });

    // Mock 429, then 200
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "Too many requests" }),
          { status: 429, headers: new Headers({ "Retry-After": "1" }) }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, orderId: "123" }),
          { status: 200 }
        )
      );

    const result = await client.executeTrade({
      symbol: "ETHUSDT",
      side: "BUY",
      quantity: 0.01,
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });
});
```

### Integration Test

```bash
# Start server
npm run dev

# In another terminal, run test
npm test -- trade-client.test.ts

# Make requests
curl -X POST http://localhost:3000/api/trade \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"ETHUSDT","side":"BUY","quantity":0.01}'
```

## Troubleshooting

### "Authorization header missing"

**Problem:** Client is sending requests without auth header

**Solution:**
```typescript
const client = new TradeClient({
  apiKey: process.env.REACT_APP_API_KEY, // Must be set!
  // ...
});
```

### "Rate limited after few requests"

**Problem:** Default limit is 10/min, hitting it too fast

**Solution:**
```typescript
// Check before trading
if (client.isNearRateLimit()) {
  console.log("Wait before next trade");
  return;
}

// Implement cooldown
const MIN_TIME_BETWEEN_TRADES = 5000; // 5 seconds
```

### "Requests timing out"

**Problem:** Network slow or server unresponsive

**Solution:**
```typescript
const client = new TradeClient({
  timeoutMs: 30000, // Increase from 10s to 30s
  // ...
});
```

### "Too many retries"

**Problem:** Network unstable, excessive retries

**Solution:**
```typescript
const client = new TradeClient({
  maxRetries: 2, // Reduce from 3 to 2
  // ...
});
```

## Summary

The trade client provides:
- ✅ Automatic rate limit handling
- ✅ Exponential backoff retries
- ✅ Error classification
- ✅ Proper authorization
- ✅ Request timeouts
- ✅ TypeScript types
- ✅ React component
- ✅ Production-ready error handling
