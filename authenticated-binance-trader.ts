/**
 * Authenticated Binance Trader
 * Real order execution with balance tracking and AI integration
 */

import crypto from "crypto";
import { LiveTradingWithEvolvedStrategy } from "./evolved-strategy-injector";
import { PriceBar } from "./ai-backtest";
import { RiskEngine } from "./lib/risk-engine";

// ============= TYPES =============

export interface BinanceAuthConfig {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  price?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface OrderResponse {
  orderId: number;
  symbol: string;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  fills: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
}

export interface OrderStatus {
  orderId: number;
  clientOrderId: string;
  symbol: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "EXPIRED";
  timeInForce: string;
  type: string;
  side: "BUY" | "SELL";
  stopPrice: string;
  icebergQty: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
}

export interface AccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  updateTime: number;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

export interface TradePosition {
  symbol: string;
  entryPrice: number;
  quantity: number;
  side: "LONG" | "SHORT";
  entryTime: number;
  orderId: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface TradingSession {
  startTime: number;
  startBalance: number;
  currentBalance: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  positions: TradePosition[];
  orders: OrderStatus[];
}

// ============= AUTHENTICATED BINANCE TRADER =============

export class AuthenticatedBinanceTrader {
  private config: BinanceAuthConfig;
  private baseUrl: string;
  private session: TradingSession;
  private priceCache: Map<string, number> = new Map();
  private openPositions: Map<number, TradePosition> = new Map();
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  constructor(config: BinanceAuthConfig, initialBalance: number = 10000) {
    this.config = config;
    this.baseUrl = config.testnet
      ? "https://testnet.binance.vision"
      : "https://api.binance.com";

    this.session = {
      startTime: Date.now(),
      startBalance: initialBalance,
      currentBalance: initialBalance,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      positions: [],
      orders: [],
    };

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║     AUTHENTICATED BINANCE TRADER INITIALIZED              ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log(`Environment: ${config.testnet ? "TESTNET" : "MAINNET"}`);
    console.log(`Starting Balance: $${initialBalance.toFixed(2)}`);
    console.log();
  }

