/**
 * Authenticated Kraken Trader
 * Real order execution with balance tracking and AI integration
 */

import crypto from "crypto";
import { LiveTradingWithEvolvedStrategy } from "./evolved-strategy-injector";

// ============= TYPES =============

export interface KrakenAuthConfig {
  apiKey: string;
  apiSecret: string; // Base64 encoded private key
}

export interface KrakenOrderRequest {
  pair: string; // e.g., "XBTUSDT"
  type: "buy" | "sell";
  ordertype: "market" | "limit";
  volume: string;
  price?: string;
  triggerPrice?: string;
  flags?: string;
}

export interface KrakenOrderResponse {
  refid: string;
  txid: string[];
  descr: {
    order: string;
    close?: string;
  };
}

export interface KrakenOrderStatus {
  refid: string;
  txid: string;
  status: "pending" | "active" | "closed" | "canceled";
  reason?: string;
  opentm: number;
  closetm?: number;
  starttm?: number;
  expiretm?: number;
  descr: {
    pair: string;
    type: "buy" | "sell";
    ordertype: "market" | "limit";
    price: string;
    price2: string;
    leverage: string;
    order: string;
    close?: string;
  };
  vol: string;
  vol_exec: string;
  cost: string;
  fee: string;
  price: string;
  stopstatus: string;
  triggered: string;
  info: string;
  userref: number;
}

export interface KrakenBalance {
  [asset: string]: string; // Balance as string
}

export interface TradePosition {
  pair: string;
  entryPrice: number;
  quantity: number;
  side: "buy" | "sell";
  entryTime: number;
  txid: string;
  pnl?: number;
  pnlPercent?: number;
}

export interface KrakenTradingSession {
  startTime: number;
  startBalance: number;
  currentBalance: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  positions: TradePosition[];
  orders: KrakenOrderStatus[];
}

// ============= AUTHENTICATED KRAKEN TRADER =============

export class AuthenticatedKrakenTrader {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string = "https://api.kraken.com";
  private session: KrakenTradingSession;
  private openPositions: Map<string, TradePosition> = new Map();
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private nonce: number = 0;

  constructor(config: KrakenAuthConfig, initialBalance: number = 10000) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

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
    console.log("║     AUTHENTICATED KRAKEN TRADER INITIALIZED               ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log(`Starting Balance: $${initialBalance.toFixed(2)}`);
    console.log("Environment: KRAKEN LIVE API");
    console.log();
  }

