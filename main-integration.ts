/**
 * Complete Trading System Integration
 * End-to-end workflow: Evolution → Backtesting → Paper Trading → Live Deployment
 */

import { StrategyEvolver, DEFAULT_GENES, StrategyGenes } from "./strategy-evolution";
import { compareStrategies, generateComparisonReport } from "./strategy-backtester";
import { PaperTrader } from "./paper-trader";
import { TradeClient } from "./trade-client";
import { PriceBar } from "./ai-backtest";

// ============= PHASE 1: GENETIC EVOLUTION =============

export async function phase1EvolutionOptimization(priceData: PriceBar[]) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  PHASE 1: GENETIC ALGORITHM OPTIMIZATION                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const evolver = new StrategyEvolver({
    populationSize: 100,
    generationCount: 50,
    mutationRate: 0.15,
    crossoverRate: 0.8,
    eliteSize: 10,
  });

  const evolutionResult = await evolver.evolve(priceData);

  const bestGenes = evolutionResult.bestIndividual.genes;
  const bestFitness = evolutionResult.bestIndividual.fitness;
  const improvements = evolutionResult.improvementHistory;

  console.log("\n✅ EVOLUTION COMPLETE");
  console.log(`Final Fitness Score: ${bestFitness.toFixed(2)}/100`);
  console.log(`Total Generations: ${improvements.length}`);
  console.log(`Improvement Rate: ${((bestFitness - improvements[0]) / improvements[0] * 100).toFixed(1)}%\n`);

  console.log("Optimized Strategy Genes:");
  console.log(JSON.stringify(bestGenes, null, 2));

  return {
    genes: bestGenes,
    fitness: bestFitness,
    improvementHistory: improvements,
  };
}

// ============= PHASE 2: VALIDATION BACKTESTING =============

export async function phase2ValidationBacktest(priceData: PriceBar[]) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  PHASE 2: VALIDATION AGAINST BUILT-IN STRATEGIES        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const performance = await compareStrategies(priceData, undefined, 10000);
  const report = generateComparisonReport(performance);

  console.log(report);

  return performance;
}

// ============= PHASE 3: PAPER TRADING SIMULATION =============

export async function phase3PaperTradingSimulation(priceData: PriceBar[]) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  PHASE 3: PAPER TRADING SIMULATION (RISK-FREE)           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const paperTrader = new PaperTrader({
    initialBalance: 10000,
    takeProfitPercent: 0.02,
    stopLossPercent: 0.01,
    maxPositions: 5,
  });

  // Simulate trades using price data
  let lastSignalTime = 0;
  const signalInterval = 100; // Generate signal every 100 bars

  for (let i = 0; i < priceData.length; i++) {
    const bar = priceData[i];
    const prices = priceData.slice(0, i + 1).map((b) => b.close);

    // Generate signal every N bars
    if (i - lastSignalTime >= signalInterval && prices.length > 20) {
      const signal = generateTradeSignal(prices);

      if (signal === "BUY") {
        paperTrader.openTrade({
          symbol: "BTC/USDT",
          entryPrice: bar.close,
          quantity: 1,
          direction: "LONG",
        });
        lastSignalTime = i;
      }
    }

    // Check for take profit / stop loss
    paperTrader.checkTrades(bar.close);
  }

  const stats = paperTrader.getStats();

  console.log("\n📊 PAPER TRADING RESULTS");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`Initial Balance: $${stats.initialBalance.toFixed(2)}`);
  console.log(`Final Balance: $${stats.finalBalance.toFixed(2)}`);
  console.log(`Total Profit: $${stats.totalProfit.toFixed(2)}`);
  console.log(`Profit %: ${(stats.totalProfit / stats.initialBalance * 100).toFixed(2)}%`);
  console.log(`Total Trades: ${stats.totalTrades}`);
  console.log(`Win Rate: ${stats.winRate.toFixed(1)}%`);
  console.log(`Profit Factor: ${stats.profitFactor.toFixed(2)}`);
  console.log(`Max Drawdown: ${stats.maxDrawdown.toFixed(2)}%\n`);

  return paperTrader;
}

// ============= PHASE 4: LIVE DEPLOYMENT READINESS =============

