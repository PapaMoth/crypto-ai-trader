# Kraken Paper Trading Validation Guide

## 📊 Overview

Before deploying your trading bot to testnet or live trading, validate your strategy using **real Kraken price data** in a paper trading simulation. This runs your AI trading logic on historical prices without placing actual orders.

---

## 🚀 Quick Start

### Run Default Configuration (30 days BTC)

```bash
npx ts-node run-kraken-paper-trading.ts
```

### Run with Custom Settings

```bash
# 7 days of Ethereum trading with $5k starting balance
npx ts-node run-kraken-paper-trading.ts --pair ETHUSDT --days 7 --balance 5000

# 14 days of Bitcoin with 4-hour candles
npx ts-node run-kraken-paper-trading.ts --interval 240 --days 14

# 60 days with larger initial balance
npx ts-node run-kraken-paper-trading.ts --days 60 --balance 25000
```

---

## ⚙️ Configuration Options

| Option | Default | Description | Examples |
|--------|---------|-------------|----------|
| `--pair` | `XBTUSDT` | Kraken trading pair | `XBTUSDT`, `ETHUSDT`, `XBTUSD` |
| `--interval` | `60` | Candle interval (minutes) | `1`, `5`, `15`, `30`, `60`, `240`, `1440` |
| `--balance` | `10000` | Starting capital ($) | `5000`, `10000`, `50000` |
| `--days` | `30` | Days of historical data | `7`, `14`, `30`, `60`, `90` |
| `--no-save` | — | Don't save report to file | — |
| `--help` | — | Show help message | — |

---

## 📋 Understanding the Report

### Performance Metrics

```
📊 SESSION DETAILS
─────────────────────────────────────────────────────────────────
Trading Pair:          XBTUSDT
Initial Balance:       $10,000.00
Final Balance:         $10,542.15
Total P&L:             +$542.15 (+5.42%)

💰 TRADING PERFORMANCE
─────────────────────────────────────────────────────────────────
Total Trades:          45
Winning Trades:        28 (62.2%)
Losing Trades:         17
Average Win:           $32.45
Average Loss:          -$18.23
Profit Factor:         1.78x
Max Drawdown:          -$856.32 (-8.56%)
```

### Key Metrics Explained

**Win Rate** (Should be > 50%)
- Percentage of trades that make money
- 50-60%: Good
- 60%+: Excellent
- <40%: Strategy needs optimization

**Profit Factor** (Should be > 1.5x)
- Ratio of total wins to total losses
- 1.0x = Breaking even
- 1.5x = Good (Wins are 1.5x larger than losses)
- 2.0x+ = Excellent

**Max Drawdown** (Should be < 15%)
- Largest peak-to-trough decline
- <5%: Very stable
- 5-10%: Good
- 10-15%: Acceptable
- >15%: Risky for live trading

---

## 🔍 Readiness Assessment

### ✅ Ready for Testnet

Your strategy is ready to deploy to Binance/Kraken testnet if:

```
✅ Win Rate > 50%
✅ Profit Factor > 1.5x
✅ Max Drawdown < 15%
✅ Positive overall P&L
```

**Next Step:** Deploy to testnet with $100 starting balance (SAFE_DEPLOYMENT.md Phase 2)

### ⚠️ Needs Improvement

If metrics are marginal:

```
⚠️ Win Rate 45-50%
⚠️ Profit Factor 1.2-1.5x
⚠️ Max Drawdown 15-20%
```

**Options:**
1. Run paper trading for 60+ days to build confidence
2. Adjust strategy parameters manually
3. Run genetic algorithm evolution to optimize

### ❌ Not Ready

If metrics are poor:

```
❌ Win Rate < 40%
❌ Negative P&L
❌ Max Drawdown > 20%
```

**Next Step:** Run genetic algorithm to optimize strategy (SAFE_DEPLOYMENT.md Phase 1)

---

## 📈 Sample Scenarios

### Scenario 1: Validate Default Strategy (30 days)

```bash
npx ts-node run-kraken-paper-trading.ts
```

Expected behavior:
- Uses default evolved genes from genetic algorithm
- Processes 720 hourly candles (30 × 24)
- Generates buy/sell signals based on RSI + Bollinger Bands
- Shows all trades with entry/exit prices
- Reports final metrics

**Decision Matrix:**
| Outcome | Action |
|---------|--------|
| Win Rate > 55%, PF > 1.7, DD < 10% | ✅ Deploy to testnet now |
| Win Rate 50-55%, PF 1.5-1.7, DD 10-15% | ⚠️ Run 2 more weeks paper trading |
| Win Rate < 50% or negative P&L | ❌ Optimize strategy with GA |

