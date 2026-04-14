# Complete AI Trading System Integration Guide

## 🔐 Setup Authenticated Trading

### Step 1: Get API Credentials

**Binance:**
1. Login to Binance.com
2. Settings → API Management
3. Create new API key (enable spot trading)
4. Copy API Key and Secret Key

**Kraken:**
1. Login to Kraken
2. Settings → API
3. Create new key (Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Create & Modify Orders, Cancel/Close Orders)
4. Copy API Key and Private Key

### Step 2: Configure Environment Variables

```bash
# .env or export in your shell
export BINANCE_API_KEY="your_binance_key_here"
export BINANCE_API_SECRET="your_binance_secret_here"

export KRAKEN_API_KEY="your_kraken_key_here"
export KRAKEN_API_SECRET="your_kraken_secret_here"
```

### Step 3: Start Live Authenticated Trading

```typescript
import { AIIntegratedBinanceTrader } from "./authenticated-binance-trader";
import { AIIntegratedKrakenTrader } from "./authenticated-kraken-trader";
import { LiveTradingWithEvolvedStrategy } from "./evolved-strategy-injector";
import { StrategyGenes } from "./strategy-evolution";

// Initialize AI engine with evolved genes
const evolvedGenes: StrategyGenes = {
  rsiPeriod: 16,
  rsiBuyThreshold: 28,
  rsiSellThreshold: 72,
  bBandsPeriod: 18,
  bbStdDev: 2.1,
  maPeriod: 22,
  maTypeShort: 0,
  maTypeLong: 1,
  takeProfitPercent: 0.0055,
  stopLossPercent: 0.0045,
  riskPerTrade: 0.025,
};

const aiTrading = new LiveTradingWithEvolvedStrategy({
  symbol: "BTCUSDT",
  initialBalance: 10000,
  evolvedGenes,
  autoRollback: true,
  performanceThreshold: 50,
  strategyName: "Evolved Trading Bot",
});

// For Binance
const binanceTrader = new AIIntegratedBinanceTrader(
  {
    apiKey: process.env.BINANCE_API_KEY!,
    apiSecret: process.env.BINANCE_API_SECRET!,
    testnet: false, // Set to true to start with testnet
  },
  aiTrading,
  "BTCUSDT"
);

await binanceTrader.start();

// For Kraken
const krakenTrader = new AIIntegratedKrakenTrader(
  {
    apiKey: process.env.KRAKEN_API_KEY!,
    apiSecret: process.env.KRAKEN_API_SECRET!,
  },
  aiTrading,
  "XBTUSDT"
);

await krakenTrader.start();
```

## 📊 Full Integration Architecture

```
┌─────────────────────────────────────────────────────┐
│  Evolved Strategy (from Genetic Algorithm)          │
│  - Optimized parameters for current market          │
│  - Auto-updated every 5 minutes                      │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  LiveTradingWithEvolvedStrategy (AI Engine)         │
│  - Executes trading signals                         │
│  - Tracks win rate and performance                  │
│  - Triggers auto-rollback                           │
└────────────────┬────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
┌───▼──────────────────┐  ┌──▼──────────────────┐
│  Binance Trader      │  │  Kraken Trader      │
│  - Auth API calls    │  │  - Auth API calls   │
│  - Order execution   │  │  - Order execution  │
│  - Balance tracking  │  │  - Balance tracking │
│  - Position mgmt     │  │  - Position mgmt    │
└───┬──────────────────┘  └──┬──────────────────┘
    │                         │
    │  Real Orders           │  Real Orders
    │  Real Balance          │  Real Balance
    │  Real Profits/Losses   │  Real Profits/Losses
    │                         │
    └────────────┬────────────┘
                 │
         ┌───────▼────────┐
         │  Live Markets  │
         │  BTC, ETH, etc │
         └────────────────┘
```

## 🔄 Data Flow

1. **Price Update** → AI Engine
   ```
   Real market price (from Binance/Kraken) 
   → Add to price history (last 100 prices)
   → AI analyzes with evolved strategy
   ```

2. **Signal Generation** → Trade Execution
   ```
   AI decides: BUY/SELL/HOLD
   → Check balance available
   → Place authenticated market order
   → Order fills → Update balance
   ```

3. **Performance Tracking** → AI Learning
   ```
   Trade result (profit/loss)
   → Update win rate
   → If win rate drops → Auto-rollback
   → Log to session stats
   ```

4. **Continuous Evolution** → Strategy Update
   ```
   Every 5 minutes:
   - Genetic algorithm generates new parameters
   - Backtest on latest 2000 candles
   - If >1.5% better → Deploy automatically
   - Trading continues seamlessly with new strategy
   ```

## 💡 Example: Complete Trading Session