export async function phase4LiveDeploymentCheck(
  optimizedGenes: StrategyGenes,
  paperTraderStats: any
) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  PHASE 4: LIVE DEPLOYMENT READINESS ASSESSMENT           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const checks = [];

  // Check 1: Profitability
  const profitableCheck = paperTraderStats.totalProfit > 0;
  checks.push({
    name: "Profitability",
    passed: profitableCheck,
    message: profitableCheck
      ? `✅ Strategy is profitable (${(paperTraderStats.totalProfit / paperTraderStats.initialBalance * 100).toFixed(2)}%)`
      : "❌ Strategy is unprofitable in backtest",
  });

  // Check 2: Win Rate
  const winRateCheck = paperTraderStats.winRate > 45;
  checks.push({
    name: "Win Rate",
    passed: winRateCheck,
    message: winRateCheck
      ? `✅ Win rate acceptable (${paperTraderStats.winRate.toFixed(1)}%)`
      : `⚠️ Win rate below 45% (${paperTraderStats.winRate.toFixed(1)}%)`,
  });

  // Check 3: Drawdown
  const drawdownCheck = paperTraderStats.maxDrawdown < 30;
  checks.push({
    name: "Max Drawdown",
    passed: drawdownCheck,
    message: drawdownCheck
      ? `✅ Drawdown acceptable (${paperTraderStats.maxDrawdown.toFixed(2)}%)`
      : `⚠️ High drawdown risk (${paperTraderStats.maxDrawdown.toFixed(2)}%)`,
  });

  // Check 4: Trade Frequency
  const frequencyCheck = paperTraderStats.totalTrades > 20;
  checks.push({
    name: "Trade Frequency",
    passed: frequencyCheck,
    message: frequencyCheck
      ? `✅ Sufficient trades (${paperTraderStats.totalTrades} trades)`
      : `⚠️ Low trade frequency (${paperTraderStats.totalTrades} trades)`,
  });

  // Check 5: Parameter Optimization
  const optimizationCheck = Object.values(optimizedGenes).some(
    (v: any) => Math.abs(v - DEFAULT_GENES[Object.keys(DEFAULT_GENES).find(
      k => DEFAULT_GENES[k as keyof StrategyGenes] === v
    ) as keyof StrategyGenes]) > 0.1
  );
  checks.push({
    name: "Optimization Quality",
    passed: optimizationCheck,
    message: optimizationCheck
      ? "✅ Genetic algorithm found optimized parameters"
      : "⚠️ Optimized genes similar to defaults",
  });

  console.log("READINESS CHECKS:");
  console.log("────────────────────────────────────────────────────────────");

  let passedCount = 0;
  for (const check of checks) {
    console.log(`${check.passed ? "✅" : "⚠️"} ${check.name}: ${check.message}`);
    if (check.passed) passedCount++;
  }

  const readinessScore = (passedCount / checks.length) * 100;
  console.log(`\nOverall Readiness: ${readinessScore.toFixed(0)}%`);

  if (readinessScore >= 80) {
    console.log("🚀 READY FOR LIVE TRADING (with small position size)");
  } else if (readinessScore >= 60) {
    console.log("⚠️ MARGINAL - More optimization recommended");
  } else {
    console.log("❌ NOT READY - Continue optimization");
  }

  return { checks, readinessScore };
}

// ============= PHASE 5: LIVE TRADING EXECUTION =============

export async function phase5LiveTrading(
  apiClient: TradeClient,
  symbol: string = "BTCUSDT"
) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  PHASE 5: LIVE TRADING EXECUTION                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log("⚠️ LIVE TRADING ENABLED");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`Symbol: ${symbol}`);
  console.log(`Client: ${apiClient.constructor.name}`);
  console.log(`Rate Limit Tracking: ENABLED`);
  console.log(`Exponential Backoff: ENABLED`);
  console.log(`Error Recovery: ENABLED\n`);

  // Example: Place a test trade
  console.log("Ready to execute trades. Use:");
  console.log("  - apiClient.executeTrade() for market orders");
  console.log("  - apiClient.setRateLimit() to adjust limits");
  console.log("  - apiClient.getRateLimitStatus() to check remaining quota\n");

  return apiClient;
}

// ============= UTILITY: TRADE SIGNAL GENERATOR =============

function generateTradeSignal(prices: number[]): "BUY" | "SELL" | "HOLD" {
  if (prices.length < 20) return "HOLD";

  // Simple momentum + trend following
  const recentPrices = prices.slice(-20);
  const oldPrices = prices.slice(-40, -20);

  const recentAvg = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
  const oldAvg = oldPrices.reduce((a, b) => a + b) / oldPrices.length;

  if (recentAvg > oldAvg * 1.005) return "BUY";
  if (recentAvg < oldAvg * 0.995) return "SELL";

  return "HOLD";
}

// ============= COMPLETE WORKFLOW ORCHESTRATION =============

export async function runCompleteWorkflow(priceData: PriceBar[]) {
  console.log("\n\n");
  console.log("█████████████████████████████████████████████████████████████");
  console.log("█                  COMPLETE TRADING SYSTEM                   █");
  console.log("█              Evolution → Backtest → Paper Trade            █");
  console.log("█████████████████████████████████████████████████████████████");

  // Phase 1: Genetic Evolution
  const evolutionResult = await phase1EvolutionOptimization(priceData);

  // Phase 2: Validation
  const validationResult = await phase2ValidationBacktest(priceData);

  // Phase 3: Paper Trading
  const paperTraderResult = await phase3PaperTradingSimulation(priceData);

  // Phase 4: Deployment Check
  const deploymentCheck = await phase4LiveDeploymentCheck(
    evolutionResult.genes,
    paperTraderResult.getStats()
  );

  // Phase 5: Ready for live (with user approval)
  console.log("\n\n");
  console.log("█████████████████████████████████████████████████████████████");
  console.log("█                    NEXT STEPS                              █");
  console.log("█████████████████████████████████████████████████████████████");
  console.log("\n1. Review the optimized strategy parameters");
  console.log("2. Verify paper trading results meet your criteria");
  console.log("3. Check deployment readiness assessment");
  console.log("4. Set API credentials and rate limits");
  console.log("5. Start live trading with small position size");
  console.log("6. Monitor performance and adjust as needed\n");

  return {
    evolution: evolutionResult,
    validation: validationResult,
    paperTrading: paperTraderResult,
    deployment: deploymentCheck,
  };
}

// ============= EXAMPLE USAGE =============

export async function exampleCompleteWorkflow() {
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

  // Generate 2000 bars of price data (about 1.4 days on 1-minute timeframe)
  const prices = generatePrices(2000);
  const priceBars = createPriceBars(prices);

  // Run complete workflow
  const result = await runCompleteWorkflow(priceBars);

  console.log("\n✅ Complete workflow finished. Results saved to result object.");

  return result;
}