---

### Scenario 2: Optimize Before Deploying (90 days)

```bash
npx ts-node run-kraken-paper-trading.ts --days 90 --balance 10000
```

This is the **safest approach**:
- Tests strategy over 3 months of market data
- Includes different market conditions (trending, sideways, volatile)
- More statistically significant results
- Better confidence before risking real money

**Red Flags:**
- ❌ Drawdown increases over time → Strategy breaks down
- ❌ Win rate drops in month 2 → Not robust
- ❌ Equity curve shows declining trend → Optimization failed

---

### Scenario 3: Test Different Time Frames

```bash
# 4-hour candles, 60 days
npx ts-node run-kraken-paper-trading.ts --interval 240 --days 60

# 15-minute candles, 14 days
npx ts-node run-kraken-paper-trading.ts --interval 15 --days 14

# Daily candles, 90 days
npx ts-node run-kraken-paper-trading.ts --interval 1440 --days 90
```

**Why different intervals?**
- Shorter intervals (1m-15m): More trades, higher frequency, more slippage risk
- Medium intervals (1h-4h): Balanced, good for reliable signals
- Longer intervals (daily): Fewer trades, larger moves, overnight gaps

---

## 🛡️ Paper Trading vs Live Trading

### Differences to Be Aware Of

| Factor | Paper Trading | Live Trading |
|--------|---------------|--------------|
| Slippage | None | 0.1-0.5% |
| Fees | Not included | 0.1% per trade |
| Execution | Instant | Possible delay |
| Liquidity | Assumed perfect | May be limited |
| Overnight gaps | Handled smoothly | Can be significant |

**Impact on live trading:**
- If paper trading shows 5% profit, expect ~3% after fees/slippage
- Higher frequency = More fees
- Volatile pairs = More slippage

**Adjustment factor:** Reduce expected profit by 1-2% per month for fees

---

## 📊 Report Interpretation Examples

### Example 1: Ready for Deployment ✅

```
Initial Balance:       $10,000.00
Final Balance:         $10,847.35
Profit:                +$847.35 (+8.47%)

Total Trades:          52
Win Rate:              57.7% (30 wins, 22 losses)
Profit Factor:         1.92x
Max Drawdown:          -$743.22 (-7.43%)

Status:                ✅ GOOD - Ready for small live trading
Next Step:             Deploy to testnet with small $100 balance
```

**Assessment:**
- Win rate above 50% ✅
- Profit factor strong at 1.92x ✅
- Drawdown moderate at 7.43% ✅
- Overall profitability positive ✅

**Recommendation:** Deploy to Binance/Kraken testnet with $100

---

### Example 2: Needs Optimization ⚠️

```
Initial Balance:       $10,000.00
Final Balance:         $10,123.45
Profit:                +$123.45 (+1.23%)

Total Trades:          87
Win Rate:              48.3% (42 wins, 45 losses)
Profit Factor:         1.18x
Max Drawdown:          -$1,845.32 (-18.45%)

Status:                ⚠️ MARGINAL - Profit factor weak
Next Step:             Run another 2 weeks paper trading
```

**Assessment:**
- Win rate below 50% ⚠️
- Profit factor weak at 1.18x ⚠️
- Drawdown high at 18.45% ⚠️
- Profit minimal at 1.23% ⚠️

**Recommendation:** Optimize parameters before deploying

---

### Example 3: Strategy Not Working ❌

```
Initial Balance:       $10,000.00
Final Balance:         $9,234.56
Profit:                -$765.44 (-7.65%)

Total Trades:          124
Win Rate:              39.5% (49 wins, 75 losses)
Profit Factor:         0.84x
Max Drawdown:          -$2,134.78 (-21.35%)

Status:                ❌ POOR - Win rate too low
Next Step:             Reoptimize strategy with genetic algorithm
```

**Assessment:**
- Win rate too low at 39.5% ❌
- Profit factor below 1.0x (losing money) ❌
- Large drawdown at 21.35% ❌
- Negative overall return ❌

**Recommendation:** Run genetic algorithm evolution to find better parameters

---

## 🔄 Workflow: Paper Trading → Testnet → Live

### Phase Progression

