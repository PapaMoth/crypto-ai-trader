/**
 * AI Backtesting Engine - Professional grade backtesting with paper trading
 * Integrates AI signal generation with comprehensive statistics
 */

import { PaperTrader, TradeResult } from "./paper-trader";
import { detectMarket } from "./lib/marketCondition";

// ============= TYPES =============

export interface PriceBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface AISignal {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number; // 0-1
  reason?: string;
}

export interface BacktestConfig {
  initialBalance: number;
  lookbackPeriod?: number;
  minConfidence?: number;
  maxSlippage?: number; // % slippage to account for
  commission?: number;  // % commission per trade
  avoidSideways?: boolean;
}

export interface BacktestResult {
  // Balance
  initialBalance: number;
  finalBalance: number;
  totalProfit: number;
  profitPercent: number;

  // Trades
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;

  // Risk metrics
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;

  // Drawdown
  maxDrawdown: number;
  currentDrawdown: number;

  // Timing
  startTime: number;
  endTime: number;
  durationDays: number;

  // Detailed results
  trades: TradeResult[];
  equityCurve: EquityPoint[];
}

export interface EquityPoint {
  timestamp: number;
  balance: number;
  price: number;
  equity: number;
}

export interface AIEngine {
  generateSignal(prices: number[]): AISignal;
  updateWeights(result: "WIN" | "LOSS" | "BREAKEVEN"): void;
  reset?(): void;
}

// ============= BACKTEST ENGINE =============

export class AIBacktester {
  private trader: PaperTrader;
  private config: Required<BacktestConfig>;
  private equityCurve: EquityPoint[] = [];
  private balanceHistory: number[] = [];

  constructor(config: BacktestConfig) {
    this.config = {
      initialBalance: config.initialBalance,
      lookbackPeriod: config.lookbackPeriod ?? 20,
      minConfidence: config.minConfidence ?? 0.6,
      maxSlippage: config.maxSlippage ?? 0.001,
      commission: config.commission ?? 0,
      avoidSideways: config.avoidSideways ?? false,
    };

    this.trader = new PaperTrader({
      initialBalance: config.initialBalance,
      riskPerTrade: 0.02,
      takeProfitPercent: 0.005,
      stopLossPercent: 0.005,
      maxPositions: 1,
    });
  }

