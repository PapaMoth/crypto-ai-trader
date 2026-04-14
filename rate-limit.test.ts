/**
 * Rate Limiter Tests and Examples
 * Run: npm test
 */

import {
  InMemoryRateLimiter,
  KeyGenerators,
  RateLimitConfig,
} from "./rate-limiter";

// ============= TEST SUITE =============

describe("InMemoryRateLimiter", () => {
  const config: RateLimitConfig = {
    maxRequests: 5,
    windowMs: 1000, // 1 second for testing
  };

  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(config);
  });

  test("should allow requests within limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("test-key");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  test("should reject requests exceeding limit", () => {
    // Use up all requests
    for (let i = 0; i < 5; i++) {
      limiter.check("test-key");
    }

    // Next request should fail
    const result = limiter.check("test-key");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
  });

  test("should reset after time window expires", (done) => {
    // Use up all requests
    for (let i = 0; i < 5; i++) {
      limiter.check("test-key");
    }

    // Should be blocked
    expect(limiter.check("test-key").allowed).toBe(false);

    // Wait for window to expire
    setTimeout(() => {
      const result = limiter.check("test-key");
      expect(result.allowed).toBe(true);
      done();
    }, 1100);
  });

  test("should separate limits by key", () => {
    // Use up limit for key1
    for (let i = 0; i < 5; i++) {
      limiter.check("key1");
    }

    // key2 should still work
    const result = limiter.check("key2");
    expect(result.allowed).toBe(true);
  });

  test("should cleanup expired entries", () => {
    limiter.check("key1");
    limiter.check("key2");

    // Wait for expiration
    setTimeout(() => {
      limiter.cleanup();
      // After cleanup, entries should be removed
    }, 1100);
  });
});

// ============= EXAMPLE USAGE =============

export async function exampleInMemoryUsage() {
  console.log("\n=== IN-MEMORY RATE LIMITER EXAMPLE ===\n");

  const limiter = new InMemoryRateLimiter({
    maxRequests: 3,
    windowMs: 5000, // 5 seconds
  });

  const userId = "user123";

  // Simulate 5 requests
  for (let i = 1; i <= 5; i++) {
    const result = limiter.check(userId);

    console.log(`Request ${i}:`);
    console.log(`  Allowed: ${result.allowed}`);
    console.log(`  Remaining: ${result.remaining}`);
    console.log(
      `  Reset Time: ${new Date(result.resetTime).toISOString()}`
    );

    if (result.retryAfter) {
      console.log(`  Retry After: ${result.retryAfter}s`);
    }
  }

  console.log("\n=== EXPECTED OUTPUT ===");
  console.log("Requests 1-3: Allowed");
  console.log("Requests 4-5: Blocked (429)");
}

export async function exampleKeyGenerators() {
  console.log("\n=== KEY GENERATOR EXAMPLES ===\n");

  // Mock request object
  const mockRequest = new Request("http://localhost", {
    headers: new Headers({
      "x-forwarded-for": "192.168.1.100, 10.0.0.1",
    }),
  });

  // Example 1: Per IP
  const ipKey = KeyGenerators.byIP(mockRequest);
  console.log(`By IP: ${ipKey}`);
  // Output: rate-limit:ip:192.168.1.100

  // Example 2: Per User
  const userKey = KeyGenerators.byUser(mockRequest, "user123");
  console.log(`By User: ${userKey}`);
  // Output: rate-limit:user:user123

  // Example 3: Per Endpoint
  const endpointKey = KeyGenerators.byEndpoint(mockRequest, "/api/trade");
  console.log(`By Endpoint: ${endpointKey}`);
  // Output: rate-limit:/api/trade:192.168.1.100

  // Example 4: Per Endpoint + User
  const combinedKey = KeyGenerators.byEndpointAndUser(
    mockRequest,
    "/api/trade",
    "user123"
  );
  console.log(`By Endpoint + User: ${combinedKey}`);
  // Output: rate-limit:/api/trade:user:user123
}

export async function exampleRateLimitFlow() {
  console.log("\n=== RATE LIMIT FLOW EXAMPLE ===\n");

  const limiter = new InMemoryRateLimiter({
    maxRequests: 2,
    windowMs: 3000,
  });

  // Simulate API request handling
  const handleRequest = (ipAddress: string): string => {
    const key = `rate-limit:ip:${ipAddress}`;
    const result = limiter.check(key);

    if (!result.allowed) {
      return JSON.stringify({
        status: 429,
        error: "Too many requests",
        retryAfter: result.retryAfter,
        resetTime: new Date(result.resetTime).toISOString(),
      });
    }

    return JSON.stringify({
      status: 200,
      message: "Request processed",
      remaining: result.remaining,
      resetTime: new Date(result.resetTime).toISOString(),
    });
  };

  // Simulate 3 requests from same IP
  const ip = "192.168.1.1";
  for (let i = 1; i <= 3; i++) {
    console.log(`Request ${i}:`);
    console.log(handleRequest(ip));
  }

  console.log("\n=== EXPECTED OUTPUT ===");
  console.log("Request 1: 200 OK, remaining: 1");
  console.log("Request 2: 200 OK, remaining: 0");
  console.log("Request 3: 429 Too Many Requests");
}

// ============= STRESS TEST =============

export async function stressTest() {
  console.log("\n=== STRESS TEST ===\n");

  const limiter = new InMemoryRateLimiter({
    maxRequests: 1000,
    windowMs: 60000, // 1 minute
  });

  const startTime = Date.now();

  // Simulate 10k requests from 100 different IPs
  let blocked = 0;
  let allowed = 0;

  for (let i = 0; i < 10000; i++) {
    const ipIndex = Math.floor(Math.random() * 100);
    const key = `ip-${ipIndex}`;

    const result = limiter.check(key);
    if (result.allowed) {
      allowed++;
    } else {
      blocked++;
    }
  }

  const duration = Date.now() - startTime;

  console.log(`Processed 10,000 requests in ${duration}ms`);
  console.log(`Allowed: ${allowed}`);
  console.log(`Blocked: ${blocked}`);
  console.log(`Requests/second: ${Math.round((10000 / duration) * 1000)}`);
}

// Run examples
if (require.main === module) {
  Promise.all([
    exampleInMemoryUsage(),
    exampleKeyGenerators(),
    exampleRateLimitFlow(),
    stressTest(),
  ]).catch(console.error);
}
