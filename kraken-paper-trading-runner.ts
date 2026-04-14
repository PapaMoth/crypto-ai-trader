import KrakenConnector, { KrakenPrice } from './kraken-connector';
import { PaperTrader, PaperTradingStats } from './paper-trader';
import { StrategyEvolver, StrategyGenes } from './strategy-evolution';
import { LiveTradingWithEvolvedStrategy } from './evolved-strategy-injector';
import { Indicators } from './indicators';

export interface PaperTradingSession {
  pair: string;
  startTime: Date;
  endTime: Date;
  initialBalance: number;
  finalBalance: number;
  totalProfit: number;
  profitPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  equityCurve: number[];
  trades: TradeRecord[];
  strategy: StrategyGenes;
  priceHistory: number[];
}

export interface TradeRecord {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  quantity: number;
  profit: number;
  profitPercent: number;
  type: 'BUY' | 'SELL';
}

export class KrakenPaperTradingRunner {
  private connector: KrakenConnector;
  private paperTrader: PaperTrader;
  private aiEngine: LiveTradingWithEvolvedStrategy;
  private evolvedGenes: StrategyGenes;

  constructor(
    pair: string = 'XBTUSDT',
    interval: string = '60',
    initialBalance: number = 10000
  ) {
    this.connector = new KrakenConnector(pair, interval);
    this.paperTrader = new PaperTrader(initialBalance);

    // Default evolved strategy (from genetic algorithm)
    this.evolvedGenes = {
      rsiPeriod: 14,
      rsiBuyThreshold: 30,
      rsiSellThreshold: 70,
      bBandsPeriod: 20,
      bbStdDev: 2.0,
      maPeriod: 20,
      maTypeShort: 0,
      maTypeLong: 1,
      takeProfitPercent: 0.02,
      stopLossPercent: 0.01,
      riskPerTrade: 0.02,
    };

    this.aiEngine = new LiveTradingWithEvolvedStrategy({
      symbol: pair,
      initialBalance,
      evolvedGenes: this.evolvedGenes,
      autoRollback: false, // Disable for paper trading
      performanceThreshold: 50,
      strategyName: 'Kraken Paper Trading',
    });
  }

  setEvolvedGenes(genes: StrategyGenes): void {
    this.evolvedGenes = genes;
    this.aiEngine = new LiveTradingWithEvolvedStrategy({
      symbol: this.connector['pair'],
      initialBalance: this.paperTrader.getBalance(),
      evolvedGenes: genes,
      autoRollback: false,
      performanceThreshold: 50,
      strategyName: 'Kraken Paper Trading',
    });
  }

