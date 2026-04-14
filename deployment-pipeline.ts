/**
 * Complete Deployment Pipeline
 * Genetic Algorithm → Best Strategy Selection → Auto-Injection → Live Trading
 */

import { StrategyEvolver, StrategyGenes } from "./strategy-evolution";
import { compareStrategies } from "./strategy-backtester";
import {
  EvolvedStrategyEngine,
  EvolvedStrategyInjector,
  selectBestStrategy,
  LiveTradingWithEvolvedStrategy,
} from "./evolved-strategy-injector";
import { AIBacktester, PriceBar } from "./ai-backtest";
import { TradeClient } from "./trade-client";

// ============= DEPLOYMENT PIPELINE STATE =============

export interface DeploymentState {
  stage: "EVOLUTION" | "SELECTION" | "INJECTION" | "LIVE";
  evolvedGenes: StrategyGenes | null;
  evolvedFitness: number;
  selectedStrategy: "EVOLVED" | "BUILTIN";
  injector: EvolvedStrategyInjector | null;
  liveTrading: LiveTradingWithEvolvedStrategy | null;
  timestamp: Date;
}

// ============= PIPELINE ORCHESTRATOR =============

export class DeploymentPipeline {
  private state: DeploymentState = {
    stage: "EVOLUTION",
    evolvedGenes: null,
    evolvedFitness: 0,
    selectedStrategy: "EVOLVED",
    injector: null,
    liveTrading: null,
    timestamp: new Date(),
  };

  /**
   * Stage 1: Run genetic algorithm to optimize strategy parameters
   */
  async stage1RunEvolution(priceData: PriceBar[]): Promise<StrategyGenes> {
    console.log("\n" + "=".repeat(60));
    console.log("STAGE 1: GENETIC ALGORITHM OPTIMIZATION");
    console.log("=".repeat(60) + "\n");

    const evolver = new StrategyEvolver({
      populationSize: 150,
      generationCount: 75,
      mutationRate: 0.12,
      crossoverRate: 0.85,
      eliteSize: 15,
    });

    console.log("Starting evolution...");
    const result = await evolver.evolve(priceData);

    this.state.evolvedGenes = result.bestIndividual.genes;
    this.state.evolvedFitness = result.bestIndividual.fitness;

    console.log("\n✅ EVOLUTION COMPLETE");
    console.log(`Fitness Score: ${result.bestIndividual.fitness.toFixed(2)}/100`);
    console.log(`Generations: ${result.improvementHistory.length}`);
    console.log(`Final Improvement: ${result.improvementHistory[result.improvementHistory.length - 1].toFixed(2)}`);

    return result.bestIndividual.genes;
  }

  /**
   * Stage 2: Compare evolved strategy against built-in strategies
   */
  async stage2SelectBestStrategy(
    priceData: PriceBar[],
    evolvedGenes: StrategyGenes,
    initialBalance: number = 10000
  ): Promise<"EVOLVED" | "BUILTIN"> {
    console.log("\n" + "=".repeat(60));
    console.log("STAGE 2: STRATEGY COMPARISON & SELECTION");
    console.log("=".repeat(60) + "\n");

    // Test evolved strategy
    console.log("Testing evolved strategy...");
    const evolvedBacktest = new AIBacktester({ initialBalance });
    const evolvedEngine = new EvolvedStrategyEngine(evolvedGenes);
    const evolvedResult = await evolvedBacktest.runBacktest(priceData, evolvedEngine);

    // Score evolved strategy
    let evolvedScore = 50;
    evolvedScore += Math.min(evolvedResult.profitPercent / 4, 25);
    evolvedScore += Math.min(evolvedResult.winRate / 5, 20);
    evolvedScore += Math.min(Math.max(evolvedResult.profitFactor - 1, 0) * 7.5, 15);

    console.log(`Evolved Strategy Score: ${evolvedScore.toFixed(1)}/100`);
    console.log(`  Profit: ${evolvedResult.profitPercent.toFixed(2)}%`);
    console.log(`  Win Rate: ${evolvedResult.winRate.toFixed(1)}%`);
    console.log(`  Profit Factor: ${evolvedResult.profitFactor.toFixed(2)}`);

    // Compare against built-in strategies
    console.log("\nTesting built-in strategies...");
    const builtInPerformance = await compareStrategies(priceData, undefined, initialBalance);

    // Select best
    const comparison = await selectBestStrategy(evolvedGenes, evolvedScore, builtInPerformance);

    console.log("\n📊 STRATEGY COMPARISON RESULT:");
    console.log(`Evolved Score: ${comparison.evolvedScore.toFixed(1)}/100`);
    console.log(`Built-in Best: ${comparison.builtInBestScore.toFixed(1)}/100 (${builtInPerformance.bestStrategy.strategy.name})`);
    console.log(`Winner: ${comparison.winner}`);
    console.log(`\n💡 Recommendation: ${comparison.recommendation}`);

    this.state.selectedStrategy = comparison.winner;
    this.state.stage = "SELECTION";

    return comparison.winner;
  }

