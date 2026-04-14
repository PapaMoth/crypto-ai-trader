/**
 * Paper Trading Dashboard - React Component
 * Displays trading stats, open positions, and closed trades
 */

import React, { useState, useEffect } from "react";
import { usePaperTrader } from "./use-paper-trader";
import { TradeResult, Position } from "./paper-trader";

interface PaperTraderDashboardProps {
  initialBalance?: number;
  onSignal?: (signal: {
    symbol: string;
    action: "BUY" | "SELL";
    price: number;
  }) => void;
}

export const PaperTraderDashboard: React.FC<PaperTraderDashboardProps> = ({
  initialBalance = 1000,
  onSignal,
}) => {
  const trader = usePaperTrader(initialBalance);
  const [currentPrices, setCurrentPrices] = useState<Map<string, number>>(new Map());
  const [selectedSymbol, setSelectedSymbol] = useState("ETHUSDT");
  const [priceInput, setPriceInput] = useState("2000");

  // Update current prices
  const handlePriceUpdate = (symbol: string, price: number) => {
    const newPrices = new Map(currentPrices);
    newPrices.set(symbol, price);
    setCurrentPrices(newPrices);

    // Auto-check positions
    if (trader.stats) {
      trader.checkTrade(symbol, price);
    }
  };

  // Simulate AI signal
  const simulateSignal = (symbol: string, side: "BUY" | "SELL", price: number) => {
    if (side === "BUY") {
      trader.openTrade(symbol, side, price);
    } else {
      const position = trader.getPosition(symbol);
      if (position) {
        trader.closeTrade(symbol, price);
      }
    }

    onSignal?.({ symbol, action: side, price });
  };

  if (!trader.stats) {
    return <div>Loading...</div>;
  }

  const totalProfit = trader.stats.totalProfit;
  const profitPercent = trader.stats.profitPercent;
  const isProfit = totalProfit >= 0;

  return (
    <div className="dashboard">
      <style>{`
        .dashboard {
          padding: 20px;
          background: #0f1419;
          color: #fff;
          font-family: "Courier New", monospace;
          min-height: 100vh;
        }

        .header {
          margin-bottom: 30px;
          border-bottom: 2px solid #1e1e2e;
          padding-bottom: 20px;
        }

        h1 {
          margin: 0 0 15px 0;
          font-size: 24px;
          color: #00d4ff;
        }

        .balance-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .stat-card {
          background: #1a1f2e;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #00d4ff;
        }

        .stat-label {
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: bold;
          color: #fff;
        }

        .stat-card.profit {
          border-left-color: #4caf50;
        }

        .stat-card.profit .stat-value {
          color: #4caf50;
        }

        .stat-card.loss {
          border-left-color: #f44336;
        }

        .stat-card.loss .stat-value {
          color: #f44336;
        }

        .section {
          margin-bottom: 30px;
        }

        h2 {
          font-size: 16px;
          color: #00d4ff;
          margin: 0 0 15px 0;
          text-transform: uppercase;
          border-bottom: 1px solid #1e1e2e;
          padding-bottom: 10px;
        }

        .controls {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
          flex-wrap: wrap;
        }

        input,
        select {
          padding: 8px 12px;
          background: #1a1f2e;
          border: 1px solid #333;
          color: #fff;
          border-radius: 4px;
          font-family: "Courier New", monospace;
        }

        button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          font-family: "Courier New", monospace;
          transition: all 0.3s;
        }

        .btn-buy {
          background: #4caf50;
          color: white;
        }

        .btn-buy:hover {
          background: #45a049;
          transform: scale(1.05);
        }

        .btn-sell {
          background: #f44336;
          color: white;
        }

        .btn-sell:hover {
          background: #da190b;
          transform: scale(1.05);
        }

        .btn-secondary {
          background: #2196f3;
          color: white;
        }

        .btn-secondary:hover {
          background: #0b7dda;
        }

        .btn-danger {
          background: #ff9800;
          color: white;
        }

        .btn-danger:hover {
          background: #e68900;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          background: #1a1f2e;
          border-radius: 8px;
          overflow: hidden;
        }

        .table th {
          background: #0f1419;
          padding: 12px;
          text-align: left;
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          border-bottom: 1px solid #333;
        }

        .table td {
          padding: 12px;
          border-bottom: 1px solid #333;
        }

        .table tr:hover {
          background: #252b3a;
        }

        .symbol {
          color: #00d4ff;
          font-weight: bold;
        }

        .buy {
          color: #4caf50;
        }

        .sell {
          color: #f44336;
        }

        .win {
          color: #4caf50;
        }

        .loss {
          color: #f44336;
        }

        .empty {
          text-align: center;
          padding: 20px;
          color: #666;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: #333;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 5px;
        }

        .progress-fill {
          height: 100%;
          background: #4caf50;
          transition: width 0.3s;
        }

        .progress-fill.loss {
          background: #f44336;
        }
      `}</style>

      {/* Header */}
      <div className="header">
        <h1>📊 Paper Trading Dashboard</h1>

        <div className="balance-section">
          <div className={`stat-card ${isProfit ? "profit" : "loss"}`}>
            <div className="stat-label">Balance</div>
            <div className="stat-value">${trader.balance.toFixed(2)}</div>
          </div>

          <div className={`stat-card ${isProfit ? "profit" : "loss"}`}>
            <div className="stat-label">Total P&L</div>
            <div className="stat-value">
              {isProfit ? "+" : ""}
              {totalProfit.toFixed(2)} ({profitPercent.toFixed(1)}%)
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill ${isProfit ? "" : "loss"}`}
                style={{
                  width: `${Math.min(Math.abs(profitPercent), 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Trades</div>
            <div className="stat-value">{trader.stats.totalTrades}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Win Rate</div>
            <div className="stat-value">{trader.stats.winRate.toFixed(1)}%</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Profit Factor</div>
            <div className="stat-value">{trader.stats.profitFactor.toFixed(2)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Open Positions</div>
            <div className="stat-value">{trader.openPositions.length}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="section">
        <h2>📈 Trade Simulator</h2>
        <div className="controls">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
          >
            <option value="ETHUSDT">ETHUSDT</option>
            <option value="BTCUSDT">BTCUSDT</option>
            <option value="BNBUSDT">BNBUSDT</option>
          </select>

          <input
            type="number"
            placeholder="Price"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            step="0.01"
          />

          <button
            className="btn-buy"
            onClick={() => {
              const price = parseFloat(priceInput);
              simulateSignal(selectedSymbol, "BUY", price);
            }}
          >
            BUY Signal
          </button>

          <button
            className="btn-sell"
            onClick={() => {
              const price = parseFloat(priceInput);
              simulateSignal(selectedSymbol, "SELL", price);
            }}
          >
            SELL Signal
          </button>

          <button
            className="btn-secondary"
            onClick={() => {
              const prices = new Map(currentPrices);
              prices.set(selectedSymbol, parseFloat(priceInput));
              setCurrentPrices(prices);
              trader.checkTrade(selectedSymbol, parseFloat(priceInput));
            }}
          >
            Check Price
          </button>

          <button className="btn-danger" onClick={() => trader.reset()}>
            Reset
          </button>
        </div>
      </div>

      {/* Open Positions */}
      <div className="section">
        <h2>📍 Open Positions ({trader.openPositions.length})</h2>
        {trader.openPositions.length === 0 ? (
          <div className="empty">No open positions</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Entry</th>
                <th>Quantity</th>
                <th>Entry Time</th>
                <th>Order ID</th>
              </tr>
            </thead>
            <tbody>
              {trader.openPositions.map((pos: Position) => (
                <tr key={pos.orderId}>
                  <td className="symbol">{pos.symbol}</td>
                  <td className={pos.side === "BUY" ? "buy" : "sell"}>
                    {pos.side}
                  </td>
                  <td>${pos.entryPrice.toFixed(2)}</td>
                  <td>{pos.quantity}</td>
                  <td>{pos.entryTime.toLocaleTimeString()}</td>
                  <td>{pos.orderId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Closed Trades */}
      <div className="section">
        <h2>✅ Closed Trades ({trader.closedTrades.length})</h2>
        {trader.closedTrades.length === 0 ? (
          <div className="empty">No closed trades</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Profit</th>
                <th>%</th>
                <th>Result</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {trader.closedTrades.map((trade: TradeResult, idx: number) => (
                <tr key={idx}>
                  <td className="symbol">{trade.position.symbol}</td>
                  <td className={trade.position.side === "BUY" ? "buy" : "sell"}>
                    {trade.position.side}
                  </td>
                  <td>${trade.position.entryPrice.toFixed(2)}</td>
                  <td>${trade.exitPrice.toFixed(2)}</td>
                  <td className={trade.profit >= 0 ? "win" : "loss"}>
                    {trade.profit >= 0 ? "+" : ""}
                    ${trade.profit.toFixed(2)}
                  </td>
                  <td className={trade.profitPercent >= 0 ? "win" : "loss"}>
                    {trade.profitPercent >= 0 ? "+" : ""}
                    {(trade.profitPercent * 100).toFixed(2)}%
                  </td>
                  <td className={trade.result === "WIN" ? "win" : "loss"}>
                    {trade.result}
                  </td>
                  <td>{(trade.durationMs / 1000).toFixed(0)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Statistics */}
      {trader.stats.totalTrades > 0 && (
        <div className="section">
          <h2>📊 Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Win Trades</div>
              <div className="stat-value win">{trader.stats.winTrades}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Loss Trades</div>
              <div className="stat-value loss">{trader.stats.lossTrades}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Avg Win</div>
              <div className="stat-value win">
                ${trader.stats.averageWin.toFixed(2)}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Avg Loss</div>
              <div className="stat-value loss">
                ${trader.stats.averageLoss.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperTraderDashboard;
