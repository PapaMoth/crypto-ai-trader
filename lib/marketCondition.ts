export type MarketCondition = "TREND_UP" | "TREND_DOWN" | "SIDEWAYS";

export function detectMarket(prices: number[]): MarketCondition {
  if (!prices.length) return "SIDEWAYS";

  const start = prices[0];
  const end = prices[prices.length - 1];
  if (start === 0) return "SIDEWAYS";

  const change = (end - start) / start;

  if (change > 0.01) return "TREND_UP";
  if (change < -0.01) return "TREND_DOWN";

  return "SIDEWAYS";
}