```
┌─────────────────────┐
│ Paper Trading       │
│ (Real data, no $)   │
│ Win rate > 50%?     │
└──────────┬──────────┘
           │
           ✅ YES
           │
           ▼
┌─────────────────────┐
│ Testnet ($100)      │
│ 7 days execution    │
│ Real trades, fake $ │
│ Win rate stable?    │
└──────────┬──────────┘
           │
           ✅ YES
           │
           ▼
┌─────────────────────┐
│ Live ($500)         │
│ Small real trades   │
│ 14 days execution   │
│ Profitable?         │
└──────────┬──────────┘
           │
           ✅ YES
           │
           ▼
┌─────────────────────┐
│ Scale ($5k+)        │
│ Only if profitable  │
│ Every 2 weeks       │
│ Double if good      │
└─────────────────────┘
```

---

## 📝 Paper Trading Checklist

Before considering your strategy ready:

```
Testing Duration:
☐ At least 7 days (168 hours)
☐ Ideally 30+ days for statistical significance
☐ 60+ days for high confidence

Performance Metrics:
☐ Win rate ≥ 50%
☐ Profit factor ≥ 1.5x
☐ Max drawdown ≤ 15%
☐ Positive net profit
☐ Consistent daily/weekly results

Risk Management:
☐ Position sizing correct
☐ Stop loss working
☐ Take profit working
☐ No runaway losses

Data Quality:
☐ No gaps in price data
☐ Realistic volume
☐ Consistent candle timing
☐ No obvious data errors

Ready for Testnet:
☐ All above criteria met
☐ Feel confident in strategy
☐ Can monitor testnet for 7 days
☐ Have emergency stop procedure
```

---

## 🐛 Troubleshooting

### "No price history received from Kraken"

**Cause:** API connection issue or rate limiting

**Fix:**
```bash
# Wait a moment and retry
sleep 5
npx ts-node run-kraken-paper-trading.ts

# Or increase wait time
npx ts-node run-kraken-paper-trading.ts --days 7  # Fetch less data
```

### "Strategy generates no trades"

**Cause:** Parameters too strict, signals never fire

**Fix:**
- Adjust RSI thresholds (make them wider: 20-80 instead of 30-70)
- Loosen Bollinger Band deviation (use 1.5 instead of 2.0)
- Check indicators are calculating correctly

### "All trades are losses"

**Cause:** Strategy signal logic inverted or market conditions poor

**Fix:**
- Run on different --days (some periods better than others)
- Check if market was trending down (strategy works better in up trends)
- Review signal generation logic

### "Simulation runs very slowly"

**Cause:** Processing large amount of data or slow API

**Fix:**
```bash
# Use fewer days
npx ts-node run-kraken-paper-trading.ts --days 7

# Use longer candles (fewer to process)
npx ts-node run-kraken-paper-trading.ts --interval 240  # 4-hour
```

---

## 📚 Next Steps

1. **Run Paper Trading**
   ```bash
   npx ts-node run-kraken-paper-trading.ts
   ```

2. **Analyze Results**
   - Check generated report file
   - Compare metrics to readiness criteria
   - Make note of win rate and drawdown

3. **Decide Next Action**
   - ✅ Metrics good? → Go to SAFE_DEPLOYMENT.md Phase 2 (Testnet)
   - ⚠️ Metrics marginal? → Run another 30 days paper trading
   - ❌ Metrics poor? → Run genetic algorithm for optimization

4. **Track Everything**
   - Save reports for each run
   - Note parameter changes
   - Compare improvements over time

---

## 🎯 Success Criteria

After paper trading:

```
BEFORE TESTNET DEPLOYMENT, ENSURE:

✅ Win Rate      56%+ (better than 50/50 random)
✅ Profit Factor 1.7x+ (wins are significantly bigger)
✅ Drawdown      < 10% (strategy is stable)
✅ P&L           +5%+ (at least some profit)
✅ Consistency   All metrics trending positive

IF ALL ✅ → SAFE TO DEPLOY TO TESTNET
```

---

## 💡 Pro Tips

1. **Run Multiple Scenarios**
   - Different time periods (bull, bear, sideways market)
   - Different starting balances
   - Different intervals

2. **Compare Against Baseline**
   - Run with conservative parameters
   - Run with aggressive parameters
   - Find the sweet spot

3. **Document Everything**
   - Screenshot reports
   - Note what worked/didn't
   - Build a strategy library

4. **Automate Testing**
   - Create batch scripts for multiple runs
   - Compare results systematically
   - Track improvement over time

---

**Ready to validate? Start with:**

```bash
npx ts-node run-kraken-paper-trading.ts
```

Then review the report and decide next steps! 🚀
