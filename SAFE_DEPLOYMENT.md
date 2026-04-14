# Safe Deployment Guide - Live Bot Checklist

## ⚠️ Critical: Read This Before Going Live

This guide ensures you deploy your AI trading bot safely and can recover from issues quickly.

---

## Phase 1: Pre-Deployment (1-2 weeks before live)

### ✅ Checklist: Environment Setup

- [ ] Create separate API keys for:
  - [ ] **Testnet trading** (for practice)
  - [ ] **Paper trading** (real prices, no orders)
  - [ ] **Live trading** (real money)
- [ ] Store credentials in `.env` file (NEVER in code)
- [ ] Add `.env` to `.gitignore`
- [ ] Restrict API keys to required permissions only:
  - [ ] Query Funds (balance checking)
  - [ ] Query Orders (order status)
  - [ ] Create & Modify Orders (place trades)
  - [ ] ❌ Disable: Withdraw Funds, Transfer, Margin Trading
- [ ] Set API IP whitelist to your server IP
- [ ] Enable 2FA on exchange account
- [ ] Verify you can access testnet API

### ✅ Checklist: Code Review

```typescript
// Before going live, ensure ALL of these are done:

// 1. Error handling
try {
  await trader.placeMarketOrder(...)
} catch (error) {
  logger.error("Order failed", error);
  alerting.sendAlert("TRADE FAILED");
}

// 2. Balance validation
const balance = await trader.getBalance("USDT");
if (parseFloat(balance) < minimumBalance) {
  throw new Error("Insufficient balance - STOPPING TRADING");
}

// 3. Position sizing
const maxRiskPerTrade = initialBalance * 0.02; // 2% max
const quantity = maxRiskPerTrade / currentPrice;

// 4. Stop losses
{
  entryPrice: 50000,
  stopLoss: 50000 * 0.99,  // 1% below entry
  takeProfit: 50000 * 1.02  // 2% above entry
}

// 5. Rate limiting
await rateLimit(100); // 100ms between requests

// 6. Logging
logger.info({
  timestamp: new Date(),
  signal: "BUY",
  price: currentPrice,
  quantity: quantity,
  account_balance: balance,
})
```

---

## Phase 2: Testnet Training (1 week)

### Step 1: Run on Testnet

```typescript
import { AIIntegratedBinanceTrader } from "./authenticated-binance-trader";
import { LiveTrainingService } from "./live-training-service";

// Start with TESTNET CREDENTIALS
const evolutionService = new LiveTrainingService({
  binanceSymbol: "BTCUSDT",
  binanceInterval: "1h",
  binanceTestnet: true,  // ← TESTNET
  liveTrading: true,
  initialBalance: 1000,   // Start small
  autoRollback: true,
});

await evolutionService.start();

// Wait 5 minutes for first evolution
await sleep(300000);

// Get best strategy
const bestGenes = evolutionService.getEvolutionStats();

// Initialize AI
const aiTrading = new LiveTradingWithEvolvedStrategy({
  symbol: "BTCUSDT",
  initialBalance: 1000,
  evolvedGenes: bestGenes.genes,
  autoRollback: true,
  performanceThreshold: 45,
});

const trader = new AIIntegratedBinanceTrader(
  {
    apiKey: process.env.BINANCE_TESTNET_API_KEY,
    apiSecret: process.env.BINANCE_TESTNET_API_SECRET,
    testnet: true,
  },
  aiTrading,
  "BTCUSDT"
);

await trader.start();
```

### Step 2: Validate

- [ ] **Order Execution**: Can place market orders successfully?
- [ ] **Balance Tracking**: Does balance update correctly after orders?
- [ ] **Signal Generation**: Is AI generating reasonable signals?
- [ ] **Win Rate**: > 45% win rate on testnet?
- [ ] **No Errors**: Run for 7 days with zero crashes?

### Validation Report Template
```
Testnet Results (1 week):
├─ Trades Executed: 156
├─ Winning Trades: 72 (46.2%)
├─ Average Profit: $15.23 per trade
├─ Largest Win: $124.50
├─ Largest Loss: -$45.20
├─ Max Drawdown: 8.3%
├─ Uptime: 100%
└─ Ready for Paper Trading: ✅ YES
```

