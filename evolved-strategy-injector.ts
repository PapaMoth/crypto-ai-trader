/**
 * Evolved Strategy Auto-Injection
 * Automatically deploy best evolved genes into live trading AI
 */

import { StrategyGenes } from "./strategy-evolution";
import { AIEngine, AISignal } from "./ai-backtest";
import {
  calculateRSI,
  bollingerBands,
  movingAverage,
  exponentialMovingAverage,
  detectTrend,
  Trend,
} from "./indicators";

// ============= EVOLVED STRATEGY ENGINE =============

export class EvolvedStrategyEngine implements AIEngine {
  constructor(private genes: StrategyGenes) {
    console.log("[STRATEGY] Loaded evolved strategy with genes:");
    console.log(`  RSI Period: ${genes.rsiPeriod}`);
    console.log(`  RSI Buy: ${genes.rsiBuyThreshold}, Sell: ${genes.rsiSellThreshold}`);
    console.log(`  BB Period: ${genes.bBandsPeriod}, StdDev: ${genes.bbStdDev}`);
    console.log(`  MA Period: ${genes.maPeriod}`);
    console.log(`  TP: ${(genes.takeProfitPercent * 100).toFixed(2)}%, SL: ${(genes.stopLossPercent * 100).toFixed(2)}%`);
  }

  generateSignal(prices: number[]): AISignal {
    if (prices.length < Math.max(this.genes.rsiPeriod, this.genes.bBandsPeriod, this.genes.maPeriod)) {
      return { action: "HOLD", confidence: 0, reason: "Insufficient price data" };
    }

    // Calculate indicators using evolved genes
    const rsi = calculateRSI(prices, this.genes.rsiPeriod);
    const bb = bollingerBands(prices, this.genes.bBandsPeriod, this.genes.bbStdDev);
    const ma = movingAverage(prices, this.genes.maPeriod);
    const trend = detectTrend(prices, this.genes.maPeriod);
    const price = prices[prices.length - 1];

    let action: "BUY" | "SELL" | "HOLD" = "HOLD";
    let confidence = 0.5;
    let reason = "No clear signal";

    // Buy conditions
    if (rsi < this.genes.rsiBuyThreshold && price < bb.lower && trend === Trend.UPTREND) {
      action = "BUY";
      confidence = 0.95;
      reason = `RSI oversold (${rsi.toFixed(1)}) + Price below lower BB + Uptrend`;
    } else if (rsi < this.genes.rsiBuyThreshold && price < ma) {
      action = "BUY";
      confidence = 0.75;
      reason = `RSI oversold (${rsi.toFixed(1)}) + Price below MA`;
    }

    // Sell conditions
    if (rsi > this.genes.rsiSellThreshold && price > bb.upper && trend === Trend.DOWNTREND) {
      action = "SELL";
      confidence = 0.95;
      reason = `RSI overbought (${rsi.toFixed(1)}) + Price above upper BB + Downtrend`;
    } else if (rsi > this.genes.rsiSellThreshold && price > ma) {
      action = "SELL";
      confidence = 0.75;
      reason = `RSI overbought (${rsi.toFixed(1)}) + Price above MA`;
    }

    return {
      action,
      confidence,
      reason,
    };
  }

  updateWeights(): void {
    // Evolved strategy doesn't learn - parameters are fixed
  }

  getGenes(): StrategyGenes {
    return { ...this.genes };
  }
}

// ============= INJECTOR: APPLY EVOLVED STRATEGY TO LIVE SYSTEM =============

export interface InjectionConfig {
  strategyName: string;
  evolvedGenes: StrategyGenes;
  backupGenes?: StrategyGenes;
  autoRollback: boolean;
  performanceThreshold: number; // Min acceptable win rate
}

export class EvolvedStrategyInjector {
  private activeEngine: EvolvedStrategyEngine | null = null;
  private config: InjectionConfig;
  private performanceMetrics = {
    tradesExecuted: 0,
    winsCount: 0,
    lossesCount: 0,
  };