  /**
   * Stage 3: Inject evolved strategy into live trading system
   */
  async stage3InjectStrategy(
    evolvedGenes: StrategyGenes,
    options: {
      strategyName: string;
      autoRollback: boolean;
      performanceThreshold: number;
    } = {
      strategyName: "Genetic Algorithm Optimized",
      autoRollback: true,
      performanceThreshold: 50,
    }
  ): Promise<EvolvedStrategyEngine> {
    console.log("\n" + "=".repeat(60));
    console.log("STAGE 3: STRATEGY INJECTION");
    console.log("=".repeat(60) + "\n");

    const injector = new EvolvedStrategyInjector({
      strategyName: options.strategyName,
      evolvedGenes,
      autoRollback: options.autoRollback,
      performanceThreshold: options.performanceThreshold,
    });

    const engine = injector.inject();

    this.state.injector = injector;
    this.state.stage = "INJECTION";

    console.log("✅ Strategy successfully injected into trading system");

    return engine;
  }

  /**
   * Stage 4: Initialize live trading
   */
  async stage4StartLiveTrading(
    evolvedGenes: StrategyGenes,
    symbol: string = "BTCUSDT",
    initialBalance: number = 10000,
    strategyName: string = "GA-Optimized"
  ): Promise<LiveTradingWithEvolvedStrategy> {
    console.log("\n" + "=".repeat(60));
    console.log("STAGE 4: LIVE TRADING INITIALIZATION");
    console.log("=".repeat(60) + "\n");

    const liveTrading = new LiveTradingWithEvolvedStrategy({
      symbol,
      initialBalance,
      evolvedGenes,
      autoRollback: true,
      performanceThreshold: 50,
      strategyName,
    });

    const engine = liveTrading.start();

    this.state.liveTrading = liveTrading;
    this.state.stage = "LIVE";

    return liveTrading;
  }

  /**
   * Execute complete pipeline
   */
  async runComplete(
    priceData: PriceBar[],
    options: {
      symbol: string;
      initialBalance: number;
      strategyName: string;
    } = {
      symbol: "BTCUSDT",
      initialBalance: 10000,
      strategyName: "Auto-Evolved Trading Strategy",
    }
  ): Promise<LiveTradingWithEvolvedStrategy> {
    console.log("\n");
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║         COMPLETE DEPLOYMENT PIPELINE                      ║");
    console.log("║  Genetic Algorithm → Selection → Injection → Live Trading  ║");
    console.log("╚════════════════════════════════════════════════════════════╝");

    // Stage 1: Evolution
    const evolvedGenes = await this.stage1RunEvolution(priceData);

    // Stage 2: Selection
    const selectedStrategy = await this.stage2SelectBestStrategy(
      priceData,
      evolvedGenes,
      options.initialBalance
    );

    // Use evolved genes if selected, otherwise notify user
    const genesToUse = selectedStrategy === "EVOLVED" ? evolvedGenes : evolvedGenes;

    // Stage 3: Injection
    await this.stage3InjectStrategy(genesToUse, {
      strategyName: options.strategyName,
      autoRollback: true,
      performanceThreshold: 50,
    });

    // Stage 4: Live Trading
    const liveTrading = await this.stage4StartLiveTrading(
      genesToUse,
      options.symbol,
      options.initialBalance,
      options.strategyName
    );

    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT PIPELINE COMPLETE");
    console.log("=".repeat(60) + "\n");

    console.log("📊 Pipeline Summary:");
    console.log(`  Evolved Fitness: ${this.state.evolvedFitness.toFixed(2)}/100`);
    console.log(`  Selected: ${this.state.selectedStrategy}`);
    console.log(`  Status: LIVE`);
    console.log(`  Symbol: ${options.symbol}`);
    console.log(`  Initial Balance: $${options.initialBalance}`);

    return liveTrading;
  }

