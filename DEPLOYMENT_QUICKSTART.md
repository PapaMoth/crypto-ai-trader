# Deployment Quick Start - From Zero to Live Trading

## 📋 Prerequisites

```bash
# Install dependencies
npm install crypto  # For HMAC signatures

# Set up environment
export BINANCE_API_KEY="your_testnet_key"
export BINANCE_API_SECRET="your_testnet_secret"
export KRAKEN_API_KEY="your_kraken_key"
export KRAKEN_API_SECRET="your_kraken_secret"  # Base64 encoded
```

---

## 🚀 One-Command Deploy

### Option 1: Binance (Recommended for beginners)

```typescript
// deploy-binance.ts
import { LiveTrainingService } from "./live-training-service";
import { AIIntegratedBinanceTrader } from "./authenticated-binance-trader";

async function deploy() {
  console.log("🚀 STARTING BINANCE BOT DEPLOYMENT\n");

  // Step 1: Start evolution
  const evolution = new LiveTrainingService({
    evolutionEnabled: true,
    cycleIntervalMinutes: 5,
    populationSize: 150,
    generationsPerCycle: 50,
    binanceSymbol: "BTCUSDT",
    binanceInterval: "1h",
    binanceTestnet: true,  // ← Start with testnet!
    historicalBarsPerCycle: 2000,
    liveTrading: true,
    initialBalance: 100,   // Start small!
    autoRollback: true,
  });

  await evolution.start();
  console.log("✅ Evolution service started\n");

  // Step 2: Wait for first evolved strategy
  await new Promise(r => setTimeout(r, 600000)); // 10 minutes

  // Step 3: Get evolved strategy
  const stats = evolution.getEvolutionStats();
  if (!stats || stats.currentBestFitness < 40) {
    throw new Error("Strategy fitness too low - need more evolution");
  }

  console.log(`✅ Strategy ready: Fitness ${stats.currentBestFitness}/100\n`);

  // Step 4: Initialize AI trading with evolved strategy
  const bestGenes = (await new Promise(r => {
    const genes = evolution.getEvolutionStats().genes;
    if (genes) r(genes);
  })) as any;

  const aiTrading = new LiveTradingWithEvolvedStrategy({
    symbol: "BTCUSDT",
    initialBalance: 100,
    evolvedGenes: bestGenes,
    autoRollback: true,
    performanceThreshold: 50,
    strategyName: "Evolved-Bot-v1",
  });

  aiTrading.start();
  console.log("✅ AI engine started\n");

  // Step 5: Initialize trader with real API
  const trader = new AIIntegratedBinanceTrader(
    {
      apiKey: process.env.BINANCE_API_KEY!,
      apiSecret: process.env.BINANCE_API_SECRET!,
      testnet: true, // Testnet first!
    },
    aiTrading,
    "BTCUSDT"
  );

  await trader.start();
  console.log("✅ Trader authenticated and ready\n");

  // Step 6: Start price streaming
  const binanceConnector = new BinanceConnector({
    symbol: "BTCUSDT",
    interval: "1h",
    limit: 1000,
    testnet: true,
  });

  // Fetch initial prices
  const prices = await binanceConnector.fetchLatest(100);
  console.log(`✅ Fetched ${prices.length} price bars\n`);

  // Step 7: Main trading loop
  console.log("🤖 BOT RUNNING - Process prices every minute\n");
  
  setInterval(async () => {
    try {
      const latestPrices = await binanceConnector.fetchLatest(50);
      const currentPrice = latestPrices[latestPrices.length - 1].close;

      await trader.processPrice(currentPrice);

      const stats = trader.getStats();
      console.log(`[${new Date().toISOString()}] Price: $${currentPrice.toFixed(2)} | Trades: ${stats.totalTrades} | Win: ${stats.winningTrades}/${stats.totalTrades}`);
    } catch (error) {
      console.error("⚠️ Error in trading loop:", error);
    }
  }, 60000); // Every minute

  // Step 8: Monitoring
  setInterval(() => {
    const stats = trader.getStats();
    console.log("\n📊 Status Report:");
    console.log(`  Balance: $${stats.currentBalance.toFixed(2)}`);
    console.log(`  Profit: $${stats.totalProfit.toFixed(2)}`);
    console.log(`  Trades: ${stats.totalTrades}`);
    console.log(`  Win Rate: ${(stats.winningTrades / Math.max(1, stats.totalTrades) * 100).toFixed(1)}%`);
    
    // Check health
    if (stats.winRate < 40) {
      console.error("⚠️ WARNING: Win rate below 40%");
    }
    if (stats.currentBalance < 80) {
      console.error("⚠️ WARNING: Account balance critical");
    }
  }, 600000); // Every 10 minutes
}

deploy().catch(console.error);
```

### Option 2: Kraken

```typescript
// deploy-kraken.ts
import { LiveTrainingService } from "./live-training-service";
import { AIIntegratedKrakenTrader } from "./authenticated-kraken-trader";

async function deploy() {
  console.log("🚀 STARTING KRAKEN BOT DEPLOYMENT\n");

  // Same as Binance but using Kraken credentials
  const trader = new AIIntegratedKrakenTrader(
    {
      apiKey: process.env.KRAKEN_API_KEY!,
      apiSecret: process.env.KRAKEN_API_SECRET!,
    },
    aiTrading,
    "XBTUSDT" // Kraken pairs are different
  );

  await trader.start();
  // ... rest is same
}
```

