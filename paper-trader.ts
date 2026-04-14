/**
 * Paper Trading System - Simulate trades without real money
 * Perfect for backtesting AI signals and learning
 */

// ============= TYPES =============

export interface Position {
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  quantity: number;
  entryTime: Date;
  orderId: string; // Simulated order ID
  highestPrice: number;
  lowestPrice: number;
  trailingStopPrice?: number;
}

export interface TradeResult {
  position: Position;
  exitPrice: number;
  exitTime: Date;
  profit: number;
  profitPercent: number;
  durationMs: number;
  result: "WIN" | "LOSS" | "BREAKEVEN";
}

export interface PaperTraderConfig {
  initialBalance: number;
  riskPerTrade?: number; // Percent of balance to risk (default: 2%)
  takeProfitPercent?: number; // Close trade at this profit (default: 0.5%)
  stopLossPercent?: number; // Close trade at this loss (default: 0.5%)
  maxPositions?: number; // Max concurrent positions (default: 1)
  trailingStopPercent?: number; // Trail distance in decimal (default: 0.4%)
  trailingActivationPercent?: number; // Profit threshold to activate trailing stop (default: 0.6%)
}

export interface PaperTraderStats {
  balance: number;
  initialBalance: number;
  equity: number;
  totalProfit: number;
  profitPercent: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number; // Total wins / Total losses
  openPositions: Position[];
  closedTrades: TradeResult[];
}

// ============= MAIN PAPER TRADER =============

export class PaperTrader {
  private balance: number;
  private initialBalance: number;
  private riskPerTrade: number;
  private takeProfitPercent: number;
  private stopLossPercent: number;
  private maxPositions: number;
  private trailingStopPercent: number;
  private trailingActivationPercent: number;

  private positions: Map<string, Position> = new Map();
  private closedTrades: TradeResult[] = [];
  private tradeIdCounter: number = 0;

  // Statistics
  private stats = {
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
  };

  constructor(config: PaperTraderConfig) {
    this.initialBalance = config.initialBalance;
    this.balance = config.initialBalance;
    this.riskPerTrade = config.riskPerTrade ?? 0.02;
    this.takeProfitPercent = config.takeProfitPercent ?? 0.005;
    this.stopLossPercent = config.stopLossPercent ?? 0.005;
    this.maxPositions = config.maxPositions ?? 1;
    this.trailingStopPercent = config.trailingStopPercent ?? 0.004;
    this.trailingActivationPercent = config.trailingActivationPercent ?? 0.006;
  }

  /**
   * Open a new position
   */
  openPosition(
    symbol: string,
    side: "BUY" | "SELL",
    entryPrice: number,
    quantity?: number
  ): Position | null {
    // Check if position already exists
    if (this.positions.has(symbol)) {
      console.warn(`Position already open for ${symbol}`);
      return null;
    }

    // Check max positions
    if (this.positions.size >= this.maxPositions) {
      console.warn(`Max positions (${this.maxPositions}) reached`);
      return null;
    }

    // Calculate quantity if not provided
    if (!quantity) {
      const riskAmount = this.balance * this.riskPerTrade;
      const stopLoss = entryPrice * this.stopLossPercent;
      quantity = Math.floor(riskAmount / stopLoss);

      if (quantity === 0) {
        console.warn("Quantity too small - balance too low");
        return null;
      }
    }

    const position: Position = {
      symbol,
      side,
      entryPrice,
      quantity,
      entryTime: new Date(),
      orderId: `SIM-${++this.tradeIdCounter}`,
      highestPrice: entryPrice,
      lowestPrice: entryPrice,
    };

    this.positions.set(symbol, position);
    console.log(
      `[PAPER] Opened ${side} position: ${symbol} @ ${entryPrice} x ${quantity}`
    );

    return position;
  }

