export function calculateRSI(prices: number[], period = 14) {
  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length - 1; i++) {
    const diff = prices[i + 1] - prices[i];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const rs = gains / (losses || 1);
  return 100 - 100 / (1 + rs);
}

export function movingAverage(prices: number[]) {
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

export function bollingerBands(prices: number[]) {
  const avg = movingAverage(prices);
  const variance =
    prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) /
    prices.length;

  const std = Math.sqrt(variance);

  return {
    upper: avg + 2 * std,
    lower: avg - 2 * std,
    mid: avg,
  };
}