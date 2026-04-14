import { AdaptiveAIEngine } from "./adaptive-ai-engine";
import { runBinanceBacktest } from "./backtest-binance";

async function main() {
  const ai = new AdaptiveAIEngine();
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 1000 * 60 * 60 * 24 * 30);

  const result = await runBinanceBacktest(
    {
      symbol: "BTCUSDT",
      interval: "1h",
      startDate,
      endDate,
      initialBalance: 10000,
      minConfidence: 0.6,
      testnet: false,
    },
    ai
  );

  console.log("\n=== ADAPTIVE BINANCE BACKTEST (30D) ===");
  console.log(`Final Balance: $${result.finalBalance.toFixed(2)}`);
  console.log(`Profit %: ${result.profitPercent.toFixed(2)}%`);
  console.log(`Trades: ${result.totalTrades}`);
  console.log(`Win Rate: ${result.winRate.toFixed(2)}%`);
  console.log(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
}

main().catch((err) => {
  console.error("Adaptive backtest failed:", err);
  process.exit(1);
});