  /**
   * Authenticate and fetch account info
   */
  async authenticate(): Promise<AccountInfo> {
    try {
      console.log("Authenticating with Binance...");
      const accountInfo = await this.getAccountInfo();

      console.log("✅ Authentication successful");
      console.log(`Account Status: ${accountInfo.canTrade ? "Trading enabled" : "Trading disabled"}`);

      // Parse balances
      const balances = accountInfo.balances.filter(
        (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );

      if (balances.length > 0) {
        console.log("\nCurrent Balances:");
        for (const balance of balances.slice(0, 5)) {
          const total = (parseFloat(balance.free) + parseFloat(balance.locked)).toFixed(4);
          console.log(`  ${balance.asset}: ${total} (Free: ${balance.free}, Locked: ${balance.locked})`);
        }
      }

      return accountInfo;
    } catch (error) {
      console.error("❌ Authentication failed:", error);
      throw error;
    }
  }

  /**
   * Place market order
   */
  async placeMarketOrder(request: OrderRequest): Promise<OrderResponse> {
    if (request.type !== "MARKET") {
      throw new Error("Only MARKET orders are supported in this method");
    }

    try {
      console.log(`\n📤 Placing ${request.side} order:`);
      console.log(`   Symbol: ${request.symbol}`);
      console.log(`   Quantity: ${request.quantity}`);

      const orderResponse = await this.sendAuthenticatedRequest(
        "POST",
        "/api/v3/order",
        {
          symbol: request.symbol,
          side: request.side,
          type: "MARKET",
          quantity: request.quantity,
        }
      );

      console.log(`✅ Order placed successfully`);
      console.log(`   Order ID: ${orderResponse.orderId}`);
      console.log(`   Status: ${orderResponse.status}`);
      console.log(`   Executed: ${orderResponse.executedQty}/${orderResponse.origQty}`);

      // Update session
      this.session.totalTrades++;
      this.session.orders.push(orderResponse);

      // Track position
      if (orderResponse.status === "FILLED") {
        const position: TradePosition = {
          symbol: request.symbol,
          entryPrice: parseFloat(orderResponse.fills[0].price),
          quantity: parseFloat(orderResponse.executedQty),
          side: request.side === "BUY" ? "LONG" : "SHORT",
          entryTime: orderResponse.transactTime,
          orderId: orderResponse.orderId,
        };
        this.openPositions.set(orderResponse.orderId, position);
        this.session.positions.push(position);
      }

      return orderResponse;
    } catch (error) {
      console.error("❌ Failed to place order:", error);
      throw error;
    }
  }

  /**
   * Place limit order
   */
  async placeLimitOrder(request: OrderRequest): Promise<OrderResponse> {
    if (!request.price) {
      throw new Error("Price required for limit orders");
    }

    try {
      console.log(`\n📤 Placing limit ${request.side} order:`);
      console.log(`   Symbol: ${request.symbol}`);
      console.log(`   Quantity: ${request.quantity}`);
      console.log(`   Price: ${request.price}`);

      const orderResponse = await this.sendAuthenticatedRequest(
        "POST",
        "/api/v3/order",
        {
          symbol: request.symbol,
          side: request.side,
          type: "LIMIT",
          quantity: request.quantity,
          price: request.price.toString(),
          timeInForce: request.timeInForce || "GTC",
        }
      );

      console.log(`✅ Limit order placed`);
      console.log(`   Order ID: ${orderResponse.orderId}`);
      console.log(`   Status: ${orderResponse.status}`);

      this.session.orders.push(orderResponse);

      return orderResponse;
    } catch (error) {
      console.error("❌ Failed to place limit order:", error);
      throw error;
    }
  }

  /**
   * Check order status
   */
  async getOrderStatus(symbol: string, orderId: number): Promise<OrderStatus> {
    try {
      const orderStatus = await this.sendAuthenticatedRequest(
        "GET",
        "/api/v3/order",
        {
          symbol,
          orderId,
        }
      );

      return orderStatus;
    } catch (error) {
      console.error("❌ Failed to get order status:", error);
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<OrderResponse> {
    try {
      console.log(`\n❌ Canceling order ${orderId}...`);

      const response = await this.sendAuthenticatedRequest(
        "DELETE",
        "/api/v3/order",
        {
          symbol,
          orderId,
        }
      );

      console.log(`✅ Order canceled`);

      return response;
    } catch (error) {
      console.error("❌ Failed to cancel order:", error);
      throw error;
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo(): Promise<AccountInfo> {
    try {
      return await this.sendAuthenticatedRequest("GET", "/api/v3/account");
    } catch (error) {
      console.error("❌ Failed to get account info:", error);
      throw error;
    }
  }

  /**
   * Get balance for asset
   */
  async getBalance(asset: string = "USDT"): Promise<{ free: string; locked: string }> {
    try {
      const accountInfo = await this.getAccountInfo();
      const balance = accountInfo.balances.find((b) => b.asset === asset);

      if (!balance) {
        return { free: "0", locked: "0" };
      }

      const totalBalance = (
        parseFloat(balance.free) + parseFloat(balance.locked)
      ).toFixed(8);

      console.log(`Balance ${asset}: ${totalBalance} (Free: ${balance.free}, Locked: ${balance.locked})`);

      return { free: balance.free, locked: balance.locked };
    } catch (error) {
      console.error("❌ Failed to get balance:", error);
      throw error;
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol: string): Promise<OrderStatus[]> {
    try {
      const orders = await this.sendAuthenticatedRequest(
        "GET",
        "/api/v3/openOrders",
        { symbol }
      );

      console.log(`Found ${orders.length} open orders for ${symbol}`);

      return orders;
    } catch (error) {
      console.error("❌ Failed to get open orders:", error);
      throw error;
    }
  }

  /**
   * Calculate position PnL
   */
  calculatePositionPnL(position: TradePosition, currentPrice: number): { pnl: number; pnlPercent: number } {
    const priceDiff = currentPrice - position.entryPrice;
    const pnl =
      position.side === "LONG"
        ? priceDiff * position.quantity
        : -priceDiff * position.quantity;
    const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

    return { pnl, pnlPercent };
  }

  /**
   * Update session metrics
   */
  updateSessionMetrics(currentBalance: number): void {
    this.session.currentBalance = currentBalance;
    this.session.totalProfit = currentBalance - this.session.startBalance;
  }

  /**
   * Get session stats
   */
  getSessionStats(): TradingSession {
    return { ...this.session };
  }

  /**
   * Print trading session report
   */
  printSessionReport(): void {
    const duration = (Date.now() - this.session.startTime) / (1000 * 60); // minutes
    const roi = ((this.session.currentBalance - this.session.startBalance) / this.session.startBalance) * 100;

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║           TRADING SESSION REPORT                          ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("Performance:");
    console.log(`  Start Balance: $${this.session.startBalance.toFixed(2)}`);
    console.log(`  Current Balance: $${this.session.currentBalance.toFixed(2)}`);
    console.log(`  Total Profit: $${this.session.totalProfit.toFixed(2)}`);
    console.log(`  ROI: ${roi.toFixed(2)}%`);
    console.log(`  Duration: ${duration.toFixed(1)} minutes`);

    console.log("\nTrading Activity:");
    console.log(`  Total Trades: ${this.session.totalTrades}`);
    console.log(`  Winning Trades: ${this.session.winningTrades}`);
    console.log(`  Losing Trades: ${this.session.losingTrades}`);
    console.log(`  Win Rate: ${this.session.totalTrades > 0 ? ((this.session.winningTrades / this.session.totalTrades) * 100).toFixed(1) : 0}%`);

    console.log("\nRequest Stats:");
    console.log(`  Authenticated Requests: ${this.requestCount}`);

    console.log();
  }

  /**
   * Send authenticated API request
   */
  private async sendAuthenticatedRequest(
    method: string,
    endpoint: string,
    params?: Record<string, any>
  ): Promise<any> {
    await this.rateLimit();

    const timestamp = Date.now();
    const query = params || {};
    query.timestamp = timestamp;
    query.recvWindow = 5000;

    const queryString = this.buildQueryString(query);
    const signature = this.generateSignature(queryString);

    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const options: RequestInit = {
      method,
      headers: {
        "X-MBX-APIKEY": this.config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Binance API error: ${errorData.msg || response.statusText}`);
      }

      const data = await response.json();
      this.requestCount++;

      return data;
    } catch (error) {
      console.error("Request failed:", error);
      throw error;
    }
  }

  /**
   * Generate HMAC SHA256 signature
   */
  private generateSignature(data: string): string {
    return crypto
      .createHmac("sha256", this.config.apiSecret)
      .update(data)
      .digest("hex");
  }

  /**
   * Build query string
   */
  private buildQueryString(params: Record<string, any>): string {
    return Object.keys(params)
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join("&");
  }

  /**
   * Rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = 100; // 100ms between requests

    if (timeSinceLastRequest < minDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, minDelay - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }
}

// ============= AI-INTEGRATED LIVE TRADER =============

export class AIIntegratedBinanceTrader {
  private trader: AuthenticatedBinanceTrader;
  private aiTrading: LiveTradingWithEvolvedStrategy;
  private symbol: string;
  private priceHistory: number[] = [];
  private isTrading: boolean = false;
  private readonly riskEngine = new RiskEngine({
    maxDailyLossPct: 0.03,
    maxSymbolExposurePct: 0.35,
    maxTotalExposurePct: 0.8,
  });
  private startOfDayEquity: number = 0;
  private symbolExposureUsd: Map<string, number> = new Map();
  private totalExposureUsd = 0;

  constructor(
    authConfig: BinanceAuthConfig,
    aiTrading: LiveTradingWithEvolvedStrategy,
    symbol: string = "BTCUSDT"
  ) {
    this.trader = new AuthenticatedBinanceTrader(authConfig);
    this.aiTrading = aiTrading;
    this.symbol = symbol;
  }

  /**
   * Initialize and start trading
   */
  async start(): Promise<void> {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      AI-INTEGRATED BINANCE TRADER STARTING                ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    try {
      // Authenticate
      const account = await this.trader.authenticate();

      if (!account.canTrade) {
        throw new Error("Account trading is disabled");
      }

      // Get balance
      const balance = await this.trader.getBalance("USDT");
      this.startOfDayEquity = parseFloat(balance.free || "0");
      console.log(`\nUSADT Available: ${balance.free}\n`);

      // Check open orders
      const openOrders = await this.trader.getOpenOrders(this.symbol);
      if (openOrders.length > 0) {
        console.log(`⚠️ Found ${openOrders.length} open orders for ${this.symbol}`);
        console.log("Consider canceling them before starting AI trading.\n");
      }

      this.isTrading = true;
      console.log("✅ AI Trading ready. Waiting for signals...\n");
    } catch (error) {
      console.error("❌ Failed to start trading:", error);
      throw error;
    }
  }

  /**
   * Process price and generate trade signal
   */
  async processPrice(price: number): Promise<void> {
    if (!this.isTrading) return;

    try {
      // Add to price history
      this.priceHistory.push(price);

      // Keep last 100 prices
      if (this.priceHistory.length > 100) {
        this.priceHistory.shift();
      }

      // Generate signal from AI
      const signal = this.aiTrading.executeSignal(this.priceHistory);

      if (!signal || signal.action === "HOLD") {
        return; // No signal
      }

      console.log(`\n🎯 AI Signal: ${signal.action}`);
      console.log(`   Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
      console.log(`   Reason: ${signal.reason}`);

      // Execute trade
      if (signal.action === "BUY") {
        await this.executeBuySignal(price);
      } else if (signal.action === "SELL") {
        await this.executeSellSignal(price);
      }
    } catch (error) {
      console.error("Error processing price:", error);
    }
  }

  /**
   * Execute buy signal
   */
  private async executeBuySignal(price: number): Promise<void> {
    try {
      // Get available balance
      const balance = await this.trader.getBalance("USDT");
      const availableBalance = parseFloat(balance.free);
      const plannedNotionalUsd = availableBalance * 0.9;

      const riskCheck = this.riskEngine.canOpenPosition(this.symbol, plannedNotionalUsd, {
        equity: availableBalance,
        startOfDayEquity: this.startOfDayEquity || availableBalance,
        symbolExposureUsd: this.symbolExposureUsd.get(this.symbol) || 0,
        totalExposureUsd: this.totalExposureUsd,
      });
      if (!riskCheck.ok) {
        console.warn(`⚠️ Risk block (${this.symbol}): ${riskCheck.reason}`);
        return;
      }

      if (availableBalance < price) {
        console.warn("⚠️ Insufficient balance for buy order");
        return;
      }

      // Calculate quantity (use 90% of available balance to be safe)
      const amountToUse = plannedNotionalUsd;
      const quantity = parseFloat((amountToUse / price).toFixed(8));

      if (quantity <= 0) {
        console.warn("⚠️ Calculated quantity is 0");
        return;
      }

      // Place market buy order
      const order = await this.trader.placeMarketOrder({
        symbol: this.symbol,
        side: "BUY",
        type: "MARKET",
        quantity,
      });

      // Record trade result
      if (order.status === "FILLED") {
        this.aiTrading.recordTrade(true); // Assume positive initially
        this.trader.updateSessionMetrics(availableBalance - amountToUse);
        const nextExposure = (this.symbolExposureUsd.get(this.symbol) || 0) + amountToUse;
        this.symbolExposureUsd.set(this.symbol, nextExposure);
        this.totalExposureUsd += amountToUse;
      }
    } catch (error) {
      console.error("❌ Buy order failed:", error);
      this.aiTrading.recordTrade(false);
    }
  }

  /**
   * Execute sell signal
   */
  private async executeSellSignal(price: number): Promise<void> {
    try {
      // Get current balance to see if we have coins to sell
      const balance = await this.trader.getBalance(this.symbol.replace("USDT", ""));
      const availableQuantity = parseFloat(balance.free);

      if (availableQuantity <= 0) {
        console.warn("⚠️ No coins available to sell");
        return;
      }

      // Place market sell order
      const order = await this.trader.placeMarketOrder({
        symbol: this.symbol,
        side: "SELL",
        type: "MARKET",
        quantity: availableQuantity,
      });

      // Record trade result
      if (order.status === "FILLED") {
        const proceeds = availableQuantity * price;
        this.aiTrading.recordTrade(true);
        this.trader.updateSessionMetrics(proceeds);
        const currentExposure = this.symbolExposureUsd.get(this.symbol) || 0;
        const reduction = Math.min(currentExposure, proceeds);
        this.symbolExposureUsd.set(this.symbol, Math.max(0, currentExposure - reduction));
        this.totalExposureUsd = Math.max(0, this.totalExposureUsd - reduction);
      }
    } catch (error) {
      console.error("❌ Sell order failed:", error);
      this.aiTrading.recordTrade(false);
    }
  }

  /**
   * Stop trading
   */
  stop(): void {
    this.isTrading = false;
    this.trader.printSessionReport();
  }

  /**
   * Get trader stats
   */
  getStats() {
    return this.trader.getSessionStats();
  }
}

// ============= EXAMPLE USAGE =============

export async function exampleAuthenticatedTrading() {
  console.log("\n");
  console.log("█████████████████████████████████████████████████████████████");
  console.log("█           AUTHENTICATED BINANCE TRADER EXAMPLE              █");
  console.log("█████████████████████████████████████████████████████████████");

  // Get credentials from environment
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("❌ Missing BINANCE_API_KEY or BINANCE_API_SECRET environment variables");
    return;
  }

  const authConfig: BinanceAuthConfig = {
    apiKey,
    apiSecret,
    testnet: true, // Use testnet
  };

  const trader = new AuthenticatedBinanceTrader(authConfig, 1000);

  try {
    // Authenticate
    await trader.authenticate();

    // Get balance
    await trader.getBalance("USDT");

    // Check open orders
    await trader.getOpenOrders("BTCUSDT");

    // Print session report
    trader.printSessionReport();
  } catch (error) {
    console.error("Error:", error);
  }
}
