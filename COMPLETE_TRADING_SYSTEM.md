# Complete Crypto Trading System Guide

This guide shows how all the components work together: Server-side API with rate limiting, client-side trading client, paper trading, and AI backtesting.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│     Your AI Signal Generator            │
│  (Process prices → Generate signals)    │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    v                         v
┌──────────────────┐  ┌──────────────────┐
│ Paper Trader     │  │ TradeClient      │
│ (Simulate)       │  │ (Live Trading)   │
└──────────────────┘  └────────┬─────────┘
                               │
                               v
                    ┌──────────────────┐
                    │  Binance API     │
                    │  With Rate Limit │
                    └──────────────────┘
```

## Complete Workflow

### 1. Development Phase: Backtest Your AI

```typescript
import { AIBacktester, PriceBar } from "./ai-backtest";
import { AIEngine, AISignal } from "./ai-backtest";

// Define your AI
class MyTradingAI implements AIEngine {
  generateSignal(prices: number[]): AISignal {
    // Your AI logic here
    const latestPrice = prices[prices.length - 1];
    const avgPrice = prices.reduce((a, b) => a + b) / prices.length;
    
    if (latestPrice > avgPrice * 1.005) {
      return { action: "BUY", confidence: 0.85 };
    } else if (latestPrice < avgPrice * 0.995) {
      return { action: "SELL", confidence: 0.85 };
    }
    
    return { action: "HOLD", confidence: 0.5 };
  }

  updateWeights(result: "WIN" | "LOSS" | "BREAKEVEN"): void {
    // AI learns from each trade
    console.log(`AI Learning: ${result}`);
  }
}

// Generate test data
function generateTestPrices(length = 1000): number[] {
  let prices = [2000];
  for (let i = 1; i < length; i++) {
    const change = (Math.random() - 0.5) * 50;
    prices.push(prices[i - 1] + change);
  }
  return prices;
}

// Convert to PriceBar format
function createPriceBars(prices: number[]): PriceBar[] {
  return prices.map((price, i) => ({
    timestamp: Date.now() + i * 60000,
    open: price,
    high: price + 5,
    low: price - 5,
    close: price,
    volume: 1000,
  }));
}

// Run backtest
async function testAI() {
  const backtest = new AIBacktester({ initialBalance: 1000 });
  const ai = new MyTradingAI();
  
  const prices = generateTestPrices(500);
  const priceBars = createPriceBars(prices);
  
  const result = await backtest.runBacktest(priceBars, ai);
  
  console.log(`✓ Final Balance: $${result.finalBalance.toFixed(2)}`);
  console.log(`✓ Win Rate: ${result.winRate.toFixed(1)}%`);
  console.log(`✓ Profit Factor: ${result.profitFactor.toFixed(2)}`);
  
  // Only go live if profitable
  if (result.profitFactor > 1.5 && result.winRate > 50) {
    console.log("✓ Ready for live trading!");
  }
}
```

### 2. Testing Phase: Paper Trade

```typescript
import { usePaperTrader } from "./use-paper-trader";
import PaperTraderDashboard from "./paper-trader-dashboard";

// In React component
function PaperTradingScreen() {
  return (
    <PaperTraderDashboard
      initialBalance={1000}
      onSignal={(signal) => {
        console.log(`Live sim: ${signal.action} ${signal.symbol}`);
      }}
    />
  );
}

// Or programmatically
async function simulateLiveTrading() {
  const trader = usePaperTrader(1000);
  
  // Subscribe to prices (e.g., WebSocket)
  priceStream.on("price", (symbol, price) => {
    // Check if position closes
    const result = trader.checkTrade(symbol, price);
    
    if (result) {
      console.log(`Paper Trade: ${result.result}`);
    }
  });
  
  // Or trigger manually
  trader.openTrade("ETHUSDT", "BUY", 2000);
  trader.checkTrade("ETHUSDT", 2010); // Closes at profit
}
```

### 3. Production Phase: Live Trading

```typescript
import { TradeClient } from "./trade-client";

async function liveTrading() {
  const client = new TradeClient({
    apiUrl: "https://your-api.com",
    apiKey: process.env.INTERNAL_API_KEY,
    maxRetries: 3,
    onRateLimited: (info) => {
      console.warn(`Rate limited. Reset in ${info.remaining}s`);
      // Pause trading
    },
    onError: (error) => {
      console.error(`Trade failed: ${error.type}`);
      // Alert monitoring system
    },
  });

  // Get price and signal
  const currentPrice = 2000;
  const signal = generateSignal(recentPrices);

  // Execute live trade with automatic retries
  const result = await client.executeTrade({
    symbol: "ETHUSDT",
    side: signal.action === "BUY" ? "BUY" : "SELL",
    quantity: 0.01,
  });

  if (result.success) {
    console.log(`✓ Live trade executed: ${result.data.orderId}`);
  } else {
    console.error(`✗ Live trade failed: ${result.error.message}`);
  }
}
```

## Complete Server Setup

### 1. Install Dependencies

```bash
npm install binance-api-node redis
```

### 2. Set Environment Variables

```bash
# .env
BINANCE_API_KEY=xxx
BINANCE_SECRET_KEY=xxx
INTERNAL_API_KEY=your_app_secret
REDIS_URL=redis://localhost:6379
NODE_ENV=production
```

### 3. API Endpoint with Rate Limiting

```typescript
// pages/api/trade.ts (Next.js)
import { trade-with-rate-limit } from "@/lib/trade-with-rate-limit";

