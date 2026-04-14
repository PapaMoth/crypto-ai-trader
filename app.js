// --- TradingView Chart Initialization ---
const chartProperties = {
    layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8b92a5',
    },
    grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
    },
    crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        timeVisible: true,
        secondsVisible: false,
    },
};

const domElement = document.getElementById('tv-chart');
const chart = LightweightCharts.createChart(domElement, chartProperties);
const candleSeries = chart.addCandlestickSeries({
    upColor: '#00ffa3',
    downColor: '#ff4d4d',
    borderDownColor: '#ff4d4d',
    borderUpColor: '#00ffa3',
    wickDownColor: '#ff4d4d',
    wickUpColor: '#00ffa3',
});

const vwapSeries = chart.addLineSeries({
    color: '#00f2fe',
    lineWidth: 2,
    crosshairMarkerVisible: false,
    title: 'VWAP',
});

const bbUpperSeries = chart.addLineSeries({
    color: 'rgba(255, 255, 255, 0.4)',
    lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    crosshairMarkerVisible: false,
    title: 'BB Upper',
});

const bbMiddleSeries = chart.addLineSeries({
    color: 'rgba(255, 165, 0, 0.7)',
    lineWidth: 2,
    crosshairMarkerVisible: false,
    title: 'BB Middle',
});

const bbLowerSeries = chart.addLineSeries({
    color: 'rgba(255, 255, 255, 0.4)',
    lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    crosshairMarkerVisible: false,
    title: 'BB Lower',
});
let tradeMarkers = [];

function calculateBollingerBands(data, period, stdDevMultiplier) {
    let bbUpper = [];
    let bbMiddle = [];
    let bbLower = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            bbUpper.push({ time: data[i].time, value: data[i].close });
            bbMiddle.push({ time: data[i].time, value: data[i].close });
            bbLower.push({ time: data[i].time, value: data[i].close });
            continue;
        }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
        let sma = sum / period;
        
        let sumSquares = 0;
        for (let j = i - period + 1; j <= i; j++) sumSquares += Math.pow(data[j].close - sma, 2);
        let stdDev = Math.sqrt(sumSquares / period);
        
        bbUpper.push({ time: data[i].time, value: sma + (stdDev * stdDevMultiplier) });
        bbMiddle.push({ time: data[i].time, value: sma });
        bbLower.push({ time: data[i].time, value: sma - (stdDev * stdDevMultiplier) });
    }
    return { upper: bbUpper, middle: bbMiddle, lower: bbLower };
}

