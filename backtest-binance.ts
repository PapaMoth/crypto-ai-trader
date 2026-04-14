import { AIBacktester, AIEngine, BacktestResult } from "./ai-backtest";
import { BinanceConnector, DataValidator } from "./binance-connector";

export interface BinanceBacktestConfig {
  symbol: string;
  interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  minConfidence?: number;
  testnet?: boolean;
}

export async function runBinanceBacktest(
  config: BinanceBacktestConfig,
  aiEngine: AIEngine
): Promise<BacktestResult> {
  const connector = new BinanceConnector({
    symbol: config.symbol,
    interval: config.interval,
    limit: 1000,
    testnet: config.testnet ?? false,
  });

  const bars = await connector.fetchDateRange(config.startDate, config.endDate);
  const report = DataValidator.validate(bars);
  if (!report.valid) {
    throw new Error(`Binance data validation failed: ${report.issues.slice(0, 3).join("; ")}`);
  }

  const backtester = new AIBacktester({
    initialBalance: config.initialBalance,
    minConfidence: config.minConfidence ?? 0.6,
    avoidSideways: false,
  });

  return backtester.runBacktest(bars, aiEngine);
}