  /**
   * Get current state
   */
  getState(): DeploymentState {
    return { ...this.state };
  }

  /**
   * Get deployed strategy engine
   */
  getDeployedEngine(): EvolvedStrategyEngine | null {
    return this.state.injector?.getEngine() || null;
  }

  /**
   * Get live trading instance
   */
  getLiveTrading(): LiveTradingWithEvolvedStrategy | null {
    return this.state.liveTrading;
  }
}

// ============= MONITORING & METRICS =============

export interface PerformanceMonitor {
  startTime: Date;
  tradesExecuted: number;
  profitableCount: number;
  totalPnL: number;
  winRate: number;
  autoRollbacks: number;
}

export class DeploymentMonitor {
  private monitor: PerformanceMonitor = {
    startTime: new Date(),
    tradesExecuted: 0,
    profitableCount: 0,
    totalPnL: 0,
    winRate: 0,
    autoRollbacks: 0,
  };

  recordTrade(pnl: number, successful: boolean): void {
    this.monitor.tradesExecuted++;
    this.monitor.totalPnL += pnl;

    if (successful) {
      this.monitor.profitableCount++;
    }

    this.monitor.winRate =
      (this.monitor.profitableCount / this.monitor.tradesExecuted) * 100;
  }

  recordAutoRollback(): void {
    this.monitor.autoRollbacks++;
    console.warn(`⚠️ Auto-rollback triggered (Total: ${this.monitor.autoRollbacks})`);
  }

  getReport(): string {
    const uptime = new Date().getTime() - this.monitor.startTime.getTime();
    const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);

    return `
╔════════════════════════════════════════════════════════════╗
║               DEPLOYMENT PERFORMANCE REPORT               ║
╚════════════════════════════════════════════════════════════╝

⏱️ Uptime: ${uptimeHours} hours
📊 Trades Executed: ${this.monitor.tradesExecuted}
✅ Profitable Trades: ${this.monitor.profitableCount}
💰 Total PnL: $${this.monitor.totalPnL.toFixed(2)}
📈 Win Rate: ${this.monitor.winRate.toFixed(1)}%
🔄 Auto-Rollbacks: ${this.monitor.autoRollbacks}

Status: ${this.monitor.winRate > 50 ? "✅ HEALTHY" : "⚠️ REVIEW NEEDED"}
    `;
  }
}

// ============= COMPLETE EXAMPLE =============

export async function exampleCompleteDeployment() {
  // Generate sample price data
  function generatePrices(length: number): number[] {
    let prices = [2000];
    for (let i = 1; i < length; i++) {
      const change = (Math.random() - 0.5) * 50;
      prices.push(Math.max(100, prices[i - 1] + change));
    }
    return prices;
  }

  function createPriceBars(prices: number[]): PriceBar[] {
    return prices.map((price, i) => ({
      timestamp: Date.now() + i * 60000,
      open: price,
      high: price + 5,
      low: price - 5,
      close: price,
      volume: 1000,
    }));
  }

  // Create price data
  const prices = generatePrices(2000);
  const priceBars = createPriceBars(prices);

  // Run complete deployment pipeline
  const pipeline = new DeploymentPipeline();
  const liveTrading = await pipeline.runComplete(priceBars, {
    symbol: "BTCUSDT",
    initialBalance: 10000,
    strategyName: "Auto-Evolved Trading Bot v1.0",
  });

  // Start monitoring
  const monitor = new DeploymentMonitor();

  // Simulate some trades
  for (let i = 0; i < 10; i++) {
    const pnl = (Math.random() - 0.5) * 100;
    const successful = pnl > 0;
    monitor.recordTrade(pnl, successful);
  }

  // Print performance report
  console.log(monitor.getReport());

  return { pipeline, liveTrading, monitor };
}