```typescript
import { LiveTrainingService } from "./live-training-service";
import { AIIntegratedBinanceTrader } from "./authenticated-binance-trader";

// Step 1: Start background evolution
const evolutionService = new LiveTrainingService({
  evolutionEnabled: true,
  cycleIntervalMinutes: 5,
  binanceSymbol: "BTCUSDT",
  binanceInterval: "1h",
  binanceTestnet: true, // Start with testnet!
  liveTrading: true,
  initialBalance: 1000,
  autoRollback: true,
});

await evolutionService.start(); // Runs in background

// Step 2: Wait for first best strategy
await new Promise(r => setTimeout(r, 10000));

const bestGenes = evolutionService.getEvolutionStats();
if (!bestGenes) {
  throw new Error("No strategy evolved yet");
}

// Step 3: Start authenticated live trading
const aiTrading = new LiveTradingWithEvolvedStrategy({
  symbol: "BTCUSDT",
  initialBalance: 1000,
  evolvedGenes: bestGenes.genes,
  autoRollback: true,
  performanceThreshold: 50,
  strategyName: "Live Bot",
});

aiTrading.start();

const trader = new AIIntegratedBinanceTrader(
  {
    apiKey: process.env.BINANCE_API_KEY!,
    apiSecret: process.env.BINANCE_API_SECRET!,
    testnet: true,
  },
  aiTrading,
  "BTCUSDT"
);

await trader.start();

// Step 4: Stream live prices and let AI trade
const priceProvider = new SimulatedPriceProvider(); // Or real API
const prices = await priceProvider.fetchLatestPrices("BTCUSDT", 100);

for (const price of prices) {
  await trader.processPrice(price.close);
  await new Promise(r => setTimeout(r, 1000)); // 1 second between prices
}

// Step 5: Stop and get results
trader.stop();
const stats = trader.getStats();
console.log(`Total Profit: $${stats.totalProfit.toFixed(2)}`);
console.log(`Win Rate: ${(stats.winningTrades / stats.totalTrades * 100).toFixed(1)}%`);
```

## ⚠️ Important: Start with Testnet!

### Binance Testnet:
```typescript
new AuthenticatedBinanceTrader({
  apiKey: process.env.BINANCE_TESTNET_API_KEY,
  apiSecret: process.env.BINANCE_TESTNET_API_SECRET,
  testnet: true, // Use testnet API
})
```

### Progression Path:
1. ✅ **Testnet Trading** (1-2 weeks)
   - Test with fake money
   - Validate strategy performance
   - Check order execution flow
   - Verify balance tracking

2. ✅ **Paper Trading** (1 week)
   - Run simulations with real prices
   - No actual orders placed
   - Test auto-rollback triggers

3. ✅ **Small Position Size** (1 week)
   - Start with $100 initial balance
   - Monitor live performance
   - Watch for slippage and fees

4. ✅ **Scale Up** (if profitable)
   - Increase to $1000+
   - Monitor daily/weekly
   - Adjust parameters if needed

## 📈 Monitoring Live Trading

```typescript
// Check balance anytime
const balance = await trader.getBalance("USDT");
console.log(`Available USDT: ${balance.free}`);

// Check open orders
const openOrders = await trader.getOpenOrders("BTCUSDT");
console.log(`Open orders: ${openOrders.length}`);

// Check session stats
const stats = trader.getStats();
console.log(`Current Balance: $${stats.currentBalance.toFixed(2)}`);
console.log(`Total Profit: $${stats.totalProfit.toFixed(2)}`);
console.log(`Trades: ${stats.totalTrades}`);
console.log(`Win Rate: ${(stats.winningTrades / stats.totalTrades * 100).toFixed(1)}%`);
```

## 🛡️ Risk Controls

### Built-in Safeguards:
1. **Position Sizing**: Every trade uses optimized risk per trade
2. **Stop Loss**: Every position has configurable stop loss
3. **Take Profit**: Automatic profit taking at threshold
4. **Auto-Rollback**: Reverts strategy if performance drops
5. **Rate Limiting**: Prevents over-trading and API limits
6. **Order Validation**: Checks balance before placing trades

### Manual Overrides:
```typescript
// Cancel all open orders before major event
const openOrders = await trader.getOpenOrders("BTCUSDT");
for (const order of openOrders) {
  await trader.cancelOrder("BTCUSDT", order.orderId);
}

// Stop trading immediately
trader.stop();

// Check what went wrong
const stats = trader.getStats();
console.log(stats);
```

## 🔍 API Endpoints Used

### Binance:
- `GET /api/v3/account` - Get account info
- `GET /api/v3/ticker/price` - Get current price
- `POST /api/v3/order` - Place order
- `GET /api/v3/order` - Check order status
- `DELETE /api/v3/order` - Cancel order
- `GET /api/v3/openOrders` - Get open orders

### Kraken:
- `POST /0/private/Balance` - Get balances
- `POST /0/private/TradeBalance` - Get trade balance
- `POST /0/private/AddOrder` - Place order
- `POST /0/private/QueryOrders` - Query orders
- `POST /0/private/CancelOrder` - Cancel order
- `POST /0/private/OpenOrders` - Get open orders

## 🚨 Security Best Practices

1. **Never hardcode credentials**
   ```typescript
   // ❌ Bad
   const apiKey = "your-key-here";
   
   // ✅ Good
   const apiKey = process.env.BINANCE_API_KEY!;
   ```

2. **Use restricted API keys**
   - Enable only required permissions
   - Disable withdraw permission
   - Set IP whitelist

3. **Rotate secrets regularly**
   - Delete old API keys
   - Generate new ones monthly
   - Monitor access logs

4. **Use separate keys for testnet**
   - Don't use production keys for testing
   - Use dedicated testnet credentials

5. **Log trading activity**
   - Save all trades to database
   - Monitor for suspicious patterns
   - Audit regularly

---

**Now you have:**
- ✅ Real authenticated API calls
- ✅ Actual order execution
- ✅ Live balance tracking
- ✅ Full AI integration
- ✅ Two exchange support (Binance + Kraken)
