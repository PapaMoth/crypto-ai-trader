export function generateSignal(prices: number[]) {
  const latest = prices[prices.length - 1];
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  if (latest > avg * 1.01) return "SELL";
  if (latest < avg * 0.99) return "BUY";
  return "HOLD";
}