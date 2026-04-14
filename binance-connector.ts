/**
 * Binance API Connector
 * Fetch real price data and train strategies on actual market data
 */

import { PriceBar } from "./ai-backtest";

// ============= TYPES =============

export interface BinanceConfig {
  apiKey?: string;
  apiSecret?: string;
  symbol: string; // e.g., "BTCUSDT"
  interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d"; // Candlestick interval
  limit: number; // Number of candles (max 1000 per request)
  testnet: boolean; // Use testnet API
}

export interface BinanceKline {
  [0]: number; // Open time
  [1]: string; // Open
  [2]: string; // High
  [3]: string; // Low
  [4]: string; // Close
  [5]: string; // Volume
  [6]: number; // Close time
  [7]: string; // Quote asset volume
  [8]: number; // Number of trades
  [9]: string; // Taker buy base asset volume
  [10]: string; // Taker buy quote asset volume
  [11]: string; // Ignore
}

// ============= BINANCE CONNECTOR =============

export class BinanceConnector {
  private config: BinanceConfig;
  private baseUrl: string;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private rateLimitDelay: number = 100; // ms between requests

  constructor(config: BinanceConfig) {
    this.config = {
      limit: 1000,
      testnet: false,
      ...config,
    };

    this.baseUrl = this.config.testnet
      ? "https://testnet.binance.vision"
      : "https://api.binance.com";

    console.log(`\n✓ Binance Connector initialized`);
    console.log(`  Symbol: ${this.config.symbol}`);
    console.log(`  Interval: ${this.config.interval}`);
    console.log(`  Limit: ${this.config.limit}`);
    console.log(`  Environment: ${this.config.testnet ? "TESTNET" : "MAINNET"}\n`);
  }

  /**
   * Fetch historical candlestick data
   */
  async fetchHistoricalData(
    startTime?: number,
    endTime?: number
  ): Promise<PriceBar[]> {
    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        symbol: this.config.symbol,
        interval: this.config.interval,
        limit: Math.min(1000, this.config.limit).toString(),
      });

      if (startTime) params.append("startTime", startTime.toString());
      if (endTime) params.append("endTime", endTime.toString());

      const url = `${this.baseUrl}/api/v3/klines?${params}`;

      console.log(`Fetching: ${this.config.symbol} ${this.config.interval}...`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const klines: BinanceKline[] = await response.json();

      if (klines.length === 0) {
        console.warn("⚠️ No data returned from Binance");
        return [];
      }

      const bars = klines.map((kline) => ({
        timestamp: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
      }));

      console.log(`✓ Fetched ${bars.length} candles from ${new Date(bars[0].timestamp).toISOString()} to ${new Date(bars[bars.length - 1].timestamp).toISOString()}`);

      return bars;
    } catch (error) {
      console.error("❌ Binance API error:", error);
      throw error;
    }
  }

  /**
   * Fetch latest data (last N candles)
   */
  async fetchLatest(limit: number = 1000): Promise<PriceBar[]> {
    return this.fetchHistoricalData(
      undefined,
      Date.now() // Current time
    );
  }

  /**
   * Fetch data for a specific date range
   */
  async fetchDateRange(
    startDate: Date,
    endDate: Date,
    progressCallback?: (progress: number) => void
  ): Promise<PriceBar[]> {
    console.log(`\nFetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const allBars: PriceBar[] = [];
    let currentTime = startDate.getTime();
    const endTime = endDate.getTime();

    // Calculate time increment per candle
    const intervalMs = this.getIntervalMs();

    while (currentTime < endTime) {
      const batchBars = await this.fetchHistoricalData(currentTime, undefined);

      if (batchBars.length === 0) break;

      allBars.push(...batchBars);

      // Move forward
      currentTime = batchBars[batchBars.length - 1].timestamp + intervalMs;

      // Progress callback
      const progress = ((currentTime - startDate.getTime()) / (endTime - startDate.getTime())) * 100;
      if (progressCallback) {
        progressCallback(Math.min(100, progress));
      }

      console.log(`Progress: ${progress.toFixed(1)}%`);

      // Stop if we've reached the end date
      if (currentTime >= endTime) break;
    }

    console.log(`✓ Total bars fetched: ${allBars.length}`);

    return allBars;
  }

  /**
   * Get current ticker data
   */
  async getCurrentPrice(): Promise<{ price: number; timestamp: number }> {
    try {
      await this.rateLimit();

      const url = `${this.baseUrl}/api/v3/ticker/price?symbol=${this.config.symbol}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        price: parseFloat(data.price),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("❌ Failed to fetch current price:", error);
      throw error;
    }
  }

  /**
   * Validate symbol exists
   */
  async validateSymbol(): Promise<boolean> {
    try {
      const price = await this.getCurrentPrice();
      console.log(`✓ Symbol validated: ${this.config.symbol} = $${price.price.toFixed(2)}`);
      return true;
    } catch (error) {
      console.error(`❌ Invalid symbol: ${this.config.symbol}`);
      return false;
    }
  }

  /**
   * Get available intervals
   */
  static getAvailableIntervals(): string[] {
    return ["1m", "5m", "15m", "1h", "4h", "1d"];
  }

  /**
   * Rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Get interval in milliseconds
   */
  private getIntervalMs(): number {
    const intervals: { [key: string]: number } = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
    };
    return intervals[this.config.interval] || 60 * 1000;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      requestsCount: this.requestCount,
      symbol: this.config.symbol,
      interval: this.config.interval,
      environment: this.config.testnet ? "TESTNET" : "MAINNET",
    };
  }
}