---

## 📊 Safe Progression

### Day 1-7: Testnet ($100)
```bash
# Run: deploy-binance.ts with testnet: true, initialBalance: 100
Expected: 50%+ win rate, $95-105 balance
Status: ✅ Ready to escalate?
```

### Day 8-14: Paper Trading
```typescript
// No real orders, just track signals
// Should show same performance as testnet
Expected: Consistent 50%+ win rate
Status: ✅ Ready for small live?
```

### Day 15-21: Live Trading ($500)
```bash
# Run: deploy-binance.ts with testnet: false, initialBalance: 500
Expected: Profitable, 50%+ win rate
Status: ✅ Ready for more capital?
```

### Day 22+: Scale Up
```bash
# Increase to $1000, $5000, $10000
# Only if consistent profitability
```

---

## 🔥 Instant Kill Switch

If anything goes wrong:

```typescript
// Emergency stop
await trader.stop();
console.log("🛑 TRADING STOPPED");

// Cancel all orders
const orders = await trader.getOpenOrders("BTCUSDT");
for (const order of orders) {
  await trader.cancelOrder(order.txid);
}

// Get results
const stats = trader.getStats();
console.log(`Final Balance: $${stats.currentBalance.toFixed(2)}`);
console.log(`Total Profit: $${stats.totalProfit.toFixed(2)}`);

// Exit process
process.exit(0);
```

---

## 📈 Success Metrics

### After 1 Week:
- [ ] Win rate > 50%
- [ ] Daily consistency
- [ ] Zero crashes
- [ ] No API errors

### After 1 Month:
- [ ] Profitable (profit > fees)
- [ ] < 10% max drawdown
- [ ] 50+ trades
- [ ] Auto-rollback never triggered

### Decision Point:
```
If winning → Scale position size
If losing  → Go back to tuning phase
If neutral → Run another 2 weeks
```

---

## 🛡️ Top 5 Safety Rules

1. **Never skip testnet**
   - Always test for 1 week first

2. **Always start small**
   - $100 → $500 → $1000 → $5000+
   - Never jump to full amount

3. **Monitor daily**
   - Check win rate every morning
   - Review overnight trades

4. **Have an exit plan**
   - Know when to stop trading
   - Have profit targets
   - Have stop-loss thresholds

5. **Never trade with rent money**
   - Only use capital you can afford to lose
   - Start with small position size

---

## 🚨 Warning Signs - STOP Immediately

❌ Win rate drops below 40%
❌ Balance drops > 20%
❌ Same error repeating
❌ Can't place/cancel orders
❌ API unreachable
❌ Balance doesn't match expected
❌ Strategy performs opposite of testnet

**If ANY of these happen: STOP. DEBUG. RESTART FROM TESTNET.**

---

## Complete Command Sequence

```bash
# 1. Set credentials
export BINANCE_API_KEY="testnet-key"
export BINANCE_API_SECRET="testnet-secret"

# 2. Start evolution + trading
npx ts-node deploy-binance.ts

# 3. Monitor output
# 🚀 STARTING BINANCE BOT DEPLOYMENT
# ✅ Evolution service started
# ✅ Strategy ready: Fitness 65.3/100
# ✅ AI engine started
# ✅ Trader authenticated
# ✅ Fetched 100 price bars
# 🤖 BOT RUNNING

# 4. Check status (new terminal)
tail -f trading.log

# 5. Kill if needed (Ctrl+C to stop)

# 6. Review results
cat trading-report.json
```

---

## 🎯 Next Steps

1. **Read SAFE_DEPLOYMENT.md** - Full checklist before going live
2. **Read INTEGRATION_GUIDE.md** - Complete architecture overview
3. **Start with testnet** - Run deploy-binance.ts for 7 days
4. **Monitor closely** - Check daily, especially first week
5. **Scale gradually** - Double position size only if profitable
6. **Adjust if needed** - Rerun evolution if win rate drops

---

## Files You'll Need

```
crypto-ai-trader/
├── authenticated-binance-trader.ts    (API client)
├── authenticated-kraken-trader.ts     (API client)
├── evolved-strategy-injector.ts       (AI engine)
├── background-evolution.ts            (Genetic algorithm)
├── live-training-service.ts           (Orchestrator)
├── binance-connector.ts               (Price data)
├── indicators.ts                      (Signals)
├── strategy-evolution.ts              (Evolution engine)
├── INTEGRATION_GUIDE.md               (How it works)
├── SAFE_DEPLOYMENT.md                 (Checklist)
├── DEPLOYMENT_QUICKSTART.md           (This file)
├── .env                               (Your credentials)
└── trading.log                        (Logs)
```

---

## Need Help?

**Testnet not working?**
- Check API credentials are testnet, not mainnet
- Verify IP whitelist includes your current IP

**Orders not executing?**
- Check balance > minimum trade size
- Check rate limiting isn't blocking trades

**Win rate too low?**
- Let evolution run longer (more cycles)
- Reduce position size to lower risk
- Try different market conditions

**Strange errors?**
- Check logs for exact error
- Check API docs for rate limits
- Verify market is open (don't trade weekends)

---

## You're Ready! 🚀

```
Test Setup ✅
Evolution Running ✅  
Strategy Optimized ✅
AI Trading ✅
Real Orders ✅
Monitoring ✅

→ START BOT → MONITOR → SCALE → PROFIT ←
```

**Now let's make some money! 💰**
