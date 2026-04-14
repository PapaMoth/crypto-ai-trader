import { detectMarket, MarketCondition } from "./marketCondition";
import { getConfidence } from "./confidence";

export type CoinSymbol = "ETHUSDT" | "BTCUSDT" | "XRPUSDT" | string;
export type Signal = "BUY" | "SELL" | "HOLD";

export interface CoinBrainState {
  symbol: CoinSymbol;
  market: MarketCondition;
  score: number;
  wins: number;
  losses: number;
  lastSignal: Signal;
  lastConfidence: number;
}

export class MultiCoinBrainManager {
  private readonly brains = new Map<CoinSymbol, CoinBrainState>();
  private readonly minConfidence: number;

  constructor(minConfidence = 60) {
    this.minConfidence = minConfidence;
  }

  private getOrCreate(symbol: CoinSymbol): CoinBrainState {
    const existing = this.brains.get(symbol);
    if (existing) return existing;
    const created: CoinBrainState = {
      symbol,
      market: "SIDEWAYS",
      score: 0,
      wins: 0,
      losses: 0,
      lastSignal: "HOLD",
      lastConfidence: 0,
    };
    this.brains.set(symbol, created);
    return created;
  }

  evaluate(
    symbol: CoinSymbol,
    prices: number[],
    rsi: number,
    bbLower: number,
    bbUpper: number
  ): { signal: Signal; confidence: number; market: MarketCondition } {
    const brain = this.getOrCreate(symbol);
    const market = detectMarket(prices);
    const price = prices[prices.length - 1] || 0;
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : price;
    const confidence = getConfidence({ rsi, price, bbLower, bbUpper, avg });

    let signal: Signal = "HOLD";
    if (confidence >= this.minConfidence) {
      if (market === "TREND_UP") signal = price >= avg ? "BUY" : "HOLD";
      else if (market === "TREND_DOWN") signal = price <= avg ? "SELL" : "HOLD";
      else {
        if (rsi <= 30 && price <= bbLower) signal = "BUY";
        else if (rsi >= 70 && price >= bbUpper) signal = "SELL";
      }
    }

    brain.market = market;
    brain.lastSignal = signal;
    brain.lastConfidence = confidence;
    return { signal, confidence, market };
  }

  recordOutcome(symbol: CoinSymbol, result: "WIN" | "LOSS"): void {
    const brain = this.getOrCreate(symbol);
    if (result === "WIN") {
      brain.wins += 1;
      brain.score += 1;
    } else {
      brain.losses += 1;
      brain.score -= 1;
    }
  }

  getState(symbol: CoinSymbol): CoinBrainState {
    return this.getOrCreate(symbol);
  }

  getAllStates(): CoinBrainState[] {
    return Array.from(this.brains.values());
  }
}
