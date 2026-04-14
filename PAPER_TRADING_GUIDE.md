# Paper Trading System Guide

Complete guide for simulating trades without real money, perfect for backtesting AI signals.

## Overview

The paper trading system includes:

1. **PaperTrader** - Core trading simulation engine
2. **usePaperTrader** - React hook for state management
3. **PaperTraderDashboard** - Full-featured React component
4. **Statistics tracking** - Win rate, profit factor, average trades

## Quick Start

### 1. Basic Usage (No React)

```typescript
import { PaperTrader } from "./paper-trader";

const trader = new PaperTrader({
  initialBalance: 1000,
  riskPerTrade: 0.02,      // Risk 2% per trade
  takeProfitPercent: 0.005, // Close at +0.5%
  stopLossPercent: 0.005,   // Close at -0.5%
});

// Open a position
trader.openPosition("ETHUSDT", "BUY", 2000);

// Check position at new price
const result = trader.checkPosition("ETHUSDT", 2010);

if (result) {
  console.log(`Trade closed: ${result.result}`);
  console.log(`Profit: $${result.profit}`);
}

// Get stats
const stats = trader.getStats();
console.log(`Balance: $${stats.balance}`);
console.log(`Win Rate: ${stats.winRate}%`);
```

### 2. With React Hook

```typescript
import { usePaperTrader } from "./use-paper-trader";

function MyComponent() {
  const trader = usePaperTrader(1000); // $1000 starting balance

  return (
    <div>
      <h2>Balance: ${trader.balance.toFixed(2)}</h2>
      
      <button onClick={() => trader.openTrade("ETHUSDT", "BUY", 2000)}>
        Open Buy Position
      </button>

      {trader.stats && (
        <div>
          <p>Win Rate: {trader.stats.winRate.toFixed(1)}%</p>
          <p>Total Trades: {trader.stats.totalTrades}</p>
        </div>
      )}
    </div>
  );
}
```

### 3. With React Dashboard Component

```typescript
import PaperTraderDashboard from "./paper-trader-dashboard";

function App() {
  return (
    <PaperTraderDashboard
      initialBalance={1000}
      onSignal={(signal) => {
        console.log(`Signal: ${signal.action} ${signal.symbol}`);
      }}
    />
  );
}
```

## Configuration

### Risk Management

```typescript
const trader = new PaperTrader({
  initialBalance: 10000,
  riskPerTrade: 0.02,      // Risk 2% per trade
  takeProfitPercent: 0.005, // Close at +0.5%
  stopLossPercent: 0.005,   // Close at -0.5%
  maxPositions: 1,          // Max concurrent positions
});
```

## Statistics Explained

### Win Rate
```
Win Rate = (Winning Trades / Total Trades) × 100
```

### Profit Factor
```
Profit Factor = Total Profits / |Total Losses|
```

## Integration with TradeClient

Combine paper trading with live trading:

```typescript
import { TradeClient } from "./trade-client";
import { usePaperTrader } from "./use-paper-trader";

function SmartTrading() {
  const paperTrader = usePaperTrader(1000);
  const client = new TradeClient({...});
  
  const executeSignal = async (signal: Signal) => {
    // First: test in paper trading
    paperTrader.openTrade(signal.symbol, signal.side, signal.price);
    
    // Check if profitable in simulation
    const result = paperTrader.checkTrade(signal.symbol, signal.price + 10);
    
    if (result?.result === "WIN") {
      // Then execute live trade
      const liveResult = await client.executeTrade({
        symbol: signal.symbol,
        side: signal.side,
        quantity: 0.01,
      });
      
      console.log("Paper: WIN, Live:", liveResult.success ? "SUCCESS" : "FAILED");
    }
  };
}
```

## Best Practices

1. **Always Paper Trade First** - Validate your AI on simulated trades
2. **Use Proper Risk Management** - Never risk > 2% per trade
3. **Monitor Key Metrics**:
   - Win Rate (target > 50%)
   - Profit Factor (target > 1.5)
   - Avg Win / Avg Loss ratio

4. **Backtest on Historical Data** - Use past price data
5. **Track Your Results** - Keep detailed statistics

## Files

- **paper-trader.ts** - Core engine
- **use-paper-trader.ts** - React hook
- **paper-trader-dashboard.tsx** - Full UI component

All files in `/crypto-ai-trader/` folder.
