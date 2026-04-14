/**
 * Binance Trading Client - Production Ready
 * Handles rate limiting, retries, error classification, and type safety
 */

// ============= TYPES =============

export interface TradeRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
}

export interface TradeResponse {
  success: true;
  orderId: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface TradeError {
  type:
    | "NETWORK"
    | "RATE_LIMITED"
    | "INVALID_REQUEST"
    | "INSUFFICIENT_BALANCE"
    | "INVALID_SYMBOL"
    | "TIMEOUT"
    | "SERVER_ERROR"
    | "UNKNOWN";
  message: string;
  statusCode?: number;
  rateLimit?: RateLimitInfo;
  retryable: boolean;
  retryAfter?: number;
}

export interface TradeClientConfig {
  apiUrl: string;
  apiKey: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
  onRateLimited?: (info: RateLimitInfo) => void;
  onError?: (error: TradeError) => void;
}

export interface TradeResult {
  success: boolean;
  data?: TradeResponse;
  error?: TradeError;
  rateLimit?: RateLimitInfo;
  attempts: number;
}

// ============= RATE LIMIT TRACKER =============

class RateLimitTracker {
  private limit: number = 10;
  private remaining: number = 10;
  private resetTime: Date = new Date();

  update(headers: Headers): void {
    const limit = headers.get("RateLimit-Limit");
    const remaining = headers.get("RateLimit-Remaining");
    const reset = headers.get("RateLimit-Reset");

    if (limit) this.limit = parseInt(limit);
    if (remaining !== null) this.remaining = parseInt(remaining);
    if (reset) this.resetTime = new Date(reset);
  }

  getInfo(): RateLimitInfo {
    return {
      limit: this.limit,
      remaining: this.remaining,
      resetTime: this.resetTime,
    };
  }

  isNearLimit(): boolean {
    return this.remaining <= 1;
  }

  getResetIn(): number {
    const now = new Date();
    return Math.max(0, this.resetTime.getTime() - now.getTime());
  }
}

// ============= EXPONENTIAL BACKOFF =============

class ExponentialBackoff {
  constructor(
    private initialDelayMs: number = 1000,
    private maxDelayMs: number = 60000
  ) {}

  calculate(attempt: number): number {
    const exponential = this.initialDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponential; // 10% jitter
    const delay = Math.min(exponential + jitter, this.maxDelayMs);
    return Math.floor(delay);
  }
}

// ============= MAIN TRADE CLIENT =============

export class TradeClient {
  private apiUrl: string;
  private apiKey: string;
  private maxRetries: number;
  private backoff: ExponentialBackoff;
  private timeoutMs: number;
  private rateLimitTracker: RateLimitTracker;
  private onRateLimited?: (info: RateLimitInfo) => void;
  private onError?: (error: TradeError) => void;

  constructor(config: TradeClientConfig) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.onRateLimited = config.onRateLimited;
    this.onError = config.onError;

    this.backoff = new ExponentialBackoff(
      config.initialBackoffMs ?? 1000,
      config.maxBackoffMs ?? 60000
    );

    this.rateLimitTracker = new RateLimitTracker();
  }

  /**
   * Execute a trade with automatic retry logic
   */
  async executeTrade(request: TradeRequest): Promise<TradeResult> {
    let lastError: TradeError | null = null;
    let attempts = 0;

    for (attempts = 0; attempts <= this.maxRetries; attempts++) {
      try {
        const result = await this.attemptTrade(request);

        // Success!
        return {
          success: true,
          data: result,
          rateLimit: this.rateLimitTracker.getInfo(),
          attempts: attempts + 1,
        };
      } catch (error) {
        lastError = error as TradeError;

        // Don't retry if not retryable
        if (!lastError.retryable) {
          this.onError?.(lastError);
          return {
            success: false,
            error: lastError,
            rateLimit: this.rateLimitTracker.getInfo(),
            attempts: attempts + 1,
          };
        }

        // Rate limited - wait and retry
        if (lastError.type === "RATE_LIMITED") {
          const retryAfter = lastError.retryAfter ?? 60;
          console.warn(
            `[TRADE] Rate limited. Waiting ${retryAfter}s before retry ${attempts + 1}/${this.maxRetries}`
          );

          this.onRateLimited?.(lastError.rateLimit!);

          // Wait before retrying
          await this.sleep(retryAfter * 1000);
          continue;
        }

        // Other retryable errors - exponential backoff
        if (attempts < this.maxRetries) {
          const delayMs = this.backoff.calculate(attempts);
          console.warn(
            `[TRADE] ${lastError.type} - Retry ${attempts + 1}/${this.maxRetries} after ${delayMs}ms`
          );
          await this.sleep(delayMs);
        }
      }
    }

    // All retries exhausted
    this.onError?.(lastError!);
    return {
      success: false,
      error: lastError!,
      rateLimit: this.rateLimitTracker.getInfo(),
      attempts,
    };
  }

