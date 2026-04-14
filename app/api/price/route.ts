export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") || "ETHUSDT";
  const interval = url.searchParams.get("interval") || "5m";
  const limit = url.searchParams.get("limit") || "1000";

  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );

  const data = await res.json();
  const prices = Array.isArray(data)
    ? data.map((candle: any) => parseFloat(candle[4]))
    : [];
  const price = prices.length ? prices[prices.length - 1] : 0;

  return Response.json({ prices, price });
}
