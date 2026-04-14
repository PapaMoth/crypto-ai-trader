/**
 * Multi-Strategy Backtester
 * Compare multiple strategies on the same price data
 */

import { AIBacktester, PriceBar, AIEngine, AISignal, BacktestResult } from "./ai-backtest";
import { Strategy, STRATEGIES } from "./strategies";

// ============= TYPES =============

export interface StrategyComparison {
  [strategyName: string]: BacktestResult;
}

export interface StrategyRanking {
  rank: number;
  strategy: Strategy;
  result: BacktestResult;
  score: number; // Composite score 0-100
}

export interface StrategyPerformance {
  bestStrategy: StrategyRanking;
  allStrategies: StrategyRanking[];
  comparison: StrategyComparison;
}

// ============= STRATEGY WRAPPER FOR BACKTEST =============

class StrategyAIEngine implements AIEngine {
  constructor(private strategy: Strategy) {}

  generateSignal(prices: number[]): AISignal {
    const signal = this.strategy.generate(prices);

    // Convert strategy signal to AI signal with confidence
    let action: "BUY" | "SELL" | "HOLD" = signal;
    let confidence = 0.7; // Default confidence

    // Boost confidence for strong signals
    if (signal !== "HOLD") {
      confidence = 0.85; // Higher confidence when signal is clear
    }

    return {
      action,
      confidence,
      reason: `${this.strategy.name}`,
    };
  }

  updateWeights(): void {
    // Strategies don't learn in this implementation
    // But this method is required by AIEngine interface
  }
}

// ============= STRATEGY COMPARISON =============

export async function compareStrategies(
  priceData: PriceBar[],
  strategies: Strategy[] = STRATEGIES,
  initialBalance: number = 1000
): Promise<StrategyPerformance> {
  const comparison: StrategyComparison = {};
  const rankings: StrategyRanking[] = [];

  // Test each strategy
  for (const strategy of strategies) {
    console.log(`[BACKTEST] Testing ${strategy.name}...`);

    const backtest = new AIBacktester({ initialBalance });
    const aiEngine = new StrategyAIEngine(strategy);

    const result = await backtest.runBacktest(priceData, aiEngine);
    comparison[strategy.name] = result;

    // Calculate composite score
    const score = calculateStrategyScore(result, strategy.riskLevel);

    rankings.push({
      rank: 0, // Will be assigned after sorting
      strategy,
      result,
      score,
    });
  }

  // Sort by score
  rankings.sort((a, b) => b.score - a.score);

  // Assign ranks
  rankings.forEach((r, i) => {
    r.rank = i + 1;
  });

  return {
    bestStrategy: rankings[0],
    allStrategies: rankings,
    comparison,
  };
}

// ============= SCORE CALCULATION =============

