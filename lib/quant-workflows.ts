import { AIBacktester, PriceBar, BacktestResult } from "../ai-backtest";
import { AdaptiveAIEngine } from "../adaptive-ai-engine";
import { StrategyEvolver, EvolutionResult } from "../strategy-evolution";

function toPriceBars(prices: number[], intervalMs: number = 5 * 60 * 1000): PriceBar[] {
  const now = Date.now();
  return prices.map((price, idx) => ({
    timestamp: now + idx * intervalMs,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0,
  }));
}

export async function runBacktest(prices: number[]): Promise<BacktestResult> {
  const bars = toPriceBars(prices);
  const engine = new AdaptiveAIEngine();
  const backtester = new AIBacktester({
    initialBalance: 1000,
    minConfidence: 0.6,
    avoidSideways: false,
  });
  return backtester.runBacktest(bars, engine);
}

export async function evolve(prices: number[], generations: number = 20): Promise<EvolutionResult> {
  const bars = toPriceBars(prices);
  const evolver = new StrategyEvolver({
    generationCount: generations,
    populationSize: 40,
    eliteSize: 4,
  });
  return evolver.evolve(bars);
}