// ============= DATA VALIDATOR =============

export class DataValidator {
  /**
   * Validate price data quality
   */
  static validate(bars: PriceBar[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (bars.length === 0) {
      issues.push("No data provided");
      return { valid: false, issues };
    }

    // Check for gaps
    for (let i = 1; i < bars.length; i++) {
      const prevBar = bars[i - 1];
      const currentBar = bars[i];
      const gap = currentBar.timestamp - prevBar.timestamp;

      if (gap <= 0) {
        issues.push(`Negative or zero gap at bar ${i}`);
      }
    }

    // Check for invalid prices
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];

      if (bar.high < bar.low) {
        issues.push(`High < Low at bar ${i}`);
      }

      if (bar.close < bar.low || bar.close > bar.high) {
        issues.push(`Close outside range at bar ${i}`);
      }

      if (bar.open < bar.low || bar.open > bar.high) {
        issues.push(`Open outside range at bar ${i}`);
      }

      if (bar.volume < 0) {
        issues.push(`Negative volume at bar ${i}`);
      }
    }

    // Check for outliers
    const closes = bars.map((b) => b.close);
    const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
    const stdDev = Math.sqrt(
      closes.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / closes.length
    );

    for (let i = 0; i < bars.length; i++) {
      const zscore = Math.abs((bars[i].close - avg) / stdDev);
      if (zscore > 10) {
        issues.push(`Extreme outlier at bar ${i} (zscore: ${zscore.toFixed(1)})`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Print validation report
   */
  static printReport(bars: PriceBar[], name: string = "Data"): void {
    const result = this.validate(bars);

    console.log(`\n📊 Data Validation Report: ${name}`);
    console.log("────────────────────────────────────────────────────────────");
    console.log(`Total Bars: ${bars.length}`);
    console.log(`Date Range: ${new Date(bars[0].timestamp).toISOString()} to ${new Date(bars[bars.length - 1].timestamp).toISOString()}`);

    const closes = bars.map((b) => b.close);
    console.log(`Price Range: $${Math.min(...closes).toFixed(2)} - $${Math.max(...closes).toFixed(2)}`);
    console.log(`Avg Price: $${(closes.reduce((a, b) => a + b, 0) / closes.length).toFixed(2)}`);

    const totalVolume = bars.reduce((sum, b) => sum + b.volume, 0);
    console.log(`Total Volume: ${totalVolume.toFixed(0)}`);

    if (result.valid) {
      console.log(`\n✅ Data validation PASSED - No issues found`);
    } else {
      console.log(`\n❌ Data validation FAILED - ${result.issues.length} issues:`);
      for (const issue of result.issues.slice(0, 10)) {
        console.log(`  • ${issue}`);
      }
      if (result.issues.length > 10) {
        console.log(`  ... and ${result.issues.length - 10} more issues`);
      }
    }
  }
}

// ============= EXAMPLE USAGE =============

export async function exampleBinanceTraining() {
  console.log("\n");
  console.log("█████████████████████████████████████████████████████████████");
  console.log("█             TRAINING ON REAL BINANCE DATA                 █");
  console.log("█████████████████████████████████████████████████████████████");

  // Initialize Binance connector
  const binance = new BinanceConnector({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    symbol: "BTCUSDT",
    interval: "1h",
    limit: 1000,
    testnet: true, // Use testnet by default
  });

  // Validate symbol
  const isValid = await binance.validateSymbol();
  if (!isValid) {
    console.error("Invalid symbol. Aborting.");
    return;
  }

  // Fetch recent data
  console.log("\nFetching last 100 hours of data...");
  const recentData = await binance.fetchLatest(100);

  // Validate data quality
  DataValidator.printReport(recentData, "BTCUSDT 1H");

  // Fetch larger historical dataset
  console.log("\nFetching larger dataset for training...");
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Last 30 days
  const endDate = new Date();

  const historicalData = await binance.fetchDateRange(
    startDate,
    endDate,
    (progress) => {
      process.stdout.write(`\rProgress: ${progress.toFixed(1)}%`);
    }
  );

  console.log("\n");
  DataValidator.printReport(historicalData, "BTCUSDT 30D");

  return { recentData, historicalData };
}

// ============= LIVE PRICE STREAMER (Simulated) =============

export class LivePriceStreamer {
  private connector: BinanceConnector;
  private isStreaming: boolean = false;
  private listeners: ((bar: PriceBar) => void)[] = [];

  constructor(connector: BinanceConnector) {
    this.connector = connector;
  }

  /**
   * Start streaming live prices
   */
  startStream(intervalMs: number = 5000): void {
    if (this.isStreaming) return;

    this.isStreaming = true;
    console.log(`🔴 Live price stream started (${intervalMs}ms interval)`);

    this.streamLoop(intervalMs);
  }

  /**
   * Stop streaming
   */
  stopStream(): void {
    this.isStreaming = false;
    console.log("🔴 Live price stream stopped");
  }

  /**
   * Subscribe to price updates
   */
  onPrice(callback: (bar: PriceBar) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Main streaming loop
   */
  private async streamLoop(intervalMs: number): Promise<void> {
    while (this.isStreaming) {
      try {
        const price = await this.connector.getCurrentPrice();

        const bar: PriceBar = {
          timestamp: price.timestamp,
          open: price.price,
          high: price.price,
          low: price.price,
          close: price.price,
          volume: 0,
        };

        // Notify all listeners
        for (const listener of this.listeners) {
          listener(bar);
        }
      } catch (error) {
        console.error("Stream error:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