---

## Phase 3: Paper Trading (1 week)

Use real prices but DON'T place actual orders:

```typescript
// Paper trading mode - tracks signals without executing
class PaperTradingMode {
  private balance: number;
  private openPositions: Position[] = [];
  private trades: Trade[] = [];

  async processPriceUpdate(price: number) {
    const signal = this.aiTrading.executeSignal(prices);
    
    if (signal.action === "BUY") {
      // DON'T place real order
      this.openPositions.push({
        entryPrice: price,
        quantity: this.calculateQuantity(),
        timestamp: Date.now(),
      });
      console.log(`[PAPER] BUY: ${quantity} @ ${price}`);
    } else if (signal.action === "SELL") {
      // Simulate exit
      const profit = (price - position.entryPrice) * position.quantity;
      this.balance += profit;
      this.trades.push({ type: "SELL", profit });
      console.log(`[PAPER] SELL: profit $${profit.toFixed(2)}`);
    }
  }

  getResults() {
    return {
      totalTrades: this.trades.length,
      winRate: this.trades.filter(t => t.profit > 0).length / this.trades.length,
      totalProfit: this.trades.reduce((sum, t) => sum + t.profit, 0),
    };
  }
}
```

### Paper Trading Validation

- [ ] **Win Rate > 50%**: If not, go back to tuning
- [ ] **Drawdown < 15%**: High drawdown = risky strategy
- [ ] **Consistent**: Multiple days with profits
- [ ] **No edge**: If losing, DON'T trade live

---

## Phase 4: Live Trading - SMALL POSITION SIZE

### Step 1: Start Tiny ($100)

```typescript
// FIRST LIVE DEPLOYMENT
const trader = new AIIntegratedBinanceTrader(
  {
    apiKey: process.env.BINANCE_API_KEY,      // PRODUCTION KEY
    apiSecret: process.env.BINANCE_API_SECRET,
    testnet: false,  // ← MAINNET
  },
  aiTrading,
  "BTCUSDT"
);

// Start with $100 only
aiTrading.initialBalance = 100;  // Not $10,000

// Enable all safeguards
{
  autoRollback: true,
  performanceThreshold: 50,
  maxDrawdown: 10,
  maxDailyLoss: 20,  // Stop trading if lose $20/day
  takeProfit: 0.02,  // Take profit at 2%
  stopLoss: 0.01,    // Stop loss at 1%
}

await trader.start();
```

### Step 2: 24/7 Monitoring

```typescript
// Every 30 seconds
setInterval(async () => {
  const stats = trader.getStats();
  
  // Check for disaster conditions
  if (stats.currentBalance < stats.startBalance * 0.8) {
    // Lost > 20%, STOP TRADING
    console.error("MAJOR LOSS - STOPPING");
    await emergencyStop();
  }
  
  if (stats.winRate < 40) {
    // Win rate collapsed, ROLLBACK
    console.warn("Win rate dropped - triggering rollback");
    await autoRollback();
  }
  
  // Log metrics
  logger.info({
    timestamp: new Date(),
    balance: stats.currentBalance,
    trades: stats.totalTrades,
    wins: stats.winningTrades,
    winRate: stats.winRate,
    profit: stats.totalProfit,
  });
  
  // Send alert if something looks wrong
  if (stats.totalTrades > 10 && stats.winRate < 45) {
    alerting.sendAlert("LOW WIN RATE - REVIEW NEEDED");
  }
}, 30000);
```

### Step 3: Daily Checklist (First 7 days)

Every morning at 9am:
- [ ] Check balance is correct
- [ ] Check win rate > 45%
- [ ] Check no open orders stuck
- [ ] Check logs for errors
- [ ] Verify no API issues
- [ ] Review profit/loss
- [ ] Confirm auto-rollback working

Example Daily Report:
```
=== LIVE TRADING REPORT (Day 3) ===
Balance: $98.50 (Started $100.00)
Trades: 12
Wins: 6 (50%)
Losses: 6
Profit: -$1.50
Status: ✅ HEALTHY
Notes: Win rate good, very small sample size
Action: Continue monitoring
```