function calculateRSI(data, period) {
    let rsiArray = new Array(data.length).fill(50);
    if (data.length <= period) return rsiArray;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
        let diff = data[i].close - data[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiArray[period] = 100 - (100 / (1 + rs));
    
    for (let i = period + 1; i < data.length; i++) {
        let diff = data[i].close - data[i - 1].close;
        let gain = diff >= 0 ? diff : 0;
        let loss = diff < 0 ? -diff : 0;
        
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;
        
        if (avgLoss === 0) {
            rsiArray[i] = 100;
        } else {
            rs = avgGain / avgLoss;
            rsiArray[i] = 100 - (100 / (1 + rs));
        }
    }
    
    return rsiArray;
}

const WATCHLIST_WS = ['XBT/USD', 'ETH/USD', 'SOL/USD', 'ZEC/USD'];
const REST_PAIRS = {
    'XBT/USD': 'XXBTZUSD',
    'ETH/USD': 'XETHZUSD',
    'SOL/USD': 'SOLUSD',
    'ZEC/USD': 'XZECZUSD'
};

let historicalOHLC15 = {};
let historicalOHLC5 = {};
let currentUIPair = 'XBT/USD';
for (const p of WATCHLIST_WS) {
    historicalOHLC15[p] = [];
    historicalOHLC5[p] = [];
}

// Listen for UI pair changes
document.addEventListener('DOMContentLoaded', () => {
    // Handle OAuth callback token
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');
    if (authToken) {
        currentAuthToken = authToken;
        localStorage.setItem(AUTH_TOKEN_KEY, authToken);
        setAuthStatus('Signed in via OAuth!', 'success');
        refreshAuthStatus();
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const pairSelect = document.getElementById('pair-selector');
    if (pairSelect) {
        pairSelect.addEventListener('change', (e) => {
            currentUIPair = e.target.value;
            // update visual chart to new pair immediately
            updateChartToPair(currentUIPair);
        });
    }

    setupApiKeysForm();
    renderStrategyState();
});

// Resize handler
window.addEventListener('resize', () => {
    chart.resize(domElement.clientWidth, domElement.clientHeight);
});

// --- Kraken Data Fetcher & WebSocket ---
let ws;

// Helper to format ISO to seconds timestamp for TradingView
function formatTime(isoString) {
    return Math.floor(new Date(isoString).getTime() / 1000);
}

async function fetchHistoricalData() {
    try {
        await Promise.all(WATCHLIST_WS.map(async (wsPair) => {
            const restPair = REST_PAIRS[wsPair];
            const [data15, data5] = await Promise.all([
                fetch(`https://api.kraken.com/0/public/OHLC?pair=${restPair}&interval=15`).then(r => r.json()),
                fetch(`https://api.kraken.com/0/public/OHLC?pair=${restPair}&interval=5`).then(r => r.json())
            ]);

            if (!data15.error || data15.error.length === 0) {
                const pairKey15 = Object.keys(data15.result).find(k => k !== 'last');
                const ohlc15 = data15.result[pairKey15];
                historicalOHLC15[wsPair] = ohlc15.map(chunk => ({
                    time: chunk[0],
                    open: parseFloat(chunk[1]),
                    high: parseFloat(chunk[2]),
                    low: parseFloat(chunk[3]),
                    close: parseFloat(chunk[4]),
                    vwap: parseFloat(chunk[5])
                }));
            }

            if (!data5.error || data5.error.length === 0) {
                const pairKey5 = Object.keys(data5.result).find(k => k !== 'last');
                const ohlc5 = data5.result[pairKey5];
                historicalOHLC5[wsPair] = ohlc5.map(chunk => ({
                    time: chunk[0],
                    open: parseFloat(chunk[1]),
                    high: parseFloat(chunk[2]),
                    low: parseFloat(chunk[3]),
                    close: parseFloat(chunk[4]),
                    vwap: parseFloat(chunk[5])
                }));
            }
        }));

        updateChartToPair(currentUIPair);
        startWebSocket();
    } catch (e) {
        console.error("Failed to fetch historical data", e);
    }
}

function updateChartToPair(wsPair) {
    const ohlc = historicalOHLC15[wsPair];
    if (!ohlc || ohlc.length === 0) return;
    
    const vwapData = ohlc.map(chunk => ({ time: chunk.time, value: chunk.vwap }));
    const bbData = calculateBollingerBands(ohlc, 20, 2);

    candleSeries.setData(ohlc);
    vwapSeries.setData(vwapData);
    bbUpperSeries.setData(bbData.upper);
    bbMiddleSeries.setData(bbData.middle);
    bbLowerSeries.setData(bbData.lower);
}

function startWebSocket() {
    ws = new WebSocket('wss://ws.kraken.com');
    
    ws.onopen = () => {
        console.log('Connected to Kraken WebSocket: Multi-Pair');
        ws.send(JSON.stringify({
            "event": "subscribe",
            "pair": WATCHLIST_WS,
            "subscription": {
                "name": "ohlc",
                "interval": 15
            }
        }));
        ws.send(JSON.stringify({
            "event": "subscribe",
            "pair": WATCHLIST_WS,
            "subscription": {
                "name": "ohlc",
                "interval": 5
            }
        }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        if (Array.isArray(msg) && msg[1] && msg[1].length === 9) {
            const data = msg[1];
            const wsPair = msg[3];
            const channelName = String(msg[2] || '');
            const intervalMatch = channelName.match(/ohlc-(\d+)/);
            const intervalMin = intervalMatch ? Number(intervalMatch[1]) : 15;
            
            if (!WATCHLIST_WS.includes(wsPair)) return;

            const timeEtime = Math.floor(parseFloat(data[1]));
            const currentClose = parseFloat(data[5]);
            const currentVwap = parseFloat(data[6]);
            
            const ohlcArray = intervalMin === 5 ? historicalOHLC5[wsPair] : historicalOHLC15[wsPair];
            if (!ohlcArray || ohlcArray.length === 0) return;

            let lastCandle = ohlcArray[ohlcArray.length - 1];
            
            const intervalSeconds = intervalMin * 60;
            if (lastCandle && (lastCandle.time === timeEtime || lastCandle.time > timeEtime - intervalSeconds)) {
                 lastCandle.close = currentClose;
                 lastCandle.vwap = currentVwap;
                 const liveLow = parseFloat(data[4]);
                 if (liveLow < lastCandle.low) lastCandle.low = liveLow;
            } else {
                 ohlcArray.push({ 
                     time: timeEtime, 
                     open: parseFloat(data[2]),
                     high: parseFloat(data[3]),
                     low: parseFloat(data[4]),
                     close: currentClose, 
                     vwap: currentVwap 
                 });
                 if (ohlcArray.length > 1000) ohlcArray.shift();
            }

            const bbData = calculateBollingerBands(ohlcArray, 20, 2);
            const rsiData = calculateRSI(ohlcArray, 14);

            if (wsPair === currentUIPair && intervalMin === 15) {
                strategyState.trend15m = evaluate15mBullishDirection(wsPair) ? 'READY' : 'WAIT';
                if (strategyState.trend15m !== 'READY') {
                    strategyState.entry5m = 'BLOCKED';
                }
                renderStrategyState();
            }

            if (wsPair === currentUIPair && intervalMin === 5) {
                const trendReady = evaluate15mBullishDirection(wsPair);
                const forming5m = evaluate5mEntryForming(ohlcArray, bbData, rsiData);
                const sniperReady = evaluate5mSniperEntry(ohlcArray, rsiData);
                if (!trendReady) {
                    strategyState.entry5m = 'BLOCKED';
                } else if (sniperReady) {
                    strategyState.entry5m = 'READY';
                } else if (forming5m) {
                    strategyState.entry5m = 'FORMING';
                    pingEntryForming(wsPair, ohlcArray[ohlcArray.length - 1].time);
                } else {
                    strategyState.entry5m = 'WAIT';
                }
                renderStrategyState();
            }

            if (intervalMin === 15 && wsPair === currentUIPair) {
                const currentBBUpper = bbData.upper[bbData.upper.length - 1].value;
                const currentBBMiddle = bbData.middle[bbData.middle.length - 1].value;
                const currentBBLower = bbData.lower[bbData.lower.length - 1].value;

                candleSeries.update({
                    time: timeEtime, 
                    open: parseFloat(data[2]),
                    high: parseFloat(data[3]),
                    low: parseFloat(data[4]),
                    close: currentClose,
                });
                
                vwapSeries.update({ time: timeEtime, value: currentVwap });
                bbUpperSeries.update({ time: timeEtime, value: currentBBUpper });
                bbMiddleSeries.update({ time: timeEtime, value: currentBBMiddle });
                bbLowerSeries.update({ time: timeEtime, value: currentBBLower });

                const currentRSI = Math.round(rsiData[rsiData.length - 1]);
                document.querySelector('.rsi-fill').style.width = currentRSI + '%';
                
                const rsiValEl = document.getElementById('rsi-value');
                if(rsiValEl) rsiValEl.innerText = currentRSI;
            }
            
            if (intervalMin === 5) {
                simulateSignal(wsPair, currentClose, ohlcArray, bbData, rsiData);
            }
        }
    };
}

// --- AI Trade Simulation ---
const signalsList = document.getElementById('signals-list');
let totalBalance = 142450.00;
let tradesCount = 14;
let lastSignalTime = 0;
let activeTradePair = null;
let lastBuyPrice = 0;
let highestPriceSinceEntry = 0;
let trailingStopPrice = 0;
let trailingStopTier = 0;
let entryPositionUsd = 0;
let remainingPositionUsd = 0;
let partialTake20Done = false;
let keepRunnerUsd = 0;
let totalSoldUsd = 0;
let nextTradeBuyUsd = 0;
let lastEmergencyStatus = 'CLEAR';
let lastEntryPingKey = '';
let currentMarketRegime = 'UNKNOWN';
let peakBalance = totalBalance;
const tradeHistory = [];
const coinLearningBook = {};

const performanceState = {
    realizedPnlUsd: 0,
    wins: 0,
    losses: 0,
    maxDrawdownPct: 0,
    tradeReturnsPct: [],
    avgWinPct: 0,
    avgLossPct: 0,
    profitFactor: 0
};

const strategyState = {
    trend15m: 'WAIT',
    entry5m: 'WAIT',
    position: 'FLAT',
    sold: '0%',
    runner: '2%',
    emergency: 'CLEAR',
    regime: 'UNKNOWN',
    risk: '1.00x',
    trail: 'OFF'
};

function renderStrategyState() {
    const trendEl = document.getElementById('state-trend-15m');
    const entryEl = document.getElementById('state-entry-5m');
    const positionEl = document.getElementById('state-position');
    const soldEl = document.getElementById('state-sold');
    const runnerEl = document.getElementById('state-runner');
    const emergencyEl = document.getElementById('state-emergency');
    const regimeEl = document.getElementById('state-regime');
    const riskEl = document.getElementById('state-risk');
    const trailEl = document.getElementById('state-trail');

    if (trendEl) trendEl.innerText = strategyState.trend15m;
    if (entryEl) entryEl.innerText = strategyState.entry5m;
    if (positionEl) positionEl.innerText = strategyState.position;
    if (soldEl) soldEl.innerText = strategyState.sold;
    if (runnerEl) runnerEl.innerText = strategyState.runner;
    if (emergencyEl) emergencyEl.innerText = strategyState.emergency;
    if (regimeEl) regimeEl.innerText = strategyState.regime;
    if (riskEl) riskEl.innerText = strategyState.risk;
    if (trailEl) trailEl.innerText = strategyState.trail;
}

function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

function updateDashboardStats(profit, profitPct = 0) {
    totalBalance += profit;
    tradesCount++;
    performanceState.realizedPnlUsd += profit;
    performanceState.tradeReturnsPct.push(profitPct);
    if (profit >= 0) {
        performanceState.wins += 1;
    } else {
        performanceState.losses += 1;
    }
    if (totalBalance > peakBalance) peakBalance = totalBalance;
    const currentDrawdown = peakBalance > 0 ? ((peakBalance - totalBalance) / peakBalance) * 100 : 0;
    performanceState.maxDrawdownPct = Math.max(performanceState.maxDrawdownPct, currentDrawdown);

    const winningReturns = performanceState.tradeReturnsPct.filter((v) => v > 0);
    const losingReturnsAbs = performanceState.tradeReturnsPct.filter((v) => v < 0).map((v) => Math.abs(v));
    performanceState.avgWinPct = winningReturns.length
        ? winningReturns.reduce((a, b) => a + b, 0) / winningReturns.length
        : 0;
    performanceState.avgLossPct = losingReturnsAbs.length
        ? losingReturnsAbs.reduce((a, b) => a + b, 0) / losingReturnsAbs.length
        : 0;
    const grossProfit = winningReturns.reduce((a, b) => a + b, 0);
    const grossLossAbs = losingReturnsAbs.reduce((a, b) => a + b, 0);
    performanceState.profitFactor = grossLossAbs > 0 ? (grossProfit / grossLossAbs) : grossProfit > 0 ? 99 : 0;

    document.getElementById('total-balance').innerText = formatCurrency(totalBalance);
    
    // Slight random UI updates to make it feel alive
    document.querySelector('.rsi-fill').style.width = Math.floor(Math.random() * 40 + 40) + '%';
    document.getElementById('confidence-score').innerText = Math.floor(Math.random() * 15 + 80) + '%';
    updateProDashboard();
}

function updateProDashboard() {
    const totalTrades = performanceState.wins + performanceState.losses;
    const winRate = totalTrades ? (performanceState.wins / totalTrades) * 100 : 0;

    const winRateEl = document.getElementById('pro-win-rate');
    const avgWinEl = document.getElementById('pro-avg-win');
    const avgLossEl = document.getElementById('pro-avg-loss');
    const ddEl = document.getElementById('pro-drawdown');
    const pfEl = document.getElementById('pro-profit-factor');
    const regimeEl = document.getElementById('pro-regime');
    const pnlEl = document.getElementById('pro-realized');

    if (winRateEl) winRateEl.innerText = `${winRate.toFixed(1)}%`;
    if (avgWinEl) avgWinEl.innerText = `${performanceState.avgWinPct.toFixed(2)}%`;
    if (avgLossEl) avgLossEl.innerText = `${performanceState.avgLossPct.toFixed(2)}%`;
    if (ddEl) ddEl.innerText = `${performanceState.maxDrawdownPct.toFixed(2)}%`;
    if (pfEl) pfEl.innerText = performanceState.profitFactor.toFixed(2);
    if (regimeEl) regimeEl.innerText = currentMarketRegime;
    if (pnlEl) pnlEl.innerText = formatCurrency(performanceState.realizedPnlUsd);
}

function addTradeMarker(time, side, text) {
    tradeMarkers.push({
        time,
        position: side === 'BUY' ? 'belowBar' : 'aboveBar',
        color: side === 'BUY' ? '#00ffa3' : '#ff4d4d',
        shape: side === 'BUY' ? 'arrowUp' : 'arrowDown',
        text
    });
    if (tradeMarkers.length > 200) {
        tradeMarkers = tradeMarkers.slice(tradeMarkers.length - 200);
    }
    candleSeries.setMarkers(tradeMarkers);
}

function getCoinLearningState(symbol) {
    if (!coinLearningBook[symbol]) {
        coinLearningBook[symbol] = {
            wins: 0,
            losses: 0,
            score: 1
        };
    }
    return coinLearningBook[symbol];
}

function updateCoinLearning(symbol, result) {
    const state = getCoinLearningState(symbol);
    if (result === 'WIN') {
        state.wins += 1;
        state.score = Math.min(1.5, state.score + 0.04);
    } else if (result === 'LOSS') {
        state.losses += 1;
        state.score = Math.max(0.6, state.score - 0.05);
    }
}

function logClosedTrade(entry, price, type, result, profit, symbol) {
    const tradeLog = {
        time: Date.now(),
        entry,
        exit: price,
        type,
        result,
        profit,
        balance: totalBalance,
        symbol
    };
    tradeHistory.push(tradeLog);
    if (tradeHistory.length > 250) tradeHistory.shift();
    globalThis.tradeHistory = globalThis.tradeHistory || [];
    globalThis.tradeHistory.push(tradeLog);
    console.log(tradeLog);
    persistTradeLog(tradeLog);
}

async function persistTradeLog(tradeLog) {
    try {
        await fetch('/api/trades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tradeLog)
        });
    } catch (err) {
        console.warn('Failed to persist trade log:', err);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function detectMarketRegime(ohlc, bb, rsi) {
    const len = ohlc.length;
    if (len < 30 || !bb.middle[len - 1] || !bb.upper[len - 1] || !bb.lower[len - 1]) return 'UNKNOWN';

    const window = 20;
    const start = len - window;
    const end = len - 1;
    const startClose = ohlc[start].close;
    const endClose = ohlc[end].close;
    const slopePct = startClose > 0 ? ((endClose - startClose) / startClose) * 100 : 0;
    const bandWidthPct = bb.middle[end].value > 0
        ? ((bb.upper[end].value - bb.lower[end].value) / bb.middle[end].value) * 100
        : 0;
    const rsiMid = rsi[end];
    const trendMomentum = Math.abs(slopePct) >= 1.0 && bandWidthPct >= 2.2 && (rsiMid >= 57 || rsiMid <= 43);
    return trendMomentum ? 'TREND' : 'CHOP';
}

function getAiRiskMultiplier(regime, trendReady, sniperEntry, rsiValue, currentPrice, currentVwap) {
    let score = 0.5;

    if (regime === 'TREND') score += 0.25;
    if (trendReady) score += 0.15;
    if (sniperEntry) score += 0.15;
    if (currentPrice >= currentVwap) score += 0.08;
    if (rsiValue >= 45 && rsiValue <= 65) score += 0.07;

    const normalized = clamp(score, 0, 1);
    const multiplier = regime === 'TREND'
        ? (0.75 + normalized * 0.55)  // 0.75x -> 1.30x
        : (0.55 + normalized * 0.45); // 0.55x -> 1.00x

    return clamp(multiplier, 0.55, 1.3);
}

function updateDynamicTrailingStop(currentPrice, regime) {
    if (lastBuyPrice <= 0) return;
    const profitPct = ((currentPrice - lastBuyPrice) / lastBuyPrice) * 100;
    const activationPct = 0.6;

    if (profitPct < activationPct) {
        strategyState.trail = 'OFF';
        return;
    }

    highestPriceSinceEntry = Math.max(highestPriceSinceEntry, currentPrice);
    const distancePct = regime === 'TREND' ? 0.45 : 0.28;
    const trailCandidate = highestPriceSinceEntry * (1 - (distancePct / 100));
    trailingStopPrice = Math.max(trailingStopPrice, trailCandidate);

    if (profitPct >= 1.5 && trailingStopTier < 1) trailingStopTier = 1;
    if (profitPct >= 3.0 && trailingStopTier < 2) trailingStopTier = 2;
    if (profitPct >= 5.0 && trailingStopTier < 3) trailingStopTier = 3;

    strategyState.trail = trailingStopPrice > 0
        ? `${distancePct.toFixed(2)}% (${trailingStopTier})`
        : 'OFF';
}

function evaluateBuySequence(ohlc, bb, rsi) {
    const len = ohlc.length;
    if (len < 3) return false;

    // Strict rule: all three conditions must line up on the current decision candle.
    const i = len - 1;
    const nearLowerBand = ohlc[i].low <= (bb.lower[i].value * 1.015);
    const rsiValid = rsi[i] < 40;
    const holdingVWAP = ohlc[i].close >= ohlc[i].vwap;
    const reclaimingVWAP = ohlc[i - 1].close <= ohlc[i - 1].vwap && ohlc[i].close > ohlc[i].vwap;

    return nearLowerBand && rsiValid && (holdingVWAP || reclaimingVWAP);
}

function evaluate15mBullishDirection(wsPair) {
    const ohlc15 = historicalOHLC15[wsPair];
    if (!ohlc15 || ohlc15.length < 6) return false;
    const rsi15 = calculateRSI(ohlc15, 14);
    const i = ohlc15.length - 1;
    const prev = i - 1;

    // 15m directional filter:
    // 1) Price above VWAP
    // 2) RSI curling up
    // 3) Holding support (recent lows not breaking down)
    const aboveVWAP = ohlc15[i].close > ohlc15[i].vwap;
    const rsiCurlingUp = rsi15[i] > rsi15[prev];
    const holdingSupport = ohlc15[i].low >= ohlc15[prev].low * 0.995;

    return aboveVWAP && rsiCurlingUp && holdingSupport;
}

function evaluate5mSniperEntry(ohlc5, rsi5) {
    const len = ohlc5.length;
    if (len < 4 || rsi5.length < len) return false;
    const i = len - 1;
    const prev = i - 1;

    const pullbackSeen = ohlc5[prev].low < ohlc5[prev].vwap || ohlc5[prev].close < ohlc5[prev].vwap;
    const reclaimVWAP = ohlc5[prev].close <= ohlc5[prev].vwap && ohlc5[i].close > ohlc5[i].vwap;
    const strongGreenClose = ohlc5[i].close > ohlc5[i].open && ((ohlc5[i].close - ohlc5[i].open) / ohlc5[i].open) >= 0.003;

    return pullbackSeen && reclaimVWAP && strongGreenClose;
}

function evaluate5mEntryForming(ohlc5, bb5, rsi5) {
    const len = ohlc5.length;
    if (len < 4 || rsi5.length < len) return false;
    const i = len - 1;
    const prev = i - 1;

    const vwapCrossUp = ohlc5[prev].close <= ohlc5[prev].vwap && ohlc5[i].close > ohlc5[i].vwap;
    const rsiCrossAbove40 = rsi5[prev] <= 40 && rsi5[i] > 40;

    const recentStart = Math.max(0, len - 4);
    let nearLowerBandRecently = false;
    for (let x = recentStart; x <= i; x++) {
        if (ohlc5[x].low <= bb5.lower[x].value * 1.01) {
            nearLowerBandRecently = true;
            break;
        }
    }

    return vwapCrossUp && rsiCrossAbove40 && nearLowerBandRecently;
}

function pingEntryForming(wsPair, candleTime) {
    const pingKey = `${wsPair}:${candleTime}`;
    if (lastEntryPingKey === pingKey) return;
    lastEntryPingKey = pingKey;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const pingHtml = `
        <div class="signal">
            <div class="signal-info">
                <span class="signal-pair">${wsPair} (Entry Alert)</span>
                <span class="signal-time">${timeStr}</span>
            </div>
            <div class="signal-action">
                <span class="badge buy">PING 5m FORMING</span>
                <span class="signal-price">15m Trend Valid</span>
                <span class="profit-margin">VWAP/RSI/BB aligned</span>
            </div>
        </div>
    `;
    signalsList.insertAdjacentHTML('afterbegin', pingHtml);
    if (signalsList.children.length > 15) {
        signalsList.removeChild(signalsList.lastChild);
    }
}

function evaluateTakeProfitExhaustion(ohlc, bb, rsi) {
    const len = ohlc.length;
    if (len < 3) return false;

    const i = len - 1;
    const prev = i - 1;

    const rsiExhaustion = rsi[i] >= 70 || rsi[i] <= 30;
    const bollingerHit =
        ohlc[i].high >= bb.upper[i].value ||
        ohlc[i].close >= bb.upper[i].value ||
        ohlc[i].low <= bb.lower[i].value;

    // Rejection: recent close was at/above VWAP, current candle closes back below VWAP.
    const rejectsVWAP = ohlc[prev].close >= ohlc[prev].vwap && ohlc[i].close < ohlc[i].vwap;

    // Any one of your exhaustion signals triggers the 48% take-profit.
    return rsiExhaustion || bollingerHit || rejectsVWAP;
}

function evaluateStructureFailure(ohlc) {
    const len = ohlc.length;
    if (len < 4) return false;
    const i = len - 1;
    const c0 = ohlc[i];
    const c1 = ohlc[i - 1];
    const c2 = ohlc[i - 2];

    // Simple structure fail:
    // lower high + lower low progression with a bearish close.
    const lowerHigh = c0.high < c1.high;
    const lowerLow = c0.low < c1.low && c1.low < c2.low;
    const bearishClose = c0.close < c0.open;

    return lowerHigh && lowerLow && bearishClose;
}

function simulateSignal(wsPair, currentPrice, ohlc, bb, rsi) {
    const now = Date.now();
    const currentVwap = ohlc[ohlc.length - 1].vwap;

    // User typed buy amount
    const manualBuyInput = document.getElementById('manual-buy-amount');
    let userBuyAmount = parseFloat(manualBuyInput ? manualBuyInput.value : 5000);
    if (isNaN(userBuyAmount) || userBuyAmount <= 0) userBuyAmount = 5000;

    // Use dynamic sell size % set by user (fallback path for manual sell sizing)
    const sellSizeInput = document.getElementById('sell-size');
    let TRADE_SELL_PERCENT_OF_BUY = parseFloat(sellSizeInput ? sellSizeInput.value : 20);
    if (isNaN(TRADE_SELL_PERCENT_OF_BUY) || TRADE_SELL_PERCENT_OF_BUY <= 0) TRADE_SELL_PERCENT_OF_BUY = 20;

    const targetProfitInput = document.getElementById('target-profit');
    let estimatedMargin = parseFloat(targetProfitInput ? targetProfitInput.value : 15.0);
    if (isNaN(estimatedMargin) || estimatedMargin <= 0) estimatedMargin = 15.0;

    let isBuy = false;
    let isStopLoss = false;
    let isTrailStop = false;
    let isPartialTake = false;
    let forcedSellAmountUsd = 0;
    let profitPercentage = estimatedMargin;

    currentMarketRegime = detectMarketRegime(ohlc, bb, rsi);
    strategyState.regime = currentMarketRegime;
    const coinLearning = getCoinLearningState(wsPair);

    // Check strict sequential conditions to BUY
    if (!activeTradePair) {
        const bullish15m = evaluate15mBullishDirection(wsPair);
        const sniperEntry5m = evaluate5mSniperEntry(ohlc, rsi);
        const currentRsi = rsi[rsi.length - 1] || 50;
        const aiRiskMultiplier = getAiRiskMultiplier(
            currentMarketRegime,
            bullish15m,
            sniperEntry5m,
            currentRsi,
            currentPrice,
            currentVwap
        ) * coinLearning.score;
        strategyState.risk = `${aiRiskMultiplier.toFixed(2)}x`;

        if (bullish15m && sniperEntry5m) {
            if (now - lastSignalTime < 5000) return; // Prevent spamming
            isBuy = true;
            activeTradePair = wsPair; // LOCK global pool
            lastSignalTime = now;
            lastBuyPrice = currentPrice;
            highestPriceSinceEntry = currentPrice;
            trailingStopPrice = 0;
            trailingStopTier = 0;
            const baseBuyAmount = nextTradeBuyUsd > 0 ? nextTradeBuyUsd : userBuyAmount;
            entryPositionUsd = baseBuyAmount * aiRiskMultiplier;
            remainingPositionUsd = baseBuyAmount;
            partialTake20Done = false;
            keepRunnerUsd = entryPositionUsd * 0.02;
            totalSoldUsd = 0;
            nextTradeBuyUsd = 0;
            strategyState.position = 'LONG';
            addTradeMarker(ohlc[ohlc.length - 1].time, 'BUY', `BUY ${wsPair}`);
        } else {
            return; // Wait until all 3 indicators align
        }
    } else {
        // Only evaluate holding pair for selling
        if (activeTradePair !== wsPair) return;
        
        let shouldSell = false;
        const unrealizedPct = lastBuyPrice > 0 ? ((currentPrice - lastBuyPrice) / lastBuyPrice) * 100 : 0;

        // Dynamic trailing stop management (adaptive by market regime).
        updateDynamicTrailingStop(currentPrice, currentMarketRegime);

        // Emergency exits: immediate and unconditional.
        if (currentPrice < currentVwap && lastBuyPrice > 0) {
            shouldSell = true;
            isStopLoss = true;
            forcedSellAmountUsd = Math.max(remainingPositionUsd - keepRunnerUsd, 0);
        }
        else if (currentPrice <= lastBuyPrice * 0.85 && lastBuyPrice > 0) {
            shouldSell = true;
            isStopLoss = true;
            forcedSellAmountUsd = Math.max(remainingPositionUsd - keepRunnerUsd, 0);
        }
        else if (evaluateStructureFailure(ohlc)) {
            shouldSell = true;
            isStopLoss = true;
            forcedSellAmountUsd = Math.max(remainingPositionUsd - keepRunnerUsd, 0);
        }
        // Planned take-profit flow.
        else if (!partialTake20Done && unrealizedPct >= 20 && remainingPositionUsd > 0) {
            shouldSell = true;
            isPartialTake = true;
            forcedSellAmountUsd = entryPositionUsd * 0.5;
        }
        else if (partialTake20Done && evaluateTakeProfitExhaustion(ohlc, bb, rsi)) {
            shouldSell = true;
            forcedSellAmountUsd = Math.max(remainingPositionUsd - keepRunnerUsd, 0);
        }
        // Trailing stop exit once protections are active.
        else if (trailingStopPrice > 0 && currentPrice <= trailingStopPrice) {
            shouldSell = true;
            isTrailStop = true;
            forcedSellAmountUsd = Math.max(remainingPositionUsd - keepRunnerUsd, 0);
        }
        
        if (shouldSell) {
            if (now - lastSignalTime < 5000) return; // Prevent double-execution
            if (forcedSellAmountUsd <= 0) return;
            isBuy = false;
            lastSignalTime = now;
            
            // Calculate actual percentage change
            profitPercentage = ((currentPrice - lastBuyPrice) / lastBuyPrice) * 100;
            if (isPartialTake) {
                partialTake20Done = true;
                remainingPositionUsd = Math.max(remainingPositionUsd - forcedSellAmountUsd, 0);
                totalSoldUsd += forcedSellAmountUsd;
            } else {
                remainingPositionUsd = Math.max(remainingPositionUsd - forcedSellAmountUsd, 0);
                totalSoldUsd += forcedSellAmountUsd;
            }

            // Restart trade cycle only after 98% of the original buy size has been sold.
            const soldPct = entryPositionUsd > 0 ? (totalSoldUsd / entryPositionUsd) * 100 : 0;
            if (soldPct >= 98) {
                // Recycle sold capital (98%) into the next trade entry size.
                nextTradeBuyUsd = totalSoldUsd;
                activeTradePair = null; // UNLOCK and wait for the next 15m + 5m setup
                lastBuyPrice = 0;
                highestPriceSinceEntry = 0;
                trailingStopPrice = 0;
                trailingStopTier = 0;
                entryPositionUsd = 0;
                remainingPositionUsd = 0;
                partialTake20Done = false;
                keepRunnerUsd = 0;
                totalSoldUsd = 0;
                strategyState.position = 'FLAT';
                strategyState.trail = 'OFF';
            }
        } else {
            return;
        }
    }

    const isAboveVwap = currentPrice > currentVwap;

    // Position sizing
    const calculatedSellAmount = userBuyAmount * (TRADE_SELL_PERCENT_OF_BUY / 100);
    const tradeAmount = isBuy ? userBuyAmount : (forcedSellAmountUsd > 0 ? forcedSellAmountUsd : calculatedSellAmount);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Dynamic context-aware labeling based on current VWAP state
    let actionLabel = '';
    if (isBuy) {
        actionLabel = isAboveVwap ? 'LONG (Trend Breakout)' : 'LONG (Dip Buy)';
    } else {
        if (isPartialTake) {
            actionLabel = 'SELL 50% (+20%)';
        } else if (isTrailStop) {
            actionLabel = 'SELL (Trail Stop)';
        } else if (isStopLoss) {
            actionLabel = 'SELL (Stop Loss)';
        } else {
            actionLabel = 'SELL 48% (TP Any)';
        }
    }
    
    let actualProfitUsd = 0;
    let profitLabel = '';
    
    if (isBuy) {
        actualProfitUsd = (tradeAmount * (estimatedMargin / 100));
        profitLabel = `+${estimatedMargin.toFixed(2)}% Target ($${actualProfitUsd.toFixed(2)})`;
    } else {
        actualProfitUsd = (tradeAmount * (profitPercentage / 100));
        profitLabel = `${profitPercentage > 0 ? '+' : ''}${profitPercentage.toFixed(2)}% Actual ($${actualProfitUsd.toFixed(2)})`;
    }
    
    const signalHtml = `
        <div class="signal">
            <div class="signal-info">
                <span class="signal-pair">${wsPair} (Kraken AI)</span>
                <span class="signal-time">${timeStr}</span>
            </div>
            <div class="signal-action">
                <span class="badge ${isBuy ? 'buy' : 'sell'}">${actionLabel}</span>
                <span class="signal-price">${formatCurrency(currentPrice)}</span>
                <span class="profit-margin" style="color: ${isStopLoss ? '#ff4d4d' : '#00ffa3'}">${profitLabel}</span>
            </div>
        </div>
    `;

    signalsList.insertAdjacentHTML('afterbegin', signalHtml);
    
    // Keep list to max 15 items
    if (signalsList.children.length > 15) {
        signalsList.removeChild(signalsList.lastChild);
    }
    
    // Only update balance when realized
    if (!isBuy) {
        const realized = parseFloat(actualProfitUsd);
        updateDashboardStats(realized, profitPercentage);
        const tradeResult = realized >= 0 ? 'WIN' : 'LOSS';
        updateCoinLearning(wsPair, tradeResult);
        logClosedTrade(
            lastBuyPrice,
            currentPrice,
            'BUY',
            tradeResult,
            realized,
            wsPair
        );
        addTradeMarker(ohlc[ohlc.length - 1].time, 'SELL', `${tradeResult} ${wsPair}`);
    }

    renderStrategyState();
}

// Initial Boot
fetchHistoricalData();

const AUTH_TOKEN_KEY = 'nexus_auth_token';
let currentAuthToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (currentAuthToken) headers.Authorization = `Bearer ${currentAuthToken}`;
    return headers;
}

function setAuthStatus(message, kind = '') {
    const el = document.getElementById('auth-status');
    if (!el) return;
    el.innerText = message;
    el.className = kind ? `api-status-text ${kind}` : 'api-status-text';
}

function setApiStatus(message, kind = '') {
    const el = document.getElementById('api-keys-status');
    if (!el) return;
    el.innerText = message;
    el.className = kind ? `api-status-text ${kind}` : 'api-status-text';
}

function setBillingStatus(message, kind = '') {
    const el = document.getElementById('billing-status');
    if (!el) return;
    el.innerText = message;
    el.className = kind ? `api-status-text ${kind}` : 'api-status-text';
}

async function refreshAuthStatus() {
    if (!currentAuthToken) {
        setAuthStatus('Not signed in.');
        setApiStatus('Sign in to manage your API keys.');
        setReferralStatus('Sign in to view referral details.');
        return;
    }

    try {
        const response = await fetch('/api/auth/me', { headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Session expired.');
        setAuthStatus(`Signed in as ${data.email}`, 'success');
        loadReferralDashboard();
    } catch (_err) {
        currentAuthToken = '';
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthStatus('Session expired. Please sign in again.', 'error');
        setApiStatus('Sign in to manage your API keys.');
        setReferralStatus('Sign in to view referral details.');
    }
}

async function refreshApiKeyStatus() {
    const apiKeysSection = document.querySelector('[data-section="api-keys"]');

    if (!currentAuthToken) {
        setApiStatus('Sign in to manage your API keys.');
        if (apiKeysSection) apiKeysSection.style.display = 'none';
        updateSubscriptionCalendar(null);
        return;
    }

    try {
        const response = await fetch('/api/user-keys/status', { headers: getAuthHeaders() });
        if (!response.ok) {
            setApiStatus('Unable to check API key status.', 'error');
            if (apiKeysSection) apiKeysSection.style.display = 'none';
            updateSubscriptionCalendar(null);
            return;
        }

        const data = await response.json();
        updateSubscriptionCalendar(data);

        if (!data.subscriptionActive) {
            setApiStatus(`🔒 You must purchase a subscription to add API keys. Current plan: ${data.plan || 'None'}. Click "Buy Monthly" or "Buy Weekly" above.`, 'warning');
            if (apiKeysSection) apiKeysSection.style.display = 'none';
            return;
        }

        if (apiKeysSection) apiKeysSection.style.display = 'block';

        if (data.configured) {
            setApiStatus('API keys are configured for your account.', 'success');
        } else {
            setApiStatus('No keys saved yet.');
        }
    } catch (_err) {
        setApiStatus('Backend unavailable. Start server to enable key storage.', 'error');
        if (apiKeysSection) apiKeysSection.style.display = 'none';
        updateSubscriptionCalendar(null);
    }
}

function updateSubscriptionCalendar(data) {
    const planEl = document.getElementById('sub-plan');
    const statusEl = document.getElementById('sub-status');
    const activatedEl = document.getElementById('sub-activated');
    const renewalEl = document.getElementById('sub-renewal');

    if (!data) {
        if (planEl) planEl.textContent = 'None';
        if (statusEl) { statusEl.textContent = 'Inactive'; statusEl.style.color = '#ef4444'; }
        if (activatedEl) activatedEl.textContent = 'Not yet activated';
        if (renewalEl) renewalEl.textContent = '—';
        return;
    }

    const planName = data.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : 'None';
    if (planEl) planEl.textContent = planName;

    if (data.subscriptionActive) {
        if (statusEl) { statusEl.textContent = 'Active'; statusEl.style.color = '#4ade80'; }
    } else {
        if (statusEl) { statusEl.textContent = 'Inactive'; statusEl.style.color = '#ef4444'; }
    }

    if (data.activatedAt) {
        const activatedDate = new Date(data.activatedAt);
        if (activatedEl) activatedEl.textContent = activatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // Calculate renewal date
        let renewalDate;
        if (data.plan === 'weekly') {
            renewalDate = new Date(activatedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (data.plan === 'monthly') {
            renewalDate = new Date(activatedDate.getFullYear(), activatedDate.getMonth() + 1, activatedDate.getDate());
        }

        if (renewalDate && renewalEl) {
            renewalEl.textContent = renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    } else {
        if (activatedEl) activatedEl.textContent = 'Not yet activated';
        if (renewalEl) renewalEl.textContent = '—';
    }
}

async function runAuthAction(route) {
    const emailInput = document.getElementById('user-email');
    const passwordInput = document.getElementById('user-password');
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!email || !password) {
        setAuthStatus('Email and password are required.', 'error');
        return;
    }

    try {
        const response = await fetch(route, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Authentication failed.');

        currentAuthToken = data.token;
        localStorage.setItem(AUTH_TOKEN_KEY, currentAuthToken);
        setAuthStatus(`Signed in as ${data.email}`, 'success');
        await refreshApiKeyStatus();
        await loadReferralDashboard();
        if (passwordInput) passwordInput.value = '';
    } catch (err) {
        setAuthStatus(err.message || 'Authentication failed.', 'error');
    }
}

function setupAuthForm() {
    const registerBtn = document.getElementById('register-btn');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const googleSigninBtn = document.getElementById('google-signin-btn');
    const appleSigninBtn = document.getElementById('apple-signin-btn');

    if (registerBtn) registerBtn.addEventListener('click', () => runAuthAction('/api/auth/register'));
    if (loginBtn) loginBtn.addEventListener('click', () => runAuthAction('/api/auth/login'));
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            currentAuthToken = '';
            localStorage.removeItem(AUTH_TOKEN_KEY);
            setAuthStatus('Signed out.');
            setApiStatus('Sign in to manage your API keys.');
            setBillingStatus('Sign in to start checkout.');
            setReferralStatus('Sign in to view referral details.');
        });
    }

    if (googleSigninBtn) {
        googleSigninBtn.addEventListener('click', () => handleGoogleSignIn());
    }

    if (appleSigninBtn) {
        appleSigninBtn.addEventListener('click', () => handleAppleSignIn());
    }
}

function handleGoogleSignIn() {
    setAuthStatus('Initiating Google Sign-In...');
    // Google Sign-In flow
    // 1. Redirect to Google OAuth endpoint
    // 2. After callback, exchange code for token
    const clientId = 'your_google_client_id.apps.googleusercontent.com';
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'openid email profile';
    const responseType = 'code';

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}`;
    window.location.href = googleAuthUrl;
}

function handleAppleSignIn() {
    setAuthStatus('Initiating Apple Sign-In...');
    // Apple Sign-In flow
    // 1. Redirect to Apple OAuth endpoint
    // 2. After callback, exchange code for token
    const clientId = 'your_apple_client_id';
    const redirectUri = `${window.location.origin}/auth/apple/callback`;
    const responseType = 'code';
    const scope = 'openid email name';

    const appleAuthUrl = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}`;
    window.location.href = appleAuthUrl;
}

async function startCheckout(plan) {
    if (!currentAuthToken) {
        setBillingStatus('Sign in before starting checkout.', 'error');
        return;
    }

    try {
        setBillingStatus('Creating secure checkout session...');
        const response = await fetch('/api/billing/checkout-session', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ plan })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Could not start checkout.');
        }
        if (!data.url) {
            throw new Error('Checkout URL is missing from response.');
        }
        window.location.href = data.url;
    } catch (err) {
        setBillingStatus(err.message || 'Checkout failed.', 'error');
    }
}

async function activateSubscription(plan) {
    try {
        const response = await fetch('/api/billing/activate-subscription', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ plan })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Failed to activate subscription:', data.error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Subscription activation error:', err);
        return false;
    }
}

function setupBillingButtons() {
    const monthlyBtn = document.getElementById('buy-monthly-btn');
    const weeklyBtn = document.getElementById('buy-weekly-btn');
    if (monthlyBtn) {
        monthlyBtn.addEventListener('click', () => startCheckout('monthly'));
    }
    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', () => startCheckout('weekly'));
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
        const plan = params.get('plan');
        setBillingStatus('Payment successful. Access is now active.', 'success');

        if (plan && currentAuthToken) {
            activateSubscription(plan).then(() => {
                refreshApiKeyStatus();
            });
        }
    } else if (params.get('checkout') === 'cancel') {
        setBillingStatus('Checkout canceled. You can try again anytime.');
    } else if (!currentAuthToken) {
        setBillingStatus('Sign in to start checkout.');
    }
}

