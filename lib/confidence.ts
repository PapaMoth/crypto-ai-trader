export function getConfidence({
  rsi,
  price,
  bbLower,
  bbUpper,
  avg,
}: {
  rsi: number;
  price: number;
  bbLower: number;
  bbUpper: number;
  avg: number;
}) {
  let score = 0;

  // Oversold / overbought strength
  if (rsi < 25) score += 2;
  else if (rsi < 30) score += 1;

  if (rsi > 75) score -= 2;
  else if (rsi > 70) score -= 1;

  // Distance from Bollinger Bands
  if (price < bbLower) score += 1;
  if (price > bbUpper) score -= 1;

  // Trend alignment
  if (price > avg) score += 0.5;
  else score -= 0.5;

  // Normalize to 0–100
  const normalized = Math.min(100, Math.max(0, (score + 3) * 20));
  return normalized;
}