  /**
   * Run backtest on historical price data
   */
  async runBacktest(
    priceData: PriceBar[],
    aiEngine: AIEngine
  ): Promise<BacktestResult> {
    if (priceData.length < this.config.lookbackPeriod) {
      throw new Error(
        `Need at least ${this.config.lookbackPeriod} candles, got ${priceData.length}`
      );
    }

    this.equityCurve = [];
    this.balanceHistory = [];
    let highestBalance = this.config.initialBalance;

    // Start from lookback period
    for (
      let i = this.config.lookbackPeriod;
      i < priceData.length;
      i++
    ) {
      const currentBar = priceData[i];
      const previousBars = priceData.slice(
        i - this.config.lookbackPeriod,
        i
      );
      const closePrices = previousBars.map((bar) => bar.close);
      const market = detectMarket(closePrices);

      // Generate AI signal
      const signal = aiEngine.generateSignal(closePrices);
      const aiSignal = signal.action;

      if (market === "TREND_UP" && aiSignal === "SELL") {
        continue; // ignore bad trade against trend
      }

      if (market === "TREND_DOWN" && aiSignal === "BUY") {
        continue; // ignore bad trade against trend
      }

      if (market === "TREND_UP") {
        if (signal.action === "SELL") signal.action = "HOLD"; // only BUY signals
      } else if (market === "TREND_DOWN") {
        if (signal.action === "BUY") signal.action = "HOLD"; // only SELL signals
      } else if (market === "SIDEWAYS") {
        // Sideways fallback: simple RSI-like mean reversion proxy using
        // short-vs-long deviation when explicit RSI series is unavailable.
        const short = closePrices.slice(-5);
        const shortAvg = short.reduce((a, b) => a + b, 0) / short.length;
        const longAvg = closePrices.reduce((a, b) => a + b, 0) / closePrices.length;
        const deviation = longAvg > 0 ? (shortAvg - longAvg) / longAvg : 0;
        if (deviation <= -0.004) signal.action = "BUY";
        else if (deviation >= 0.004) signal.action = "SELL";
        else signal.action = "HOLD";
      }

      // Apply confidence filter
      if (signal.confidence < this.config.minConfidence) {
        signal.action = "HOLD";
      }

      if (this.config.avoidSideways && market === "SIDEWAYS") {
        signal.action = "HOLD";
      }

      // Get current price with slippage
      const tradePrice = this.applySlippage(
        currentBar.close,
        signal.action
      );

      // Check existing position
      const position = this.trader.getPosition("BACKTEST");

      // Execute trades
      if (signal.action === "BUY" && !position) {
        this.trader.openPosition("BACKTEST", "BUY", tradePrice);
      } else if (signal.action === "SELL" && !position) {
        this.trader.openPosition("BACKTEST", "SELL", tradePrice);
      }

      // Check if position closes
      if (position) {
        const volatilityFactor = this.calculateVolatilityFactor(previousBars);
        const result = this.trader.checkPositionWithVolatility("BACKTEST", tradePrice, volatilityFactor);

        if (result) {
          // Notify AI to learn from result
          aiEngine.updateWeights(result.result);
        }
      }

      // Record equity curve
      const balance = this.trader.getBalance();
      const stats = this.trader.getStats();

      this.balanceHistory.push(balance);

      if (balance > highestBalance) {
        highestBalance = balance;
      }

      this.equityCurve.push({
        timestamp: currentBar.timestamp,
        balance,
        price: currentBar.close,
        equity: balance,
      });
    }

    // Generate results
    return this.generateResults(
      priceData[0].timestamp,
      priceData[priceData.length - 1].timestamp
    );
  }

  /**
   * Volatility factor for dynamic TP.
   * 1.0 = normal, >1 = higher volatility, <1 = lower volatility.
   */
  private calculateVolatilityFactor(bars: PriceBar[]): number {
    if (bars.length < 2) return 1;
    const closes = bars.map((b) => b.close);
    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
    if (avgClose <= 0) return 1;

    let sumRangePct = 0;
    for (const bar of bars) {
      const rangePct = ((bar.high - bar.low) / avgClose);
      sumRangePct += rangePct;
    }
    const avgRangePct = sumRangePct / bars.length;

    // Normalize around ~0.8% candle range as baseline
    const baseline = 0.008;
    const factor = avgRangePct / baseline;
    return Math.max(0.6, Math.min(2.2, factor));
  }

  /**
   * Apply slippage to price
   */
  private applySlippage(price: number, action: string): number {
    const slippageAmount = price * this.config.maxSlippage;

    if (action === "BUY") {
      return price + slippageAmount; // Buy higher
    } else if (action === "SELL") {
      return price - slippageAmount; // Sell lower
    }

    return price;
  }