  async runSession(
    daysOfHistory: number = 30
  ): Promise<PaperTradingSession> {
    console.log(
      `🚀 Starting Kraken paper trading simulation (${daysOfHistory} days)...\n`
    );

    const startTime = new Date();
    let priceHistory: KrakenPrice[] = [];

    try {
      // Fetch historical data
      // For 1h candles: 30 days = 720 candles, for safety fetch more
      const limit = Math.min(daysOfHistory * 24 + 100, 720);
      console.log(`📊 Fetching ${limit} historical candles from Kraken...`);

      priceHistory = await this.connector.fetchLatest(limit);

      if (priceHistory.length === 0) {
        throw new Error('No price history received from Kraken');
      }

      console.log(`✅ Received ${priceHistory.length} candles\n`);

      // Sort by timestamp ascending
      priceHistory.sort((a, b) => a.timestamp - b.timestamp);

      // Build price array
      const prices = priceHistory.map(p => p.close);

      // Calculate indicators for the entire period
      const indicators = this.calculateIndicators(prices);

      const equityCurve: number[] = [this.paperTrader.getBalance()];
      const tradeRecords: TradeRecord[] = [];
      let lastBuyPrice = 0;
      let lastBuyTime = 0;
      let inPosition = false;

      console.log('🤖 Running AI signals...\n');

      // Process each price point
      for (let i = 0; i < prices.length; i++) {
        const currentPrice = prices[i];
        const timestamp = priceHistory[i].timestamp;

        // Get current indicators
        const rsi = indicators.rsi[i] || 50;
        const bbUpper = indicators.bbUpper[i] || currentPrice * 1.05;
        const bbLower = indicators.bbLower[i] || currentPrice * 0.95;
        const mma = indicators.mma[i] || currentPrice;
        const ema = indicators.ema[i] || currentPrice;

        // Generate AI signal
        let signal = 'HOLD';

        // Simple strategy logic
        if (rsi < this.evolvedGenes.rsiBuyThreshold && currentPrice > bbLower && !inPosition) {
          signal = 'BUY';
        } else if (
          rsi > this.evolvedGenes.rsiSellThreshold &&
          currentPrice < bbUpper &&
          inPosition
        ) {
          signal = 'SELL';
        } else if (inPosition) {
          // Check take profit / stop loss
          const profitPercent = (currentPrice - lastBuyPrice) / lastBuyPrice;
          if (
            profitPercent >= this.evolvedGenes.takeProfitPercent ||
            profitPercent <= -this.evolvedGenes.stopLossPercent
          ) {
            signal = 'SELL';
          }
        }

        // Execute signal
        if (signal === 'BUY' && !inPosition) {
          lastBuyPrice = currentPrice;
          lastBuyTime = timestamp;
          inPosition = true;
          console.log(
            `[${new Date(timestamp).toISOString()}] BUY @ $${currentPrice.toFixed(2)} (RSI: ${rsi.toFixed(1)})`
          );
        } else if (signal === 'SELL' && inPosition) {
          const profit = currentPrice - lastBuyPrice;
          const profitPercent = (profit / lastBuyPrice) * 100;
          inPosition = false;

          tradeRecords.push({
            entryTime: lastBuyTime,
            entryPrice: lastBuyPrice,
            exitTime: timestamp,
            exitPrice: currentPrice,
            quantity: 1,
            profit,
            profitPercent,
            type: 'BUY',
          });

          // Update balance
          this.paperTrader.recordTrade(profitPercent);

          console.log(
            `[${new Date(timestamp).toISOString()}] SELL @ $${currentPrice.toFixed(2)} | Profit: ${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}%`
          );
        }

        equityCurve.push(this.paperTrader.getBalance());
      }

      // Close any open position
      if (inPosition && priceHistory.length > 0) {
        const finalPrice = prices[prices.length - 1];
        const finalTime = priceHistory[priceHistory.length - 1].timestamp;
        const profit = finalPrice - lastBuyPrice;
        const profitPercent = (profit / lastBuyPrice) * 100;

        tradeRecords.push({
          entryTime: lastBuyTime,
          entryPrice: lastBuyPrice,
          exitTime: finalTime,
          exitPrice: finalPrice,
          quantity: 1,
          profit,
          profitPercent,
          type: 'BUY',
        });

        this.paperTrader.recordTrade(profitPercent);
      }

      const endTime = new Date();
      const stats = this.paperTrader.getStats();

      const session: PaperTradingSession = {
        pair: this.connector['pair'],
        startTime,
        endTime,
        initialBalance: stats.startBalance,
        finalBalance: stats.currentBalance,
        totalProfit: stats.totalProfit,
        profitPercent: (stats.totalProfit / stats.startBalance) * 100,
        totalTrades: stats.totalTrades,
        winningTrades: stats.winningTrades,
        losingTrades: stats.losingTrades,
        winRate: stats.winRate,
        averageWin: stats.averageWin,
        averageLoss: stats.averageLoss,
        profitFactor: stats.profitFactor,
        maxDrawdown: stats.maxDrawdown,
        maxDrawdownPercent: (stats.maxDrawdown / stats.startBalance) * 100,
        equityCurve,
        trades: tradeRecords,
        strategy: this.evolvedGenes,
        priceHistory: prices,
      };

      return session;
    } catch (error) {
      console.error('Error running paper trading session:', error);
      throw error;
    }
  }

  private calculateIndicators(prices: number[]): {
    rsi: number[];
    bbUpper: number[];
    bbLower: number[];
    bbMiddle: number[];
    mma: number[];
    ema: number[];
  } {
    const rsi: number[] = [];
    const bbUpper: number[] = [];
    const bbLower: number[] = [];
    const bbMiddle: number[] = [];
    const mma: number[] = [];
    const ema: number[] = [];

    const indicators = new Indicators();

    // Calculate RSI
    let rsiValues = indicators.calculateRSI(prices, this.evolvedGenes.rsiPeriod);
    for (let i = 0; i < prices.length; i++) {
      rsi.push(rsiValues[i] || 50);
    }

    // Calculate Bollinger Bands
    let bbValues = indicators.calculateBollingerBands(
      prices,
      this.evolvedGenes.bBandsPeriod,
      this.evolvedGenes.bbStdDev
    );
    for (let i = 0; i < prices.length; i++) {
      bbUpper.push(bbValues[i]?.upper || prices[i] * 1.05);
      bbMiddle.push(bbValues[i]?.middle || prices[i]);
      bbLower.push(bbValues[i]?.lower || prices[i] * 0.95);
    }

    // Calculate Moving Averages
    let mmaValues = indicators.calculateMovingAverage(
      prices,
      this.evolvedGenes.maPeriod
    );
    for (let i = 0; i < prices.length; i++) {
      mma.push(mmaValues[i] || prices[i]);
    }

    let emaValues = indicators.calculateExponentialMovingAverage(
      prices,
      this.evolvedGenes.maPeriod
    );
    for (let i = 0; i < prices.length; i++) {
      ema.push(emaValues[i] || prices[i]);
    }

    return { rsi, bbUpper, bbLower, bbMiddle, mma, ema };
  }