function calculateStrategyScore(
  result: BacktestResult,
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
): number {
  let score = 50; // Base score

  // Profitability (0-25 points)
  score += Math.min(result.profitPercent / 4, 25);

  // Win rate (0-20 points)
  score += Math.min(result.winRate / 5, 20);

  // Profit factor (0-15 points)
  score += Math.min(Math.max(result.profitFactor - 1, 0) * 7.5, 15);

  // Risk-adjusted return (0-15 points)
  const riskAdjustment = result.profitPercent / (result.maxDrawdown || 1);
  score += Math.min(Math.max(riskAdjustment, 0) * 2, 15);

  // Risk level penalty
  if (riskLevel === "HIGH" && result.maxDrawdown > 30) {
    score -= 10; // Penalize high-risk strategies with high drawdown
  }

  // Consistency bonus (0-10 points)
  if (result.totalTrades > 20 && result.winRate > 50) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============= DETAILED ANALYSIS =============

export function analyzeStrategy(result: BacktestResult, strategy: Strategy) {
  const analysis = {
    overview: {
      name: strategy.name,
      description: strategy.description,
      riskLevel: strategy.riskLevel,
    },

    performance: {
      startBalance: result.initialBalance,
      endBalance: result.finalBalance,
      totalProfit: result.totalProfit,
      profitPercent: result.profitPercent,
      annualizedReturn: (result.profitPercent * 365) / result.durationDays,
    },

    trading: {
      totalTrades: result.totalTrades,
      winTrades: result.winTrades,
      lossTrades: result.lossTrades,
      winRate: result.winRate,
      averageWin: result.averageWin,
      averageLoss: result.averageLoss,
      profitFactor: result.profitFactor,
    },

    risk: {
      largestWin: result.largestWin,
      largestLoss: result.largestLoss,
      maxDrawdown: result.maxDrawdown,
      currentDrawdown: result.currentDrawdown,
    },

    timing: {
      startDate: new Date(result.startTime).toLocaleDateString(),
      endDate: new Date(result.endTime).toLocaleDateString(),
      durationDays: result.durationDays,
    },

    recommendation: getRecommendation(result),
  };

  return analysis;
}

// ============= RECOMMENDATION ENGINE =============

function getRecommendation(result: BacktestResult): string {
  const winRate = result.winRate;
  const profitFactor = result.profitFactor;
  const maxDrawdown = result.maxDrawdown;
  const trades = result.totalTrades;

  // Not enough trades to evaluate
  if (trades < 10) {
    return "⚠️ Not enough trades for reliable evaluation";
  }

  // Negative returns
  if (result.totalProfit < 0) {
    return "❌ Strategy is unprofitable. Consider adjusting parameters.";
  }

  // Excessive drawdown
  if (maxDrawdown > 40) {
    return "⚠️ Drawdown is too high. Risk management needed.";
  }

  // Low win rate
  if (winRate < 45) {
    return "⚠️ Win rate below 45%. Risk-reward ratio is unfavorable.";
  }

  // Good performance
  if (profitFactor > 2 && winRate > 55 && maxDrawdown < 20) {
    return "✅ Excellent! Ready for live trading with position sizing.";
  }

  if (profitFactor > 1.5 && winRate > 50 && maxDrawdown < 30) {
    return "✅ Good performance. Consider paper trading before live.";
  }

  if (profitFactor > 1 && winRate > 48) {
    return "⚠️ Marginally profitable. Monitor closely and optimize.";
  }

  return "❓ Mixed results. Needs further testing or optimization.";
}

// ============= COMPARISON REPORT =============

export function generateComparisonReport(performance: StrategyPerformance): string {
  const { bestStrategy, allStrategies } = performance;

  let report = `
╔════════════════════════════════════════════════════════════╗
║           STRATEGY COMPARISON REPORT                      ║
╚════════════════════════════════════════════════════════════╝

🏆 BEST STRATEGY
────────────────────────────────────────────────────────────
Rank: #${bestStrategy.rank}
Strategy: ${bestStrategy.strategy.name}
Risk Level: ${bestStrategy.strategy.riskLevel}
Score: ${bestStrategy.score.toFixed(1)}/100

📊 Performance:
  Final Balance: $${bestStrategy.result.finalBalance.toFixed(2)}
  Total Profit: $${bestStrategy.result.totalProfit.toFixed(2)} (${bestStrategy.result.profitPercent.toFixed(2)}%)
  Win Rate: ${bestStrategy.result.winRate.toFixed(1)}%
  Profit Factor: ${bestStrategy.result.profitFactor.toFixed(2)}
  Max Drawdown: ${bestStrategy.result.maxDrawdown.toFixed(2)}%

📈 RANKING
────────────────────────────────────────────────────────────
`;

  for (const s of allStrategies) {
    report += `
${s.rank}. ${s.strategy.name}
   Score: ${s.score.toFixed(1)}/100 | Win Rate: ${s.result.winRate.toFixed(1)}% | Profit: ${s.result.profitPercent.toFixed(2)}% | Drawdown: ${s.result.maxDrawdown.toFixed(2)}%
`;
  }

  report += `
💡 RECOMMENDATION
────────────────────────────────────────────────────────────
${getRecommendation(bestStrategy.result)}

`;

  return report;
}

// ============= EXAMPLE USAGE =============

export async function exampleComparison() {
  // Generate sample price data
  function generatePrices(length = 1000): number[] {
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

  // Run comparison
  const prices = generatePrices(500);
  const priceBars = createPriceBars(prices);

  const performance = await compareStrategies(priceBars);
  const report = generateComparisonReport(performance);

  console.log(report);

  return performance;
}