  constructor(config: InjectionConfig) {
    this.config = config;
  }

  /**
   * Deploy evolved strategy to live trading
   */
  inject(): EvolvedStrategyEngine {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║           DEPLOYING EVOLVED STRATEGY                     ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    this.activeEngine = new EvolvedStrategyEngine(this.config.evolvedGenes);

    console.log(`✅ Strategy injected: ${this.config.strategyName}`);
    console.log(`Strategy engine: ${this.activeEngine.constructor.name}`);
    console.log(`Auto-rollback: ${this.config.autoRollback ? "ENABLED" : "DISABLED"}`);
    console.log(`Performance threshold: ${this.config.performanceThreshold}% win rate\n`);

    return this.activeEngine;
  }

  /**
   * Track trade execution
   */
  recordTrade(won: boolean): void {
    if (!this.activeEngine) return;

    this.performanceMetrics.tradesExecuted++;
    if (won) {
      this.performanceMetrics.winsCount++;
    } else {
      this.performanceMetrics.lossesCount++;
    }

    const winRate = this.getWinRate();

    // Auto-rollback if performance drops below threshold
    if (this.config.autoRollback && winRate < this.config.performanceThreshold) {
      console.warn(
        `⚠️ Performance dropped below threshold (${winRate.toFixed(1)}% < ${this.config.performanceThreshold}%)`
      );
      console.warn("🔄 Triggering auto-rollback to backup strategy...");
      this.rollback();
    }
  }

  /**
   * Rollback to backup genes
   */
  rollback(): void {
    if (!this.config.backupGenes) {
      console.error("❌ No backup genes available for rollback");
      return;
    }

    console.log("Rolling back to backup strategy...");
    this.activeEngine = new EvolvedStrategyEngine(this.config.backupGenes);
    console.log("✅ Rollback complete");
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      ...this.performanceMetrics,
      winRate: this.getWinRate(),
      lossRate: this.getLossRate(),
    };
  }

  private getWinRate(): number {
    if (this.performanceMetrics.tradesExecuted === 0) return 0;
    return (this.performanceMetrics.winsCount / this.performanceMetrics.tradesExecuted) * 100;
  }

  private getLossRate(): number {
    if (this.performanceMetrics.tradesExecuted === 0) return 0;
    return (this.performanceMetrics.lossesCount / this.performanceMetrics.tradesExecuted) * 100;
  }

  /**
   * Get active strategy engine
   */
  getEngine(): EvolvedStrategyEngine | null {
    return this.activeEngine;
  }
}

// ============= STRATEGY SELECTOR: BEST OF EVOLVED + BUILT-IN =============

export interface StrategyComparison {
  evolvedScore: number;
  builtInBestScore: number;
  winner: "EVOLVED" | "BUILTIN";
  recommendation: string;
}

export async function selectBestStrategy(
  evolvedGenes: StrategyGenes,
  evolvedFitness: number,
  builtInPerformance: any // From compareStrategies result
): Promise<StrategyComparison> {
  const builtInBest = builtInPerformance.bestStrategy;

  const comparison: StrategyComparison = {
    evolvedScore: evolvedFitness,
    builtInBestScore: builtInBest.score,
    winner: evolvedFitness > builtInBest.score ? "EVOLVED" : "BUILTIN",
    recommendation: "",
  };

  if (comparison.winner === "EVOLVED") {
    const improvement = ((evolvedFitness - builtInBest.score) / builtInBest.score * 100);
    comparison.recommendation =
      `Evolved strategy is ${improvement.toFixed(1)}% better than ${builtInBest.strategy.name}. Deploy evolved strategy.`;
  } else {
    const difference = builtInBest.score - evolvedFitness;
    comparison.recommendation =
      `${builtInBest.strategy.name} outperforms evolved strategy by ${difference.toFixed(1)} points. Keep using built-in strategy.`;
  }

  return comparison;
}

