export async function GET() {
  const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT");
  const data = await res.json();

  return Response.json({
    price: parseFloat(data.price),
  });
}