function setReferralStatus(message, kind = '') {
    const el = document.getElementById('paypal-email-status');
    if (!el) return;
    el.innerText = message;
    el.className = kind ? `api-status-text ${kind}` : 'api-status-text';
}

function setPayoutStatus(message, kind = '') {
    const el = document.getElementById('payout-status');
    if (!el) return;
    el.innerText = message;
    el.className = kind ? `api-status-text ${kind}` : 'api-status-text';
}

async function loadReferralDashboard() {
    if (!currentAuthToken) return;

    try {
        const response = await fetch('/api/referral/dashboard', { headers: getAuthHeaders() });
        const data = await response.json();

        if (response.ok) {
            // Update referral code display
            const codeInput = document.getElementById('referral-code');
            if (codeInput) codeInput.value = data.referralCode || 'N/A';

            // Update counts
            const countEl = document.getElementById('referral-count');
            if (countEl) countEl.textContent = data.referralCount || 0;

            const pendingEl = document.getElementById('referral-pending');
            if (pendingEl) pendingEl.textContent = '$' + (data.earnings.pending || 0).toFixed(2);

            const totalEl = document.getElementById('referral-total');
            if (totalEl) totalEl.textContent = '$' + (data.earnings.total || 0).toFixed(2);

            // Update referral list
            const listEl = document.getElementById('referral-list');
            if (listEl && data.referrals && data.referrals.length > 0) {
                listEl.innerHTML = data.referrals.map(ref => `
                    <div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;">
                        <p style="margin: 0; color: #fff;">${ref.email}</p>
                        <p style="margin: 4px 0 0 0; color: #4ade80;">Subscribed: ${ref.subscriptionActive ? 'Yes' : 'No'}</p>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load referral dashboard:', err);
    }
}

function setupReferralSystem() {
    const copyCodeBtn = document.getElementById('copy-referral-code-btn');
    const savePaypalBtn = document.getElementById('save-paypal-email-btn');
    const payoutBtn = document.getElementById('request-payout-btn');
    const paypalEmailInput = document.getElementById('paypal-email');

    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', async () => {
            const codeInput = document.getElementById('referral-code');
            if (codeInput && codeInput.value) {
                navigator.clipboard.writeText(codeInput.value).then(() => {
                    copyCodeBtn.textContent = '✓ Copied!';
                    setTimeout(() => {
                        copyCodeBtn.textContent = 'Copy';
                    }, 2000);
                }).catch(err => console.error('Copy failed:', err));
            }
        });
    }

    if (savePaypalBtn) {
        savePaypalBtn.addEventListener('click', async () => {
            if (!currentAuthToken) {
                setReferralStatus('Sign in to save PayPal email.', 'error');
                return;
            }

            const paypalEmail = paypalEmailInput ? paypalEmailInput.value.trim() : '';
            if (!paypalEmail) {
                setReferralStatus('Enter a valid PayPal email.', 'error');
                return;
            }

            try {
                setReferralStatus('Saving PayPal email...');
                const response = await fetch('/api/referral/set-paypal-email', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ paypalEmail })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to save PayPal email.');

                setReferralStatus('PayPal email saved successfully!', 'success');
            } catch (err) {
                setReferralStatus(err.message || 'Failed to save PayPal email.', 'error');
            }
        });
    }

    if (payoutBtn) {
        payoutBtn.addEventListener('click', async () => {
            if (!currentAuthToken) {
                setPayoutStatus('Sign in to request payout.', 'error');
                return;
            }

            try {
                setPayoutStatus('Validating payout eligibility...');
                const response = await fetch('/api/referral/request-payout', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({})
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to request payout.');

                // Show pending earnings amount
                const pendingEl = document.getElementById('referral-pending');
                const pendingAmount = pendingEl ? parseFloat(pendingEl.textContent.replace('$', '')) : 0;

                if (pendingAmount > 0 && pendingAmount >= 100) {
                    setPayoutStatus(`Payout of $${pendingAmount.toFixed(2)} is being processed. You will receive it via PayPal.`, 'success');
                    loadReferralDashboard();
                } else if (pendingAmount > 0) {
                    setPayoutStatus(`You need at least $100 to request a payout. Current pending: $${pendingAmount.toFixed(2)}`, 'warning');
                } else {
                    setPayoutStatus('No pending earnings to payout.', 'warning');
                }
            } catch (err) {
                setPayoutStatus(err.message || 'Failed to request payout.', 'error');
            }
        });
    }

    // Load initial dashboard data
    loadReferralDashboard();
}

function setupApiKeysForm() {
    setupAuthForm();
    setupBillingButtons();
    setupReferralSystem();
    const form = document.getElementById('api-keys-form');
    if (!form) return;

    const keyInput = document.getElementById('kraken-api-key');
    const secretInput = document.getElementById('kraken-api-secret');

    refreshAuthStatus().then(refreshApiKeyStatus);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!currentAuthToken) {
            setApiStatus('Sign in before saving API keys.', 'error');
            return;
        }

        const apiKey = keyInput ? keyInput.value.trim() : '';
        const apiSecret = secretInput ? secretInput.value.trim() : '';

        if (!apiKey || !apiSecret) {
            setApiStatus('Both API key and secret are required.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/user-keys', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ apiKey, apiSecret })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to save API keys.');
            }

            setApiStatus('API keys saved securely.', 'success');

            if (keyInput) keyInput.value = '';
            if (secretInput) secretInput.value = '';
        } catch (err) {
            setApiStatus(err.message || 'Failed to save API keys.', 'error');
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupApiKeysForm);
} else {
    setupApiKeysForm();
}
