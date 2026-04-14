/**
 * Trading Strategies
 * Collection of signal generation strategies using technical indicators
 */

import {
  calculateRSI,
  bollingerBands,
  movingAverage,
  exponentialMovingAverage,
  calculateMACD,
  stochasticOscillator,
  calculateSignalStrength,
  detectTrend,
  Trend,
} from "./indicators";
import { detectMarket, MarketCondition } from "./lib/marketCondition";

export type StrategySignal = "BUY" | "SELL" | "HOLD";

export interface Strategy {
  name: string;
  description: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  generate(prices: number[]): StrategySignal;
}

// ============= STRATEGY A: Balanced RSI + Bollinger Bands =============

export class StrategyA implements Strategy {
  name = "Strategy A: Balanced (RSI + BB)";
  description = "Uses RSI oversold/overbought with Bollinger Bands for confirmation";
  riskLevel = "MEDIUM";

  generate(prices: number[]): StrategySignal {
    if (prices.length < 20) return "HOLD";

    const rsi = calculateRSI(prices);
    const bb = bollingerBands(prices);
    const price = prices[prices.length - 1];

    // Buy: RSI oversold AND price below lower band
    if (rsi < 30 && price < bb.lower) {
      return "BUY";
    }

    // Sell: RSI overbought AND price above upper band
    if (rsi > 70 && price > bb.upper) {
      return "SELL";
    }

    return "HOLD";
  }
}

// ============= STRATEGY B: Trend Follower (Moving Average) =============

export class StrategyB implements Strategy {
  name = "Strategy B: Trend Follower (MA)";
  description = "Follows the trend using simple moving average";
  riskLevel = "LOW";

  generate(prices: number[]): StrategySignal {
    if (prices.length < 20) return "HOLD";

    const sma20 = movingAverage(prices, 20);
    const sma50 = movingAverage(prices, 50);
    const price = prices[prices.length - 1];

    // Buy: Price above both MAs and short MA above long MA
    if (price > sma20 && sma20 > sma50) {
      return "BUY";
    }

    // Sell: Price below both MAs and short MA below long MA
    if (price < sma20 && sma20 < sma50) {
      return "SELL";
    }

    return "HOLD";
  }
}

// ============= STRATEGY C: Aggressive RSI =============

export class StrategyC implements Strategy {
  name = "Strategy C: Aggressive RSI";
  description = "Aggressive RSI thresholds for quick trades";
  riskLevel = "HIGH";

  generate(prices: number[]): StrategySignal {
    if (prices.length < 14) return "HOLD";

    const rsi = calculateRSI(prices);

    if (rsi < 40) {
      return "BUY";
    }

    if (rsi > 60) {
      return "SELL";
    }

    return "HOLD";
  }
}

// ============= STRATEGY D: MACD Crossover =============

export class StrategyD implements Strategy {
  name = "Strategy D: MACD Crossover";
  description = "Uses MACD line crossover for trend changes";
  riskLevel = "MEDIUM";

  private previousHistogram = 0;

  generate(prices: number[]): StrategySignal {
    if (prices.length < 26) return "HOLD";

    const macd = calculateMACD(prices);

    // Buy when histogram crosses above zero (MACD crosses above signal)
    if (this.previousHistogram < 0 && macd.histogram > 0) {
      this.previousHistogram = macd.histogram;
      return "BUY";
    }

    // Sell when histogram crosses below zero
    if (this.previousHistogram > 0 && macd.histogram < 0) {
      this.previousHistogram = macd.histogram;
      return "SELL";
    }

    this.previousHistogram = macd.histogram;
    return "HOLD";
  }
}

// ============= STRATEGY E: Combo (Smart AI) =============

export class StrategyE implements Strategy {
  name = "Strategy E: Smart Combo";
  description = "Combines multiple indicators for higher accuracy";
  riskLevel = "MEDIUM";

  generate(prices: number[]): StrategySignal {
    if (prices.length < 50) return "HOLD";

    const rsi = calculateRSI(prices);
    const bb = bollingerBands(prices);
    const sma = movingAverage(prices, 20);
    const trend = detectTrend(prices);
    const price = prices[prices.length - 1];
    const strength = calculateSignalStrength(prices);

    // Strong buy signal
    if (
      trend === Trend.UPTREND &&
      rsi < 40 &&
      price < bb.middle &&
      strength > 65
    ) {
      return "BUY";
    }

    // Strong sell signal
    if (
      trend === Trend.DOWNTREND &&
      rsi > 60 &&
      price > bb.middle &&
      strength < 35
    ) {
      return "SELL";
    }

    // Weak signals
    if (rsi < 30 && price < sma) {
      return "BUY";
    }

    if (rsi > 70 && price > sma) {
      return "SELL";
    }

    return "HOLD";
  }
}

// ============= STRATEGY REGISTRY =============

export const STRATEGIES: Strategy[] = [
  new StrategyA(),
  new StrategyB(),
  new StrategyC(),
  new StrategyD(),
  new StrategyE(),
];

export function getStrategy(index: number): Strategy {
  return STRATEGIES[index] || STRATEGIES[0];
}

export function getStrategyByName(name: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.name.includes(name));
}

// ============= ADAPTIVE AUTO-SWITCHER (A/B/C) =============

type LearningResult = "WIN" | "LOSS" | "BREAKEVEN";

interface LearningState {
  score: number;
  uses: number;
  wins: number;
  losses: number;
}

type MarketLearningBook = Record<string, Record<MarketCondition, LearningState>>;

export class AdaptiveStrategySelector {
  private readonly candidates: Strategy[];
  private readonly learning: MarketLearningBook;
  private lastSelection: { strategy: Strategy; market: MarketCondition } | null = null;

  constructor(candidates: Strategy[] = [new StrategyA(), new StrategyB(), new StrategyC()]) {
    this.candidates = candidates;
    this.learning = {};
    for (const strategy of this.candidates) {
      this.learning[strategy.name] = {
        TREND_UP: { score: 1, uses: 0, wins: 0, losses: 0 },
        TREND_DOWN: { score: 1, uses: 0, wins: 0, losses: 0 },
        SIDEWAYS: { score: 1, uses: 0, wins: 0, losses: 0 },
      };
    }
  }

  generate(prices: number[]): { signal: StrategySignal; strategyName: string; market: MarketCondition } {
    const market = detectMarket(prices);

    let best: Strategy = this.candidates[0];
    let bestScore = -Infinity;

    for (const strategy of this.candidates) {
      const state = this.learning[strategy.name][market];
      // Light exploration bonus so underused strategies can still surface.
      const explore = 1 / Math.sqrt(state.uses + 1);
      const composite = state.score + explore * 0.2;
      if (composite > bestScore) {
        bestScore = composite;
        best = strategy;
      }
    }

    this.lastSelection = { strategy: best, market };
    return {
      signal: best.generate(prices),
      strategyName: best.name,
      market,
    };
  }

  learn(result: LearningResult): void {
    if (!this.lastSelection) return;

    const { strategy, market } = this.lastSelection;
    const state = this.learning[strategy.name][market];
    state.uses += 1;

    if (result === "WIN") {
      state.wins += 1;
      state.score += 0.15;
    } else if (result === "LOSS") {
      state.losses += 1;
      state.score = Math.max(0.1, state.score - 0.18);
    } else {
      state.score += 0.01;
    }
  }

  getPerformanceBook() {
    return this.learning;
  }
}