// ============= LIVE TRADING WITH AUTO-INJECTED STRATEGY =============

export interface LiveTradingConfig {
  symbol: string;
  initialBalance: number;
  evolvedGenes: StrategyGenes;
  autoRollback: boolean;
  performanceThreshold: number;
  strategyName: string;
}

export class LiveTradingWithEvolvedStrategy {
  private injector: EvolvedStrategyInjector;
  private engine: EvolvedStrategyEngine | null = null;

  constructor(private config: LiveTradingConfig) {
    this.injector = new EvolvedStrategyInjector({
      strategyName: config.strategyName,
      evolvedGenes: config.evolvedGenes,
      autoRollback: config.autoRollback,
      performanceThreshold: config.performanceThreshold,
    });
  }

  /**
   * Start live trading with evolved strategy
   */
  start(): EvolvedStrategyEngine {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║           LIVE TRADING INITIALIZED                       ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    this.engine = this.injector.inject();

    console.log(`Symbol: ${this.config.symbol}`);
    console.log(`Initial Balance: $${this.config.initialBalance}`);
    console.log(`Strategy: ${this.config.strategyName}`);
    console.log("\n✅ Ready to trade!\n");

    return this.engine;
  }

  /**
   * Execute trading signal
   */
  executeSignal(prices: number[]): AISignal | null {
    if (!this.engine) {
      console.error("Strategy not initialized. Call start() first.");
      return null;
    }

    const signal = this.engine.generateSignal(prices);
    console.log(`[${new Date().toISOString()}] Signal: ${signal.action}`);
    console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
    console.log(`  Reason: ${signal.reason}`);

    return signal;
  }

  /**
   * Record trade result
   */
  recordTrade(won: boolean): void {
    this.injector.recordTrade(won);
    const metrics = this.injector.getMetrics();
    console.log(
      `[METRICS] Trades: ${metrics.tradesExecuted} | Win Rate: ${metrics.winRate.toFixed(1)}%`
    );
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return this.injector.getMetrics();
  }

  /**
   * Get strategy genes
   */
  getStrategies(): StrategyGenes {
    if (!this.engine) throw new Error("Engine not initialized");
    return this.engine.getGenes();
  }
}

// ============= EXAMPLE: AUTO-INJECTION WORKFLOW =============

export async function exampleAutoInjection() {
  // Example evolved genes (from genetic algorithm)
  const evolvedGenes: StrategyGenes = {
    rsiPeriod: 16,
    rsiBuyThreshold: 28,
    rsiSellThreshold: 72,
    bBandsPeriod: 18,
    bbStdDev: 2.1,
    maPeriod: 22,
    maTypeShort: 0,
    maTypeLong: 1,
    takeProfitPercent: 0.0055,
    stopLossPercent: 0.0045,
    riskPerTrade: 0.025,
  };

  // Initialize live trading system
  const liveTrading = new LiveTradingWithEvolvedStrategy({
    symbol: "BTCUSDT",
    initialBalance: 10000,
    evolvedGenes,
    autoRollback: true,
    performanceThreshold: 50, // Min 50% win rate
    strategyName: "GA-Optimized Strategy v1",
  });

  // Start live trading
  liveTrading.start();

  // Simulate price data and trading
  const prices = [2000, 2005, 2010, 2008, 2012, 2015, 2020];
  for (const price of prices) {
    const signal = liveTrading.executeSignal([price]);

    if (signal?.action === "BUY" && Math.random() > 0.4) {
      liveTrading.recordTrade(true);
    } else if (signal?.action === "SELL" && Math.random() > 0.4) {
      liveTrading.recordTrade(false);
    }
  }

  // Get final metrics
  const metrics = liveTrading.getMetrics();
  console.log("\n📊 Final Metrics:", metrics);
}