  /**
   * Authenticate and fetch account info
   */
  async authenticate(): Promise<KrakenBalance> {
    try {
      console.log("Authenticating with Kraken...");
      const balances = await this.getBalance();

      console.log("✅ Authentication successful");
      console.log("\nCurrent Balances:");

      const sortedAssets = Object.entries(balances)
        .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]))
        .slice(0, 10);

      for (const [asset, balance] of sortedAssets) {
        const amount = parseFloat(balance);
        if (amount > 0.0001) {
          console.log(`  ${asset}: ${amount.toFixed(8)}`);
        }
      }

      return balances;
    } catch (error) {
      console.error("❌ Authentication failed:", error);
      throw error;
    }
  }

  /**
   * Get balance
   */
  async getBalance(): Promise<KrakenBalance> {
    try {
      const response = await this.privateRequest("Balance", {});

      console.log("Balance updated");

      return response;
    } catch (error) {
      console.error("❌ Failed to get balance:", error);
      throw error;
    }
  }

  /**
   * Get balance for specific asset
   */
  async getAssetBalance(asset: string): Promise<number> {
    try {
      const balances = await this.getBalance();

      // Map common asset names
      const assetMap: { [key: string]: string } = {
        BTC: "XXBT",
        ETH: "XETH",
        USD: "ZUSD",
        EUR: "ZEUR",
      };

      const key = assetMap[asset] || asset;
      const balance = balances[key] || "0";

      const amount = parseFloat(balance);
      console.log(`${asset} Balance: ${amount.toFixed(8)}`);

      return amount;
    } catch (error) {
      console.error(`❌ Failed to get ${asset} balance:`, error);
      throw error;
    }
  }

  /**
   * Place market order
   */
  async placeMarketOrder(
    pair: string,
    type: "buy" | "sell",
    volume: string
  ): Promise<KrakenOrderResponse> {
    try {
      console.log(`\n📤 Placing ${type.toUpperCase()} order:`);
      console.log(`   Pair: ${pair}`);
      console.log(`   Volume: ${volume}`);

      const response = await this.privateRequest("AddOrder", {
        pair,
        type,
        ordertype: "market",
        volume,
      });

      console.log(`✅ Order placed successfully`);
      console.log(`   Order ID: ${response.txid[0] || "pending"}`);

      this.session.totalTrades++;

      // Track position
      const position: TradePosition = {
        pair,
        entryPrice: 0, // Will be updated after order fills
        quantity: parseFloat(volume),
        side: type,
        entryTime: Date.now(),
        txid: response.txid[0] || response.refid,
      };

      this.openPositions.set(response.refid, position);
      this.session.positions.push(position);

      return response;
    } catch (error) {
      console.error("❌ Failed to place market order:", error);
      throw error;
    }
  }

  /**
   * Place limit order
   */
  async placeLimitOrder(
    pair: string,
    type: "buy" | "sell",
    volume: string,
    price: string
  ): Promise<KrakenOrderResponse> {
    try {
      console.log(`\n📤 Placing limit ${type.toUpperCase()} order:`);
      console.log(`   Pair: ${pair}`);
      console.log(`   Volume: ${volume}`);
      console.log(`   Price: ${price}`);

      const response = await this.privateRequest("AddOrder", {
        pair,
        type,
        ordertype: "limit",
        volume,
        price,
      });

      console.log(`✅ Limit order placed`);
      console.log(`   Ref ID: ${response.refid}`);

      this.session.orders.push({
        refid: response.refid,
        txid: response.txid[0] || "",
        status: "pending",
        opentm: Date.now(),
        descr: {
          pair,
          type,
          ordertype: "limit",
          price,
          price2: "",
          leverage: "none",
          order: `${type} ${volume} ${pair}`,
        },
        vol: volume,
        vol_exec: "0",
        cost: "0",
        fee: "0",
        price: "0",
        stopstatus: "",
        triggered: "",
        info: "",
        userref: 0,
      });

      return response;
    } catch (error) {
      console.error("❌ Failed to place limit order:", error);
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(txid: string): Promise<any> {
    try {
      console.log(`\n❌ Canceling order ${txid}...`);

      const response = await this.privateRequest("CancelOrder", {
        txid,
      });

      console.log(`✅ Order canceled`);

      return response;
    } catch (error) {
      console.error("❌ Failed to cancel order:", error);
      throw error;
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(
    pair?: string
  ): Promise<{ [refid: string]: KrakenOrderStatus }> {
    try {
      const params: any = {};

      if (pair) {
        params.pair = pair;
      }

      const response = await this.privateRequest("OpenOrders", params);

      console.log(`Found ${Object.keys(response).length} open orders`);

      return response;
    } catch (error) {
      console.error("❌ Failed to get open orders:", error);
      throw error;
    }
  }

  /**
   * Get closed orders
   */
  async getClosedOrders(
    pair?: string,
    closetime?: string
  ): Promise<{ [refid: string]: KrakenOrderStatus }> {
    try {
      const params: any = {};

      if (pair) {
        params.pair = pair;
      }

      if (closetime) {
        params.closetime = closetime;
      }

      const response = await this.privateRequest("ClosedOrders", params);

      return response;
    } catch (error) {
      console.error("❌ Failed to get closed orders:", error);
      throw error;
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(txid: string): Promise<KrakenOrderStatus> {
    try {
      const response = await this.privateRequest("QueryOrders", {
        txid,
      });

      return response[txid];
    } catch (error) {
      console.error("❌ Failed to get order status:", error);
      throw error;
    }
  }

  /**
   * Calculate position PnL
   */
  calculatePositionPnL(
    position: TradePosition,
    currentPrice: number
  ): { pnl: number; pnlPercent: number } {
    const priceDiff = currentPrice - position.entryPrice;
    const pnl =
      position.side === "buy"
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
  getSessionStats(): KrakenTradingSession {
    return { ...this.session };
  }

  /**
   * Print trading session report
   */
  printSessionReport(): void {
    const duration = (Date.now() - this.session.startTime) / (1000 * 60);
    const roi =
      ((this.session.currentBalance - this.session.startBalance) /
        this.session.startBalance) *
      100;

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║           KRAKEN TRADING SESSION REPORT                   ║");
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
    console.log(
      `  Win Rate: ${this.session.totalTrades > 0 ? ((this.session.winningTrades / this.session.totalTrades) * 100).toFixed(1) : 0}%`
    );

    console.log("\nRequest Stats:");
    console.log(`  Authenticated Requests: ${this.requestCount}`);

    console.log();
  }

  /**
   * Private API request
   */
  private async privateRequest(endpoint: string, params: any): Promise<any> {
    await this.rateLimit();

    // Generate nonce
    this.nonce = Math.floor(Date.now() / 1000) * 1000;

    // Build request body
    const body = new URLSearchParams({
      nonce: this.nonce.toString(),
      ...params,
    });

    const bodyString = body.toString();

    // Create signature
    const message = `${endpoint}${bodyString}`;
    const signature = this.generateSignature(endpoint, message);

    const url = `${this.baseUrl}/0/private/${endpoint}`;

    const options: RequestInit = {
      method: "POST",
      headers: {
        "API-Sign": signature,
        "API-Key": this.apiKey,
      },
      body: bodyString,
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(", ")}`);
      }

      this.requestCount++;

      return data.result || data;
    } catch (error) {
      console.error("Request failed:", error);
      throw error;
    }
  }

  /**
   * Generate signature for Kraken API
   */
  private generateSignature(endpoint: string, message: string): string {
    const hash = crypto
      .createHash("sha256")
      .update(message)
      .digest("binary");

    const signature = crypto
      .createHmac("sha512", Buffer.from(this.apiSecret, "base64"))
      .update(endpoint + hash)
      .digest("base64");

    return signature;
  }

  /**
   * Rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = 300; // 300ms between requests for Kraken

    if (timeSinceLastRequest < minDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, minDelay - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }
}

// ============= AI-INTEGRATED KRAKEN TRADER =============

export class AIIntegratedKrakenTrader {
  private trader: AuthenticatedKrakenTrader;
  private aiTrading: LiveTradingWithEvolvedStrategy;
  private pair: string;
  private priceHistory: number[] = [];
  private isTrading: boolean = false;

  constructor(
    authConfig: KrakenAuthConfig,
    aiTrading: LiveTradingWithEvolvedStrategy,
    pair: string = "XBTUSDT"
  ) {
    this.trader = new AuthenticatedKrakenTrader(authConfig);
    this.aiTrading = aiTrading;
    this.pair = pair;
  }

  /**
   * Initialize and start trading
   */
  async start(): Promise<void> {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║     AI-INTEGRATED KRAKEN TRADER STARTING                  ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    try {
      // Authenticate
      const balances = await this.trader.authenticate();

      // Check for USD/EUR balance
      const usdBalance = balances["ZUSD"] || balances["USD"] || "0";
      console.log(`\nAvailable USD: ${usdBalance}\n`);

      // Check open orders
      const openOrders = await this.trader.getOpenOrders(this.pair);
      if (Object.keys(openOrders).length > 0) {
        console.log(
          `⚠️ Found ${Object.keys(openOrders).length} open orders for ${this.pair}`
        );
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

      if (this.priceHistory.length > 100) {
        this.priceHistory.shift();
      }

      // Generate signal from AI
      const signal = this.aiTrading.executeSignal(this.priceHistory);

      if (!signal || signal.action === "HOLD") {
        return;
      }

      console.log(`\n🎯 AI Signal: ${signal.action}`);
      console.log(`   Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
      console.log(`   Reason: ${signal.reason}`);

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
      const balance = await this.trader.getAssetBalance("USD");

      if (balance < price) {
        console.warn("⚠️ Insufficient balance for buy order");
        return;
      }

      const amountToUse = balance * 0.9;
      const quantity = (amountToUse / price).toFixed(8);

      if (parseFloat(quantity) <= 0) {
        console.warn("⚠️ Calculated quantity is 0");
        return;
      }

      const order = await this.trader.placeMarketOrder(
        this.pair,
        "buy",
        quantity
      );

      if (order.txid && order.txid.length > 0) {
        this.aiTrading.recordTrade(true);
        this.trader.updateSessionMetrics(balance - amountToUse);
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
      const baseAsset = this.pair.substring(0, 4); // e.g., "XXBT" from "XBTUSDT"
      const balance = await this.trader.getAssetBalance(baseAsset);

      if (balance <= 0) {
        console.warn("⚠️ No coins available to sell");
        return;
      }

      const quantity = balance.toFixed(8);

      const order = await this.trader.placeMarketOrder(
        this.pair,
        "sell",
        quantity
      );

      if (order.txid && order.txid.length > 0) {
        const proceeds = balance * price;
        this.aiTrading.recordTrade(true);
        this.trader.updateSessionMetrics(proceeds);
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

export async function exampleKrakenTrading() {
  console.log("\n");
  console.log("█████████████████████████████████████████████████████████████");
  console.log("█           AUTHENTICATED KRAKEN TRADER EXAMPLE               █");
  console.log("█████████████████████████████████████████████████████████████");

  const apiKey = process.env.KRAKEN_API_KEY;
  const apiSecret = process.env.KRAKEN_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error(
      "❌ Missing KRAKEN_API_KEY or KRAKEN_API_SECRET environment variables"
    );
    return;
  }

  const authConfig: KrakenAuthConfig = {
    apiKey,
    apiSecret,
  };

  const trader = new AuthenticatedKrakenTrader(authConfig, 1000);

  try {
    // Authenticate
    await trader.authenticate();

    // Get balance
    await trader.getAssetBalance("BTC");

    // Check open orders
    await trader.getOpenOrders("XBTUSDT");

    // Print session report
    trader.printSessionReport();
  } catch (error) {
    console.error("Error:", error);
  }
}
