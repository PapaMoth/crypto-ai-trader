# Crypto AI Trader - Complete Trading System

A production-ready algorithmic trading system with automated genetic algorithm optimization, real Binance data integration, and live trading capabilities.

## 🚀 Quick Start

### 1. Setup Live Training on Real Binance Data

```typescript
import { LiveTrainingService } from "./live-training-service";

const service = new LiveTrainingService({
  evolutionEnabled: true,
  cycleIntervalMinutes: 5,
  binanceSymbol: "BTCUSDT",
  binanceInterval: "1h",
  binanceTestnet: true, // Start with testnet
  liveTrading: true,
  initialBalance: 10000,
  autoRollback: true,
});

await service.start();
// Service automatically:
// - Fetches real Binance data
// - Runs genetic algorithm continuously
// - Deploys better strategies automatically
// - Executes live trades with auto-rollback
```

### 2. Watch Evolution Progress

```typescript
import { EvolutionVisualizer } from "./evolution-visualizer";

// Open React component to see:
// - Fitness score trends
// - Deployment history
// - Real-time improvement metrics
// - Recent cycle details
```

### 3. Monitor System Status

```typescript
import { ServiceMonitor } from "./live-training-service";

const monitor = new ServiceMonitor(service);
monitor.startMonitoring(30); // Report every 30 seconds
```

## 📊 System Architecture

```
┌─────────────────────────────────────────────────┐
│  Real Binance API (live price data)             │
│  - 1m, 5m, 15m, 1h, 4h, 1d candles            │
│  - Historical data fetching                     │
│  - Live price streaming                         │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Background Evolution Manager                   │
│  - Continuous genetic algorithm                 │
│  - 150 population × 50 generations per cycle   │
│  - Auto-deploys improvements                    │
│  - Performance monitoring                       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Strategy Injector                              │
│  - EvolvedStrategyEngine                        │
│  - Auto-rollback on poor performance            │
│  - Parameter optimization                       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Live Trading System                            │
│  - Real order execution                         │
│  - Rate limiting (per-IP, per-user)            │
│  - Exponential backoff retry logic              │
│  - Position management                          │
│  - Risk controls                                │
└─────────────────────────────────────────────────┘
```

## 🧬 Genetic Algorithm Features

### Strategy Parameters Optimized:
- **RSI Indicator**: Period, buy threshold, sell threshold
- **Bollinger Bands**: Period, standard deviation multiplier
- **Moving Averages**: Period, type (SMA/EMA)
- **Risk Management**: Take profit %, stop loss %, risk per trade

### Evolution Process:
1. **Generation 1**: Random population of 150 strategies
2. **Evaluation**: Backtest each against latest market data
3. **Selection**: Tournament selection of best performers
4. **Crossover**: Combine genes from top strategies
5. **Mutation**: Introduce small random changes
6. **Elitism**: Keep top 15 strategies unmodified
7. **Repeat**: Each cycle auto-deploys if >1.5% improvement

## 📈 Real-Time Monitoring

### Evolution Visualizer Shows:
- **Fitness Score Trend**: Line chart of optimization progress
- **Improvement per Cycle**: Bar chart showing gains
- **Deployment Timeline**: When strategies went live
- **Win Rate Tracking**: Real trading performance
- **Recent Cycles Table**: Latest 10 cycles with details

### Service Monitor Provides:
- Evolution cycle count and best fitness
- Live trading metrics (trades, win rate)
- Deployment rate and frequency
- Average improvement percentage
- Auto-rollback triggers

## 🔐 Risk Management

### Built-in Safeguards:
- **Auto-Rollback**: Reverts to previous strategy if win rate drops
- **Position Sizing**: Risk per trade is optimizable parameter
- **Stop Loss**: Every trade has configurable stop loss
- **Rate Limiting**: Prevents over-trading and API abuse
- **Paper Trading**: Test before going live

### Configuration:
```typescript
{
  autoRollback: true,              // Enable auto-rollback
  performanceThreshold: 50,        // Min 50% win rate
  maxConsecutiveNoImprovement: 20, // Stop after 20 cycles
  maxPositions: 5,                 // Max concurrent trades
  takeProfitPercent: 0.02,         // 2% take profit
  stopLossPercent: 0.01,           // 1% stop loss
  riskPerTrade: 0.02,              // 2% per trade
}
```

## 💻 Core Components

### Binance Connector (`binance-connector.ts`)
- Fetch historical candlestick data
- Real-time price streaming
- Data validation and quality checks
- Rate limiting (100ms between requests)

### Strategy Evolution (`strategy-evolution.ts`)
- StrategyEvolver class with genetic algorithm
- EvolvingStrategyEngine implementing AIEngine interface
- Parameter optimization across 11 genes
- Fitness scoring (0-100)

### Background Evolution Manager (`background-evolution.ts`)
- Runs genetic algorithm continuously
- Auto-detects and deploys improvements
- Tracks improvement history
- Performance statistics

### Live Training Service (`live-training-service.ts`)
- Orchestrates all components
- Manages Binance connection
- Coordinates evolution and live trading
- Service monitoring and reporting