  /**
   * Check and potentially close position based on current price
   * Returns null if position still open, TradeResult if closed
   */
  checkPosition(symbol: string, currentPrice: number): TradeResult | null {
    return this.checkPositionWithVolatility(symbol, currentPrice, 1);
  }

  /**
   * Check position with volatility-adaptive take profit.
   * volatilityFactor = 1 means base TP.
   */
  checkPositionWithVolatility(
    symbol: string,
    currentPrice: number,
    volatilityFactor: number
  ): TradeResult | null {
    const position = this.positions.get(symbol);
    if (!position) {
      return null;
    }

    // Calculate P&L
    let profitPercent = 0;

    if (position.side === "BUY") {
      profitPercent = (currentPrice - position.entryPrice) / position.entryPrice;
    } else {
      // SELL
      profitPercent = (position.entryPrice - currentPrice) / position.entryPrice;
    }

    // Check if should close position
    let shouldClose = false;
    let trailingStopTriggered = false;
    const dynamicTakeProfit = this.takeProfitPercent * Math.max(0.6, Math.min(2.2, volatilityFactor));

    // Update trailing references and trailing stop price.
    if (position.side === "BUY") {
      position.highestPrice = Math.max(position.highestPrice, currentPrice);
      if (profitPercent >= this.trailingActivationPercent) {
        const candidate = position.highestPrice * (1 - this.trailingStopPercent);
        position.trailingStopPrice = Math.max(position.trailingStopPrice ?? 0, candidate);
        if (currentPrice <= (position.trailingStopPrice ?? 0)) {
          shouldClose = true;
          trailingStopTriggered = true;
        }
      }
    } else {
      position.lowestPrice = Math.min(position.lowestPrice, currentPrice);
      if (profitPercent >= this.trailingActivationPercent) {
        const candidate = position.lowestPrice * (1 + this.trailingStopPercent);
        const existing = position.trailingStopPrice ?? Number.POSITIVE_INFINITY;
        position.trailingStopPrice = Math.min(existing, candidate);
        if (currentPrice >= (position.trailingStopPrice ?? Number.POSITIVE_INFINITY)) {
          shouldClose = true;
          trailingStopTriggered = true;
        }
      }
    }

    if (Math.abs(profitPercent) >= dynamicTakeProfit) {
      // Hit take profit
      shouldClose = true;
    } else if (Math.abs(profitPercent) >= this.stopLossPercent && profitPercent < 0) {
      // Hit stop loss
      shouldClose = true;
    }

    if (!shouldClose) {
      return null;
    }

    if (trailingStopTriggered) {
      console.log(`[PAPER] Trailing stop hit for ${symbol} @ ${currentPrice}`);
    }

    // Close position
    return this.closePosition(symbol, currentPrice);
  }

  /**
   * Close position at specific price
   */
  closePosition(symbol: string, exitPrice: number): TradeResult | null {
    const position = this.positions.get(symbol);
    if (!position) {
      return null;
    }

    // Calculate profit
    let profit = 0;

    if (position.side === "BUY") {
      profit = (exitPrice - position.entryPrice) * position.quantity;
    } else {
      // SELL
      profit = (position.entryPrice - exitPrice) * position.quantity;
    }

    const profitPercent =
      profit / (position.entryPrice * position.quantity);
    const exitTime = new Date();
    const durationMs = exitTime.getTime() - position.entryTime.getTime();

    const result: TradeResult = {
      position,
      exitPrice,
      exitTime,
      profit,
      profitPercent,
      durationMs,
      result: profit > 0 ? "WIN" : profit < 0 ? "LOSS" : "BREAKEVEN",
    };

    // Update balance
    this.balance += profit;

    // Update stats
    this.stats.totalTrades++;
    if (result.result === "WIN") {
      this.stats.winTrades++;
    } else if (result.result === "LOSS") {
      this.stats.lossTrades++;
    }

    // Store result
    this.closedTrades.push(result);

    // Remove position
    this.positions.delete(symbol);

    console.log(
      `[PAPER] Closed ${position.side} position: ${symbol} @ ${exitPrice} - ${result.result} (+${result.profit.toFixed(
        2
      )})`
    );

    return result;
  }

