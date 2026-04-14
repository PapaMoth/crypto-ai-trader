import { AIEngine, AISignal } from "./ai-backtest";
import { AdaptiveStrategySelector, StrategySignal } from "./strategies";

function toConfidence(signal: StrategySignal): number {
  if (signal === "HOLD") return 0.45;
  return 0.75;
}

export class AdaptiveAIEngine implements AIEngine {
  private selector = new AdaptiveStrategySelector();

  generateSignal(prices: number[]): AISignal {
    const picked = this.selector.generate(prices);
    return {
      action: picked.signal,
      confidence: toConfidence(picked.signal),
      reason: `Auto strategy: ${picked.strategyName} in ${picked.market}`,
    };
  }

  updateWeights(result: "WIN" | "LOSS" | "BREAKEVEN"): void {
    this.selector.learn(result);
  }

  getLearningState() {
    return this.selector.getPerformanceBook();
  }
}