  generateReport(session: PaperTradingSession): string {
    const report = `
═════════════════════════════════════════════════════════════════════════════
                     KRAKEN PAPER TRADING REPORT
═════════════════════════════════════════════════════════════════════════════

📊 SESSION DETAILS
─────────────────────────────────────────────────────────────────────────────
Trading Pair:          ${session.pair}
Period:                ${session.startTime.toISOString()} to ${session.endTime.toISOString()}
Initial Balance:       $${session.initialBalance.toFixed(2)}
Final Balance:         $${session.finalBalance.toFixed(2)}
Total P&L:             $${session.totalProfit.toFixed(2)} (${session.profitPercent > 0 ? '+' : ''}${session.profitPercent.toFixed(2)}%)

💰 TRADING PERFORMANCE
─────────────────────────────────────────────────────────────────────────────
Total Trades:          ${session.totalTrades}
Winning Trades:        ${session.winningTrades} (${session.winRate.toFixed(1)}%)
Losing Trades:         ${session.losingTrades}
Average Win:           $${session.averageWin.toFixed(2)}
Average Loss:          $${session.averageLoss.toFixed(2)}
Profit Factor:         ${session.profitFactor.toFixed(2)}x
Max Drawdown:          $${session.maxDrawdown.toFixed(2)} (${Math.abs(session.maxDrawdownPercent).toFixed(2)}%)

⚙️ STRATEGY PARAMETERS
─────────────────────────────────────────────────────────────────────────────
RSI Period:            ${session.strategy.rsiPeriod}
RSI Buy Threshold:     ${session.strategy.rsiBuyThreshold}
RSI Sell Threshold:    ${session.strategy.rsiSellThreshold}
BB Period:             ${session.strategy.bBandsPeriod}
BB Std Dev:            ${session.strategy.bbStdDev}
MA Period:             ${session.strategy.maPeriod}
Take Profit %:         ${(session.strategy.takeProfitPercent * 100).toFixed(2)}%
Stop Loss %:           ${(session.strategy.stopLossPercent * 100).toFixed(2)}%

✅ ASSESSMENT
─────────────────────────────────────────────────────────────────────────────
Status:                ${this.assessStatus(session)}
Next Step:             ${this.getNextStep(session)}

═════════════════════════════════════════════════════════════════════════════
`;

    if (session.trades.length > 0 && session.trades.length <= 50) {
      report += `\n📋 TRADE DETAILS\n`;
      report += `─────────────────────────────────────────────────────────────────────────────\n`;

      for (let i = 0; i < session.trades.length; i++) {
        const trade = session.trades[i];
        report += `\nTrade #${i + 1}:\n`;
        report += `  Entry:  $${trade.entryPrice.toFixed(2)} @ ${new Date(trade.entryTime).toISOString()}\n`;
        report += `  Exit:   $${trade.exitPrice.toFixed(2)} @ ${new Date(trade.exitTime).toISOString()}\n`;
        report += `  P&L:    $${trade.profit.toFixed(2)} (${trade.profitPercent > 0 ? '+' : ''}${trade.profitPercent.toFixed(2)}%)\n`;
      }
      report += `\n═════════════════════════════════════════════════════════════════════════════\n`;
    }

    return report;
  }

  private assessStatus(session: PaperTradingSession): string {
    if (session.winRate < 40) {
      return '❌ POOR - Win rate too low';
    }
    if (session.profitPercent < 0) {
      return '⚠️  CAUTIOUS - Losing money';
    }
    if (session.profitFactor < 1.5) {
      return '⚠️  MARGINAL - Profit factor weak';
    }
    if (session.maxDrawdownPercent > 20) {
      return '⚠️  RISKY - High drawdown';
    }
    if (session.winRate >= 50 && session.profitPercent > 0) {
      return '✅ GOOD - Ready for small live trading';
    }
    return '⚠️  NEEDS REVIEW';
  }

  private getNextStep(session: PaperTradingSession): string {
    if (session.winRate < 40) {
      return 'Reoptimize strategy with genetic algorithm';
    }
    if (session.profitPercent < 0) {
      return 'Review strategy parameters and run evolution';
    }
    if (session.winRate >= 50 && session.profitPercent > 0 && session.maxDrawdownPercent < 15) {
      return 'Deploy to testnet with small $100 balance';
    }
    return 'Run paper trading longer (2-3 weeks)';
  }
}

// Main execution
export async function runKrakenPaperTrading() {
  try {
    const runner = new KrakenPaperTradingRunner('XBTUSDT', '60', 10000);

    // Optional: Set custom evolved genes
    // runner.setEvolvedGenes({
    //   rsiPeriod: 14,
    //   rsiBuyThreshold: 28,
    //   rsiSellThreshold: 72,
    //   ...
    // });

    const session = await runner.runSession(30);
    const report = runner.generateReport(session);

    console.log(report);

    return session;
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Export for CLI
if (require.main === module) {
  runKrakenPaperTrading();
}