---

## Phase 5: Scale Up (Gradually)

### Never jump straight to $10,000

```
Day 1-7:   $100   ✅ Working? No bugs?
Day 8-14:  $500   ✅ Still working? Consistent?
Day 15-21: $1,000 ✅ Profitable? Win rate stable?
Day 22-30: $5,000 ✅ At least 1 month of history?
Month 2:   $10,000 ← Only if all goes well
```

### Criteria to Increase

ONLY increase position size if ALL are true:
- [ ] **Win rate > 50%** for last 7 days
- [ ] **No days with > 10% loss**
- [ ] **Auto-rollback triggered 0 times**
- [ ] **Zero API errors**
- [ ] **Zero crashed trades**
- [ ] **Consistent daily profit/loss**

If ANY of these fail:
```
❌ STOP INCREASING
↓
❌ REVIEW STRATEGY
↓
❌ RE-TEST ON TESTNET
↓
❌ RESTART FROM PHASE 2
```

---

## Emergency Procedures

### 🚨 If Something Goes Wrong

#### Case 1: AI generates bad signals
```typescript
// IMMEDIATE ACTION
await trader.stop();  // Stop all trading

// Don't just restart - investigate
const stats = trader.getStats();
if (stats.winRate < 45) {
  // Trigger manual rollback
  evolutionManager.rollback();
  // Re-test strategy before restarting
}
```

#### Case 2: API connection lost
```typescript
// Automatic reconnect with exponential backoff
async function reconnect() {
  let retries = 0;
  while (retries < 5) {
    try {
      await trader.authenticate();
      console.log("✅ Reconnected");
      break;
    } catch (error) {
      retries++;
      const delay = Math.pow(2, retries) * 1000; // 2s, 4s, 8s, 16s
      console.log(`Retry ${retries}/5 in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  if (retries === 5) {
    // Still can't connect after 5 retries
    await emergencyStop();
    alerting.sendAlert("CRITICAL: API UNREACHABLE");
  }
}
```

#### Case 3: Running out of balance
```typescript
async function checkBalance() {
  const balance = await trader.getBalance("USDT");
  
  if (balance < minimumBalance) {
    console.error("INSUFFICIENT BALANCE");
    
    // Liquidate positions
    const openOrders = await trader.getOpenOrders();
    for (const order of openOrders) {
      await trader.cancelOrder(order.txid);
    }
    
    // Deposit more or STOP
    alerting.sendAlert("NEED DEPOSIT - TRADING PAUSED");
    await trader.stop();
  }
}
```

#### Case 4: Strategy performing badly
```typescript
// If win rate drops below threshold
if (stats.winRate < 40) {
  console.warn("STRATEGY FAILURE - AUTO-ROLLBACK");
  
  // Immediately revert to previous strategy
  evolutionManager.rollback();
  
  // Notify admin
  alerting.sendAlert("STRATEGY REVERTED - REVIEW NEEDED");
  
  // Wait before restarting
  await sleep(300000); // 5 minutes
  await trader.start();
}
```

---

## Monitoring Setup

### Real-time Dashboard
```typescript
// Every minute, update metrics
const metrics = {
  timestamp: new Date(),
  balance: await trader.getBalance(),
  trades24h: lastDayTrades.length,
  winRate24h: winRate(lastDayTrades),
  profit24h: totalProfit(lastDayTrades),
  maxDrawdown: calculateDrawdown(),
  lastSignal: lastAISignal,
  lastOrder: lastExecutedOrder,
  apiRequestsPerMinute: requestCount,
  uptime: calculateUptime(),
};

// Send to monitoring service
logger.info(metrics);

