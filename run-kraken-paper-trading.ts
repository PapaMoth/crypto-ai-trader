#!/usr/bin/env ts-node

/**
 * Kraken Paper Trading Runner
 *
 * Run paper trading simulations on real Kraken price data
 * to validate strategy before going live.
 *
 * Usage:
 *   npx ts-node run-kraken-paper-trading.ts
 *   npx ts-node run-kraken-paper-trading.ts --days 7 --balance 5000
 *   npx ts-node run-kraken-paper-trading.ts --pair XBTUSDT --interval 60
 */

import { KrakenPaperTradingRunner } from './kraken-paper-trading-runner';
import { StrategyGenes } from './strategy-evolution';
import * as fs from 'fs';

interface RunConfig {
  pair: string;
  interval: string;
  initialBalance: number;
  daysOfHistory: number;
  genes?: StrategyGenes;
  saveReport: boolean;
  reportFile: string;
}

function parseArgs(): RunConfig {
  const args = process.argv.slice(2);

  const config: RunConfig = {
    pair: 'XBTUSDT',
    interval: '60', // 1 hour
    initialBalance: 10000,
    daysOfHistory: 30,
    saveReport: true,
    reportFile: `kraken-paper-trading-${new Date().toISOString().split('T')[0]}.txt`,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--pair' && args[i + 1]) {
      config.pair = args[++i];
    } else if (arg === '--interval' && args[i + 1]) {
      config.interval = args[++i];
    } else if (arg === '--balance' && args[i + 1]) {
      config.initialBalance = parseFloat(args[++i]);
    } else if (arg === '--days' && args[i + 1]) {
      config.daysOfHistory = parseInt(args[++i]);
    } else if (arg === '--no-save') {
      config.saveReport = false;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Kraken Paper Trading Runner
═══════════════════════════════════════════════════════════════════

Run paper trading simulations on real Kraken price data to validate
your trading strategy before deploying with real money.

USAGE:
  npx ts-node run-kraken-paper-trading.ts [OPTIONS]

OPTIONS:
  --pair PAIR           Trading pair (default: XBTUSDT)
                        Examples: XBTUSDT, ETHUSDT, XBTUSD

  --interval MIN        Candle interval in minutes (default: 60)
                        Options: 1, 5, 15, 30, 60, 240, 1440

  --balance AMOUNT      Starting balance in USD (default: 10000)
                        Example: --balance 5000

  --days DAYS           Days of historical data to use (default: 30)
                        Example: --days 7 or --days 90

  --no-save            Don't save report to file

  --help               Show this help message

EXAMPLES:

  # Default: BTC/USD, 1h candles, $10k, 30 days
  npx ts-node run-kraken-paper-trading.ts

  # Ethereum, 4h candles, $5k, 7 days
  npx ts-node run-kraken-paper-trading.ts --pair ETHUSDT --interval 240 --balance 5000 --days 7

  # Bitcoin, 15m candles, $20k, 14 days
  npx ts-node run-kraken-paper-trading.ts --interval 15 --balance 20000 --days 14

OUTPUT:
  - Real-time trade signals printed to console
  - Performance metrics and analysis
  - Recommendation for next steps
  - Report saved to kraken-paper-trading-YYYY-MM-DD.txt

═══════════════════════════════════════════════════════════════════
`);
}

async function main() {
  const config = parseArgs();

  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║          KRAKEN PAPER TRADING VALIDATION SYSTEM                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);

  console.log(`
📋 Configuration:
  Trading Pair:        ${config.pair}
  Candle Interval:     ${config.interval} minutes
  Initial Balance:     $${config.initialBalance.toLocaleString()}
  Historical Period:   ${config.daysOfHistory} days
  Report File:         ${config.reportFile}

⏳ Fetching live Kraken data and running simulation...
`);

  try {
    const runner = new KrakenPaperTradingRunner(
      config.pair,
      config.interval,
      config.initialBalance
    );

    // Set custom strategy genes if provided
    if (config.genes) {
      runner.setEvolvedGenes(config.genes);
    }

    const startTime = Date.now();
    const session = await runner.runSession(config.daysOfHistory);
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    // Generate and display report
    const report = runner.generateReport(session);
    console.log(report);

    // Save report if requested
    if (config.saveReport) {
      const fullReport = `
KRAKEN PAPER TRADING SIMULATION REPORT
Generated: ${new Date().toISOString()}
Simulation Time: ${elapsedSeconds} seconds

${report}

═════════════════════════════════════════════════════════════════════
INTERPRETATION GUIDE
═════════════════════════════════════════════════════════════════════

WIN RATE (Should be > 50%):
  - Below 40%:  Poor strategy, needs optimization
  - 40-50%:     Marginal, may need tweaking
  - 50-60%:     Good, shows promise
  - Above 60%:  Excellent, ready to deploy

PROFIT FACTOR (Should be > 1.5x):
  - Below 1.0:  Losing strategy
  - 1.0-1.5:    Marginal profitability
  - 1.5-2.0:    Good, acceptable risk/reward
  - Above 2.0:  Excellent risk/reward

MAX DRAWDOWN (Should be < 15%):
  - Below 5%:   Very stable
  - 5-10%:      Stable
  - 10-15%:     Acceptable
  - 15-20%:     Risky
  - Above 20%:  Too risky for live trading

NEXT STEPS:
  ✅ Win Rate > 50%, Profit Factor > 1.5x, Drawdown < 15%
     → Ready for testnet deployment with $100 balance

  ⚠️  Good win rate but losses too large
     → Reduce stop loss percentage, tighten risk management

  ❌ Win rate < 40%
     → Run genetic algorithm to optimize strategy parameters

  ⚠️  Strategy not profitable
     → Paper trade longer (60-90 days), then re-optimize

═════════════════════════════════════════════════════════════════════
`;

      fs.writeFileSync(config.reportFile, fullReport);
      console.log(`\n✅ Report saved to: ${config.reportFile}`);
    }

    // Summary stats
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                         SUMMARY                                   ║
╚═══════════════════════════════════════════════════════════════════╝

Starting Balance:      $${session.initialBalance.toLocaleString()}
Final Balance:         $${session.finalBalance.toFixed(2)}
Total Profit/Loss:     $${session.totalProfit.toFixed(2)} (${session.profitPercent > 0 ? '+' : ''}${session.profitPercent.toFixed(2)}%)

Win Rate:              ${session.winRate.toFixed(1)}%
Profit Factor:         ${session.profitFactor.toFixed(2)}x
Max Drawdown:          ${Math.abs(session.maxDrawdownPercent).toFixed(2)}%

Total Trades:          ${session.totalTrades}
Simulation Duration:   ${elapsedSeconds} seconds

Ready for next phase:  ${getReadiness(session)}

`);

  } catch (error) {
    console.error('❌ Error running simulation:', error);
    process.exit(1);
  }
}

function getReadiness(session: any): string {
  if (session.winRate >= 50 && session.profitFactor >= 1.5 && Math.abs(session.maxDrawdownPercent) < 15) {
    return '✅ YES - Deploy to testnet with $100 balance';
  } else if (session.winRate >= 45 && session.profitPercent >= 0) {
    return '⚠️  MAYBE - Run paper trading longer or optimize strategy';
  } else {
    return '❌ NO - Needs strategy optimization';
  }
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