  /**
   * Generate comprehensive results
   */
  private generateResults(
    startTime: number,
    endTime: number
  ): BacktestResult {
    const stats = this.trader.getStats();
    const trades = stats.closedTrades;

    // Calculate drawdown
    let maxDrawdown = 0;
    let highestBalance = this.config.initialBalance;

    for (const balance of this.balanceHistory) {
      if (balance > highestBalance) {
        highestBalance = balance;
      }

      const drawdown = (highestBalance - balance) / highestBalance;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const currentDrawdown =
      (highestBalance - (this.balanceHistory[this.balanceHistory.length - 1] || this.config.initialBalance)) /
      highestBalance;

    // Calculate largest win/loss
    let largestWin = 0;
    let largestLoss = 0;

    for (const trade of trades) {
      if (trade.profit > largestWin) {
        largestWin = trade.profit;
      }
      if (trade.profit < largestLoss) {
        largestLoss = trade.profit;
      }
    }

    const durationDays = (endTime - startTime) / (1000 * 60 * 60 * 24);

    return {
      // Balance
      initialBalance: this.config.initialBalance,
      finalBalance: stats.balance,
      totalProfit: stats.totalProfit,
      profitPercent: stats.profitPercent,

      // Trades
      totalTrades: stats.totalTrades,
      winTrades: stats.winTrades,
      lossTrades: stats.lossTrades,
      winRate: stats.winRate,

      // Risk metrics
      averageWin: stats.averageWin,
      averageLoss: stats.averageLoss,
      profitFactor: stats.profitFactor,
      largestWin,
      largestLoss,

      // Drawdown
      maxDrawdown: maxDrawdown * 100,
      currentDrawdown: currentDrawdown * 100,

      // Timing
      startTime,
      endTime,
      durationDays,

      // Detailed results
      trades,
      equityCurve: this.equityCurve,
    };
  }

  /**
   * Reset backtest
   */
  reset(): void {
    this.trader.reset();
    this.equityCurve = [];
    this.balanceHistory = [];
  }

  /**
   * Get equity curve for visualization
   */
  getEquityCurve(): EquityPoint[] {
    return this.equityCurve;
  }
}

// ============= EXAMPLE =============

export async function exampleBacktest() {
  // Mock AI engine
  class SimpleAI implements AIEngine {
    generateSignal(prices: number[]): AISignal {
      const avgShort = prices.slice(-5).reduce((a, b) => a + b) / 5;
      const avgLong = prices.reduce((a, b) => a + b) / prices.length;

      const confidence = Math.abs(avgShort - avgLong) / avgLong;

      if (avgShort > avgLong) {
        return { action: "BUY", confidence: Math.min(confidence, 1) };
      } else if (avgShort < avgLong) {
        return { action: "SELL", confidence: Math.min(confidence, 1) };
      }

      return { action: "HOLD", confidence: 0 };
    }

    updateWeights(result: "WIN" | "LOSS" | "BREAKEVEN"): void {
      // AI learns here
      console.log(`[AI] Learning from ${result}`);
    }
  }

  // Mock price data
  const priceData: PriceBar[] = [];
  let price = 2000;

  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.5) * 20;
    price += change;

    priceData.push({
      timestamp: Date.now() + i * 60000,
      open: price,
      high: price + 5,
      low: price - 5,
      close: price,
      volume: Math.random() * 1000,
    });
  }

  // Run backtest
  const backtest = new AIBacktester({ initialBalance: 1000 });
  const ai = new SimpleAI();

  const result = await backtest.runBacktest(priceData, ai);

  console.log("\n=== BACKTEST RESULTS ===");
  console.log(`Initial Balance: $${result.initialBalance}`);
  console.log(`Final Balance: $${result.finalBalance.toFixed(2)}`);
  console.log(`Total Profit: $${result.totalProfit.toFixed(2)}`);
  console.log(`Profit %: ${result.profitPercent.toFixed(2)}%`);
  console.log(`\nTrades:`);
  console.log(`  Total: ${result.totalTrades}`);
  console.log(`  Wins: ${result.winTrades}`);
  console.log(`  Losses: ${result.lossTrades}`);
  console.log(`  Win Rate: ${result.winRate.toFixed(1)}%`);
  console.log(`\nRisk Metrics:`);
  console.log(`  Avg Win: $${result.averageWin.toFixed(2)}`);
  console.log(`  Avg Loss: $${result.averageLoss.toFixed(2)}`);
  console.log(`  Profit Factor: ${result.profitFactor.toFixed(2)}`);
  console.log(`  Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
  console.log(`\nDuration: ${result.durationDays.toFixed(1)} days`);
}