export const POST = trade-with-rate-limit.POST;
```

## Complete React Component

```typescript
import React, { useState, useEffect } from "react";
import { TradeClient } from "@/lib/trade-client";
import PaperTraderDashboard from "@/components/PaperTraderDashboard";
import TradeExecutor from "@/components/TradeExecutor";

export default function TradingApp() {
  const [mode, setMode] = useState<"paper" | "live">("paper");

  return (
    <div>
      <div className="mode-selector">
        <button
          onClick={() => setMode("paper")}
          className={mode === "paper" ? "active" : ""}
        >
          📊 Paper Trading (Safe)
        </button>
        <button
          onClick={() => setMode("live")}
          className={mode === "live" ? "active" : ""}
        >
          💰 Live Trading (Real Money)
        </button>
      </div>

      {mode === "paper" ? (
        <PaperTraderDashboard initialBalance={1000} />
      ) : (
        <TradeExecutor
          apiUrl={process.env.REACT_APP_API_URL}
          apiKey={process.env.REACT_APP_API_KEY}
        />
      )}
    </div>
  );
}
```

## Workflow Checklist

- [ ] **Backtest Phase**
  - [ ] Implement AI signal generator
  - [ ] Run backtest with 500+ price bars
  - [ ] Verify win rate > 50%
  - [ ] Verify profit factor > 1.5
  - [ ] Document results

- [ ] **Paper Trading Phase**
  - [ ] Trade in PaperTraderDashboard for 1+ week
  - [ ] Verify consistent profitability
  - [ ] Test all edge cases
  - [ ] Monitor for issues

- [ ] **Server Setup**
  - [ ] Set up API endpoint with rate limiting
  - [ ] Configure Redis for production
  - [ ] Set environment variables
  - [ ] Test with curl/Postman

- [ ] **Live Trading**
  - [ ] Start with small position sizes (0.01 BTC)
  - [ ] Monitor closely first day
  - [ ] Gradually increase size
  - [ ] Set up alerts for errors

## File Structure

```
crypto-ai-trader/
├── rate-limiter.ts              # Rate limiting engine
├── trade-with-rate-limit.ts     # API endpoint
├── redis-setup.ts               # Redis configuration
│
├── trade-client.ts              # Client trading class
├── trade-executor.tsx           # React trading UI
│
├── paper-trader.ts              # Paper trading engine
├── use-paper-trader.ts          # React hook
├── paper-trader-dashboard.tsx   # Dashboard UI
│
├── ai-backtest.ts               # Backtest engine
│
├── IMPLEMENTATION_SUMMARY.md    # Quick reference
├── RATE_LIMITING_GUIDE.md       # Rate limiting
├── TRADE_CLIENT_GUIDE.md        # Client usage
├── PAPER_TRADING_GUIDE.md       # Paper trading
└── COMPLETE_TRADING_SYSTEM.md   # This file
```

## Key Metrics to Monitor

### Before Going Live
- **Win Rate**: > 50% (aim for 55-65%)
- **Profit Factor**: > 1.5 (total wins / total losses)
- **Avg Win / Avg Loss**: > 1.0
- **Max Drawdown**: < 20%

### During Live Trading
- **Daily P&L**: Track daily profits/losses
- **Rate Limit Status**: Monitor remaining requests
- **Execution Time**: Should be < 1 second
- **Error Rate**: Should be < 1%

## Common Issues & Solutions

### Issue: Rate Limited Frequently
**Solution**: Increase time between trades or upgrade rate limit tier

### Issue: Low Win Rate in Live vs Paper
**Solution**: Account for slippage, fees, and faster execution

### Issue: High Drawdown
**Solution**: Reduce position size or tighten stop losses

### Issue: API Timeout
**Solution**: Increase timeout or improve network connection

## Next Steps

1. **Customize AI** - Implement your trading logic
2. **Backtest** - Run 500+ candle backtest
3. **Paper Trade** - Test for 1+ week
4. **Go Live** - Start with small sizes
5. **Monitor & Improve** - Track metrics and adjust

Good luck! 🚀