  /**
   * Force close all open positions
   */
  closeAllPositions(currentPrices: Map<string, number>): TradeResult[] {
    const closedResults: TradeResult[] = [];

    for (const [symbol, position] of this.positions.entries()) {
      const price = currentPrices.get(symbol);
      if (price !== undefined) {
        const result = this.closePosition(symbol, price);
        if (result) {
          closedResults.push(result);
        }
      }
    }

    return closedResults;
  }

  /**
   * Get current unrealized P&L for open positions
   */
  getUnrealizedPnL(currentPrices: Map<string, number>): number {
    let unrealizedPnL = 0;

    for (const [symbol, position] of this.positions.entries()) {
      const price = currentPrices.get(symbol);
      if (price === undefined) continue;

      if (position.side === "BUY") {
        unrealizedPnL += (price - position.entryPrice) * position.quantity;
      } else {
        unrealizedPnL += (position.entryPrice - price) * position.quantity;
      }
    }

    return unrealizedPnL;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(currentPrices?: Map<string, number>): PaperTraderStats {
    const unrealizedPnL = currentPrices
      ? this.getUnrealizedPnL(currentPrices)
      : 0;
    const equity = this.balance + unrealizedPnL;
    const totalProfit = equity - this.initialBalance;
    const profitPercent =
      (totalProfit / this.initialBalance) * 100;

    // Calculate win rate
    const totalTrades = this.stats.totalTrades;
    const winRate = totalTrades > 0 ? (this.stats.winTrades / totalTrades) * 100 : 0;

    // Calculate average win/loss
    const wins = this.closedTrades.filter((t) => t.result === "WIN");
    const losses = this.closedTrades.filter((t) => t.result === "LOSS");
    const averageWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.profit, 0) / losses.length : 0;
    const profitFactor = averageLoss !== 0 ? Math.abs(averageWin / averageLoss) : 0;

    return {
      balance: this.balance,
      initialBalance: this.initialBalance,
      equity,
      totalProfit,
      profitPercent,
      totalTrades,
      winTrades: this.stats.winTrades,
      lossTrades: this.stats.lossTrades,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      openPositions: Array.from(this.positions.values()),
      closedTrades: this.closedTrades,
    };
  }

  /**
   * Get balance
   */
  getBalance(): number {
    return this.balance;
  }

  /**
   * Get open position for symbol
   */
  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  /**
   * Get all open positions
   */
  getOpenPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get closed trades
   */
  getClosedTrades(): TradeResult[] {
    return this.closedTrades;
  }

  /**
   * Reset paper trader
   */
  reset(): void {
    this.balance = this.initialBalance;
    this.positions.clear();
    this.closedTrades = [];
    this.stats = {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
    };
    this.tradeIdCounter = 0;
    console.log("[PAPER] Reset trader - balance: " + this.initialBalance);
  }
}

// ============= EXAMPLE USAGE =============

export async function examplePaperTrading() {
  const trader = new PaperTrader({
    initialBalance: 1000,
    riskPerTrade: 0.02,
    takeProfitPercent: 0.005, // 0.5%
    stopLossPercent: 0.005, // 0.5%
  });

  // Simulate price movements and trades
  const symbol = "ETHUSDT";

  // Open position
  trader.openPosition(symbol, "BUY", 2000);

  // Simulate price going up
  let result = trader.checkPosition(symbol, 2005); // 0.25% gain
  if (result) {
    console.log(`Trade closed with ${result.profit} profit`);
  }

  // Get stats
  const stats = trader.getStats();
  console.log(`Balance: $${stats.balance.toFixed(2)}`);
  console.log(`Total Profit: $${stats.totalProfit.toFixed(2)}`);
  console.log(`Win Rate: ${stats.winRate.toFixed(1)}%`);
}