// Display in UI
updateDashboard(metrics);
```

### Alerting Thresholds

```typescript
const alerts = {
  // Critical - stop everything
  BALANCE_CRITICAL: (balance < 50),
  WIN_RATE_COLLAPSED: (winRate < 40),
  API_UNREACHABLE: (apiErrors > 10),
  
  // Warning - review needed
  WIN_RATE_LOW: (winRate < 45),
  LARGE_LOSS: (dailyLoss > balance * 0.1),
  AUTO_ROLLBACK: (rolledback),
  HIGH_DRAWDOWN: (maxDrawdown > 15),
  
  // Info - track
  SIGNAL_GENERATED: (signal !== "HOLD"),
  STRATEGY_UPDATED: (newStrategySeed),
  DAILY_REPORT: (9.00am),
};

// Send alerts
for (const [alertType, condition] of Object.entries(alerts)) {
  if (condition) {
    alerting.send(alertType, metrics);
  }
}
```

---

## Post-Launch (After Going Live)

### Daily Tasks (First 30 days)

Every morning:
```
09:00 - Check overnight performance
09:15 - Review alerts from past 24h
09:30 - Check for any errors in logs
10:00 - Adjust position size if needed (only UP if good)
11:00 - Review win rate trend
17:00 - End-of-day check
22:00 - Verify no open orders before sleep
```

### Weekly Tasks

Every Monday:
- [ ] Review win rate (should be > 50%)
- [ ] Analyze largest wins/losses
- [ ] Check strategy parameters changed?
- [ ] Look for edge cases (market events?)
- [ ] Plan next steps

### Monthly Tasks

Every 30 days:
- [ ] Full performance review
- [ ] Backtest new strategy version
- [ ] Audit API access logs
- [ ] Check exchange for security alerts
- [ ] Plan parameter adjustments

---

## Red Flags - STOP IMMEDIATELY

### 🛑 Stop if ANY of these happen:

1. **Win rate drops below 40%**
   - Action: Auto-rollback strategy
   
2. **Balance drops > 20%**
   - Action: Stop trading, investigate
   
3. **Consecutive losses > 5**
   - Action: Pause trading, review
   
4. **API errors > 10 in 1 hour**
   - Action: Check connection, don't trade
   
5. **Same error repeating**
   - Action: Stop, debug, restart
   
6. **Unexpected behavior**
   - Action: STOP, review logs
   
7. **Can't place/cancel orders**
   - Action: Emergency stop
   
8. **Balance doesn't match expected**
   - Action: Pause, reconcile

---

## Success Criteria

After 30 days of live trading:
- [ ] Win rate > 50%
- [ ] Profitable (profit > fees)
- [ ] Zero crashes
- [ ] Zero stuck orders
- [ ] Auto-rollback never triggered
- [ ] Daily consistency
- [ ] < 10% max drawdown

If all ✅, you can:
- Increase position size
- Trade 24/7
- Auto-restart on server reboot

If any ❌, go back to:
- Testnet
- Recompute strategy
- Paper trading
- Test longer

---

## Final Checklist Before Pressing "GO LIVE"

```
SECURITY:
☐ API keys in .env, not in code
☐ IP whitelist set on exchange
☐ 2FA enabled on account
☐ Permissions restricted minimally
☐ No sensitive data in logs

CODE:
☐ All error cases handled
☐ Balance checks before trades
☐ Position sizing correct
☐ Stop losses working
☐ Take profits working
☐ Rate limiting enabled

TESTING:
☐ Testnet passed (1 week)
☐ Paper trading passed (1 week)
☐ Win rate > 50%
☐ Zero crashes in tests
☐ Auto-rollback tested

MONITORING:
☐ Dashboard set up
☐ Alerts configured
☐ Logging working
☐ Backup plan ready
☐ Emergency stop works

DOCUMENTATION:
☐ Runbook created
☐ Emergency procedures written
☐ Monitoring setup documented
☐ Rollback procedure tested
☐ Team trained

FINAL REVIEW:
☐ CEO/Advisor approved
☐ Risk level acceptable
☐ Can afford $X loss
☐ Sleep tonight? YES/NO
☐ 100% confidence? YES/NO
```

**If you answered NO to any question → Don't go live yet.**

---

## Remember

> "It takes discipline to let the computer trade for you. 
> Most losses come from panic or impatience.
> Let it run. Review weekly. Scale slowly."

**Safe trading! 🚀**
