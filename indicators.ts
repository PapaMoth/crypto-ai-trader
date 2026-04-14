/**
 * Technical Indicators Library
 * RSI, Bollinger Bands, Moving Average, MACD, etc.
 */

// ============= RSI (Relative Strength Index) =============

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    return 50; // Default neutral if not enough data
  }

  // Calculate gains and losses
  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses += Math.abs(diff);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

// ============= Bollinger Bands =============

export interface BollingerBand {
  upper: number;
  middle: number;
  lower: number;
  width: number;
}

export function bollingerBands(
  prices: number[],
  period: number = 20,
  stdDevFactor: number = 2
): BollingerBand {
  if (prices.length < period) {
    const avg = prices.reduce((a, b) => a + b) / prices.length;
    return { upper: avg, middle: avg, lower: avg, width: 0 };
  }

  // Calculate middle (SMA)
  const lastPrices = prices.slice(-period);
  const middle = lastPrices.reduce((a, b) => a + b) / period;

  // Calculate standard deviation
  const squaredDiffs = lastPrices.map((p) => Math.pow(p - middle, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDev * stdDevFactor;
  const lower = middle - stdDev * stdDevFactor;
  const width = upper - lower;

  return { upper, middle, lower, width };
}

// ============= Simple Moving Average =============

export function movingAverage(prices: number[], period: number = 20): number {
  if (prices.length < period) {
    return prices.reduce((a, b) => a + b) / prices.length;
  }

  const lastPrices = prices.slice(-period);
  return lastPrices.reduce((a, b) => a + b) / period;
}

// ============= Exponential Moving Average =============

export function exponentialMovingAverage(
  prices: number[],
  period: number = 20
): number {
  if (prices.length === 0) return 0;
  if (prices.length === 1) return prices[0];

  const multiplier = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
  }

  return ema;
}

// ============= MACD (Moving Average Convergence Divergence) =============

export interface MACD {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACD {
  const fastEMA = exponentialMovingAverage(prices, fastPeriod);
  const slowEMA = exponentialMovingAverage(prices, slowPeriod);

  const macdLine = fastEMA - slowEMA;

  // Signal line is EMA of MACD
  // For simplicity, using simple moving average of last values
  const signalLine = macdLine; // Simplified

  const histogram = macdLine - signalLine;

  return { macdLine, signalLine, histogram };
}

// ============= Stochastic Oscillator =============

export interface Stochastic {
  k: number;
  d: number;
}

export function stochasticOscillator(
  prices: number[],
  period: number = 14,
  kPeriod: number = 3,
  dPeriod: number = 3
): Stochastic {
  if (prices.length < period) {
    return { k: 50, d: 50 };
  }

  const lastPrices = prices.slice(-period);
  const lowest = Math.min(...lastPrices);
  const highest = Math.max(...lastPrices);
  const closePrice = prices[prices.length - 1];

  const range = highest - lowest;
  if (range === 0) {
    return { k: 50, d: 50 };
  }

  const k = ((closePrice - lowest) / range) * 100;

  // D is SMA of K
  const d = k; // Simplified

  return { k, d };
}

// ============= ATR (Average True Range) =============

export function averageTrueRange(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number {
  if (highs.length < period) {
    return 0;
  }

  let trueRanges = 0;

  for (let i = 1; i < period; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges += tr;
  }

  return trueRanges / period;
}

// ============= Support & Resistance =============

export interface SupportResistance {
  support: number;
  resistance: number;
}

export function findSupportResistance(
  prices: number[],
  period: number = 20
): SupportResistance {
  if (prices.length < period) {
    const avg = prices.reduce((a, b) => a + b) / prices.length;
    return { support: avg, resistance: avg };
  }

  const lastPrices = prices.slice(-period);
  const support = Math.min(...lastPrices);
  const resistance = Math.max(...lastPrices);

  return { support, resistance };
}

// ============= Momentum =============

export function momentum(prices: number[], period: number = 10): number {
  if (prices.length < period) {
    return 0;
  }

  return prices[prices.length - 1] - prices[prices.length - period - 1];
}

// ============= Rate of Change =============

export function rateOfChange(prices: number[], period: number = 12): number {
  if (prices.length < period) {
    return 0;
  }

  const currentPrice = prices[prices.length - 1];
  const previousPrice = prices[prices.length - period - 1];

  if (previousPrice === 0) {
    return 0;
  }

  return ((currentPrice - previousPrice) / previousPrice) * 100;
}

// ============= Volatility =============

export function volatility(prices: number[], period: number = 20): number {
  if (prices.length < period) {
    return 0;
  }

  const lastPrices = prices.slice(-period);
  const avg = lastPrices.reduce((a, b) => a + b) / period;

  const squaredDiffs = lastPrices.map((p) => Math.pow(p - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b) / period;
  const stdDev = Math.sqrt(variance);

  return (stdDev / avg) * 100; // Percentage
}

// ============= Trend Detection =============

export enum Trend {
  STRONG_UPTREND = "STRONG_UPTREND",
  UPTREND = "UPTREND",
  SIDEWAYS = "SIDEWAYS",
  DOWNTREND = "DOWNTREND",
  STRONG_DOWNTREND = "STRONG_DOWNTREND",
}

export function detectTrend(prices: number[], period: number = 20): Trend {
  if (prices.length < period) {
    return Trend.SIDEWAYS;
  }

  const sma = movingAverage(prices, period);
  const currentPrice = prices[prices.length - 1];
  const priceChange = ((currentPrice - sma) / sma) * 100;

  if (priceChange > 3) return Trend.STRONG_UPTREND;
  if (priceChange > 1) return Trend.UPTREND;
  if (priceChange < -3) return Trend.STRONG_DOWNTREND;
  if (priceChange < -1) return Trend.DOWNTREND;

  return Trend.SIDEWAYS;
}

// ============= Signal Strength (Combined indicators) =============

export function calculateSignalStrength(prices: number[]): number {
  const rsi = calculateRSI(prices);
  const trend = detectTrend(prices);
  const vol = volatility(prices);

  let strength = 50; // Base neutral

  // RSI component
  if (rsi < 30) strength += 20; // Oversold, potential buy
  else if (rsi < 40) strength += 10;
  else if (rsi > 70) strength -= 20; // Overbought, potential sell
  else if (rsi > 60) strength -= 10;

  // Trend component
  switch (trend) {
    case Trend.STRONG_UPTREND:
      strength += 15;
      break;
    case Trend.UPTREND:
      strength += 8;
      break;
    case Trend.STRONG_DOWNTREND:
      strength -= 15;
      break;
    case Trend.DOWNTREND:
      strength -= 8;
      break;
  }

  // Volatility component (high volatility = higher risk)
  if (vol > 5) strength *= 0.9; // Reduce confidence in high volatility

  return Math.max(0, Math.min(100, strength));
}