  /**
   * Single trade attempt
   */
  private async attemptTrade(request: TradeRequest): Promise<TradeResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/api/trade`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Update rate limit info from response headers
      this.rateLimitTracker.update(response.headers);

      // Handle different status codes
      if (response.ok) {
        return await response.json();
      }

      // Parse error
      const error = await this.parseError(response);
      throw error;
    } catch (err) {
      if (err instanceof TradeError) {
        throw err;
      }

      // Handle fetch errors
      if (err instanceof DOMException && err.name === "AbortError") {
        throw this.createError(
          "TIMEOUT",
          `Request timed out after ${this.timeoutMs}ms`,
          408,
          true
        );
      }

      if (err instanceof TypeError) {
        throw this.createError(
          "NETWORK",
          `Network error: ${(err as Error).message}`,
          undefined,
          true
        );
      }

      throw this.createError(
        "UNKNOWN",
        `Unknown error: ${(err as Error).message}`,
        undefined,
        false
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Parse API error response
   */
  private async parseError(response: Response): Promise<TradeError> {
    const statusCode = response.status;
    let body: any = {};

    try {
      body = await response.json();
    } catch {
      // If response isn't JSON, just use status code
    }

    // Handle rate limiting
    if (statusCode === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const resetTime = response.headers.get("RateLimit-Reset");

      return {
        type: "RATE_LIMITED",
        message: body.error || "Rate limit exceeded",
        statusCode,
        retryable: true,
        retryAfter: retryAfter ? parseInt(retryAfter) : 60,
        rateLimit: {
          limit: 10,
          remaining: 0,
          resetTime: resetTime ? new Date(resetTime) : new Date(),
        },
      };
    }

    // Handle validation errors
    if (statusCode === 400) {
      const errorMsg = body.error || "Invalid request";

      if (errorMsg.includes("Insufficient balance")) {
        return this.createError(
          "INSUFFICIENT_BALANCE",
          errorMsg,
          400,
          false
        );
      }

      if (errorMsg.includes("Invalid")) {
        return this.createError(
          "INVALID_REQUEST",
          errorMsg,
          400,
          false
        );
      }

      if (errorMsg.includes("symbol")) {
        return this.createError(
          "INVALID_SYMBOL",
          errorMsg,
          400,
          false
        );
      }

      return this.createError("INVALID_REQUEST", errorMsg, 400, false);
    }

    // Handle auth errors
    if (statusCode === 401) {
      return this.createError(
        "INVALID_REQUEST",
        "Unauthorized - invalid API key",
        401,
        false
      );
    }

    // Handle server errors
    if (statusCode >= 500) {
      return this.createError(
        "SERVER_ERROR",
        body.error || "Server error",
        statusCode,
        statusCode !== 503 // Don't retry 503 (service unavailable) by default
      );
    }

    // Handle timeout
    if (statusCode === 504) {
      return this.createError(
        "TIMEOUT",
        body.error || "Request timed out",
        504,
        true
      );
    }

    return this.createError(
      "UNKNOWN",
      body.error || `HTTP ${statusCode}`,
      statusCode,
      statusCode >= 500
    );
  }

  /**
   * Create a TradeError object
   */
  private createError(
    type: TradeError["type"],
    message: string,
    statusCode?: number,
    retryable: boolean = false
  ): TradeError {
    return {
      type,
      message,
      statusCode,
      retryable,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit info
   */
  getRateLimit(): RateLimitInfo {
    return this.rateLimitTracker.getInfo();
  }

  /**
   * Check if near rate limit
   */
  isNearRateLimit(): boolean {
    return this.rateLimitTracker.isNearLimit();
  }

  /**
   * Get seconds until rate limit resets
   */
  getResetInSeconds(): number {
    return Math.ceil(this.rateLimitTracker.getResetIn() / 1000);
  }
}

// ============= USAGE EXAMPLE =============

export async function exampleUsage() {
  const client = new TradeClient({
    apiUrl: "http://localhost:3000",
    apiKey: "your_internal_api_key",
    maxRetries: 3,
    onRateLimited: (info) => {
      console.warn(
        `Rate limited! Reset in ${new Date(info.resetTime).toISOString()}`
      );
      // Could notify user, show alert, etc.
    },
    onError: (error) => {
      console.error(`Trade failed: ${error.type} - ${error.message}`);
      // Send to error tracking service
    },
  });

  // Execute a trade
  const result = await client.executeTrade({
    symbol: "ETHUSDT",
    side: "BUY",
    quantity: 0.01,
  });

  if (result.success) {
    console.log(`✓ Trade executed! Order ID: ${result.data?.orderId}`);
    console.log(`Rate limit remaining: ${result.rateLimit?.remaining}`);
    console.log(`Attempts: ${result.attempts}`);
  } else {
    console.error(`✗ Trade failed: ${result.error?.message}`);
    console.error(`Type: ${result.error?.type}`);

    if (result.error?.type === "RATE_LIMITED") {
      console.error(
        `Retry after: ${result.error.retryAfter}s`
      );
    }
  }
}