### Live Trading System
- TradeClient with retry logic and rate limiting
- EvolvedStrategyEngine auto-injector
- LiveTradingWithEvolvedStrategy executor
- Paper trader for risk-free testing

## 🎯 How It Works

### Continuous Improvement Cycle:

1. **Every 5 minutes** (configurable):
   - Fetch latest 2000 candles from Binance
   - Run genetic algorithm (150 population, 50 generations)
   - Score best evolved strategy

2. **If improvement > 1.5%**:
   - Deploy new strategy to live trading
   - Reset no-improvement counter
   - Begin trading with optimized parameters

3. **Monitor live performance**:
   - Track win rate, profit factor, drawdown
   - If win rate drops below 50%: rollback to previous
   - Log all metrics for analysis

4. **Repeat** continuously (until stopped or max no-improvement reached)

## 📊 Example Output

```
╔════════════════════════════════════════════════════════════╗
║         LIVE TRAINING SERVICE STATUS                      ║
╚════════════════════════════════════════════════════════════╝

Configuration:
  Symbol: BTCUSDT
  Interval: 1h
  Environment: TESTNET

Evolution:
  Status: 🟢 RUNNING
  Cycles: 42
  Best Fitness: 73.2/100
  Deployments: 18

Live Trading:
  Status: 🟢 RUNNING
  Balance: $10,000
  Trades: 156
  Win Rate: 58.3%

Price Streaming:
  Status: 🟢 ACTIVE
```

## 🔧 Configuration Examples

### Conservative Training:
```typescript
new LiveTrainingService({
  populationSize: 50,           // Smaller population
  generationsPerCycle: 20,      // Fewer generations
  cycleIntervalMinutes: 10,     // Less frequent cycles
  improveThreshold: 3,          // Higher improvement threshold
  autoRollback: true,
});
```

### Aggressive Training:
```typescript
new LiveTrainingService({
  populationSize: 200,          // Large population
  generationsPerCycle: 100,     // Many generations
  cycleIntervalMinutes: 1,      // Frequent cycles
  improveThreshold: 0.5,        // Lower threshold
  autoRollback: false,
});
```

### Production Live Trading:
```typescript
new LiveTrainingService({
  binanceTestnet: false,        // Real money
  liveTrading: true,
  initialBalance: 5000,
  autoRollback: true,
  populationSize: 150,
  generationsPerCycle: 75,
  cycleIntervalMinutes: 5,
});
```

## 📈 Strategy Indicators

The system automatically optimizes:

- **RSI (Relative Strength Index)**: Momentum indicator
- **Bollinger Bands**: Volatility and mean reversion
- **Moving Averages**: Trend following (SMA/EMA)
- **Trend Detection**: Market direction analysis
- **Signal Strength**: Combined indicator confidence
- **MACD**: Momentum and trend confirmation
- **Stochastic Oscillator**: Overbought/oversold levels

## 🎓 Learning Resources

### Technical Indicators
- RSI: Identifies oversold (<30) and overbought (>70) conditions
- Bollinger Bands: Volatility expansion/contraction
- Moving Averages: Trend confirmation and support/resistance
- MACD: Momentum and trend change detection

### Genetic Algorithm
- **Selection**: Tournament selection for diversity
- **Crossover**: Combine best parents
- **Mutation**: Introduce beneficial variation
- **Elitism**: Preserve top solutions
- **Fitness**: Composite score (profit, win rate, Sharpe ratio)

## ⚠️ Important Notes

### Before Going Live:
1. Test extensively on testnet first
2. Validate strategy with paper trading
3. Start with small position sizes
4. Monitor auto-rollback triggers
5. Review performance metrics regularly

### Best Practices:
1. Use 1-hour or higher timeframes for stability
2. Ensure at least 1000 candles of training data
3. Allow evolution to run for at least 10 cycles before trusting
4. Monitor win rate - should be >50% before deploying
5. Set auto-rollback threshold appropriately

### Limitations:
1. Backtesting doesn't account for slippage/fees
2. Market regimes change - strategy needs retraining
3. Extreme events may trigger unexpected behavior
4. Live performance may differ from backtest

## 📝 License

This trading system is provided as-is. Use at your own risk. Always paper trade first.

## 🔗 File Reference

| File | Purpose |
|------|---------|
| `indicators.ts` | Technical indicators library |
| `strategies.ts` | Pre-built trading strategies |
| `strategy-evolution.ts` | Genetic algorithm optimization |
| `strategy-backtester.ts` | Strategy comparison framework |
| `background-evolution.ts` | Continuous evolution service |
| `evolved-strategy-injector.ts` | Auto-deployment system |
| `binance-connector.ts` | Binance API integration |
| `live-training-service.ts` | Main orchestration service |
| `evolution-visualizer.tsx` | Real-time monitoring UI |
| `live-trader.ts` | Live order execution |
| `paper-trader.ts` | Paper trading simulator |
| `rate-limiter.ts` | API rate limiting |
| `trade-client.ts` | Binance API client |

---

**Built with ❤️ for algorithmic traders**
