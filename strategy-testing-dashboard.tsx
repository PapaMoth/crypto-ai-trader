/**
 * Strategy Testing Dashboard - React Component
 * Test and compare trading strategies with backtesting
 */

import React, { useState } from "react";
import {
  compareStrategies,
  generateComparisonReport,
  StrategyPerformance,
  StrategyRanking,
} from "./strategy-backtester";
import { PriceBar } from "./ai-backtest";

interface TestingState {
  isLoading: boolean;
  results: StrategyPerformance | null;
  error: string | null;
}

interface StrategyTestingDashboardProps {
  onStrategySelected?: (strategy: StrategyRanking) => void;
}

export const StrategyTestingDashboard: React.FC<StrategyTestingDashboardProps> = ({
  onStrategySelected,
}) => {
  const [state, setState] = useState<TestingState>({
    isLoading: false,
    results: null,
    error: null,
  });

  // Generate synthetic price data
  function generateFakePrices(length: number = 1000): number[] {
    let prices = [2000];
    for (let i = 1; i < length; i++) {
      const change = (Math.random() - 0.5) * 50;
      prices.push(Math.max(100, prices[i - 1] + change));
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

  // Run strategy comparison
  const runComparison = async (numCandles: number = 1000) => {
    setState({ isLoading: true, results: null, error: null });

    try {
      const prices = generateFakePrices(numCandles);
      const priceBars = createPriceBars(prices);

      const performance = await compareStrategies(priceBars, undefined, 1000);
      setState({ isLoading: false, results: performance, error: null });
    } catch (err) {
      setState({
        isLoading: false,
        results: null,
        error: (err as Error).message,
      });
    }
  };

  return (
    <div className="strategy-dashboard">
      <style>{`
        .strategy-dashboard {
          padding: 20px;
          background: #0f1419;
          color: #fff;
          font-family: "Courier New", monospace;
          min-height: 100vh;
        }

        .header {
          margin-bottom: 30px;
        }

        h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
          color: #00d4ff;
        }

        .description {
          color: #888;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 30px;
        }

        button {
          padding: 12px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          font-family: "Courier New", monospace;
          font-size: 14px;
          transition: all 0.3s;
        }

        .btn-primary {
          background: #00d4ff;
          color: #0f1419;
        }

        .btn-primary:hover:not(:disabled) {
          background: #00b8cc;
          transform: scale(1.05);
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading {
          text-align: center;
          padding: 20px;
          color: #00d4ff;
        }

        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid #333;
          border-top: 3px solid #00d4ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .error {
          background: #f44336;
          color: white;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .results {
          margin-top: 30px;
        }

        .report {
          background: #1a1f2e;
          padding: 20px;
          border-radius: 4px;
          border-left: 4px solid #00d4ff;
          margin-bottom: 30px;
          white-space: pre-wrap;
          overflow-x: auto;
          font-size: 12px;
          line-height: 1.6;
        }

        .strategies-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .strategy-card {
          background: #1a1f2e;
          border: 1px solid #333;
          border-radius: 4px;
          padding: 20px;
          transition: all 0.3s;
        }

        .strategy-card:hover {
          border-color: #00d4ff;
          box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
        }

        .rank-badge {
          display: inline-block;
          background: #00d4ff;
          color: #0f1419;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .strategy-name {
          font-size: 16px;
          color: #00d4ff;
          margin-bottom: 10px;
          font-weight: bold;
        }

        .risk-level {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 10px;
        }

        .risk-low {
          background: #4caf50;
          color: white;
        }

        .risk-medium {
          background: #ff9800;
          color: white;
        }

        .risk-high {
          background: #f44336;
          color: white;
        }

        .metric {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #333;
          font-size: 13px;
        }

        .metric:last-child {
          border-bottom: none;
        }

        .metric-label {
          color: #888;
        }

        .metric-value {
          font-weight: bold;
          color: #fff;
        }

        .metric-value.positive {
          color: #4caf50;
        }

        .metric-value.negative {
          color: #f44336;
        }

        .select-button {
          margin-top: 15px;
          width: 100%;
          padding: 10px;
          background: #00d4ff;
          color: #0f1419;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.3s;
        }

        .select-button:hover {
          background: #00b8cc;
        }
      `}</style>

      <div className="header">
        <h1>🧠 Strategy Testing Lab</h1>
        <p className="description">
          Test and compare your trading strategies on historical data
        </p>
      </div>

      <div className="controls">
        <button
          className="btn-primary"
          onClick={() => runComparison(500)}
          disabled={state.isLoading}
        >
          {state.isLoading ? "Running..." : "Test (500 bars) ⚡"}
        </button>

        <button
          className="btn-primary"
          onClick={() => runComparison(1000)}
          disabled={state.isLoading}
        >
          {state.isLoading ? "Running..." : "Test (1000 bars) 🔥"}
        </button>

        <button
          className="btn-primary"
          onClick={() => runComparison(2000)}
          disabled={state.isLoading}
        >
          {state.isLoading ? "Running..." : "Test (2000 bars) 💪"}
        </button>

        <button
          className="btn-primary"
          onClick={() => setState({ isLoading: false, results: null, error: null })}
          disabled={state.isLoading}
        >
          Clear Results
        </button>
      </div>

      {state.isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Running strategy comparison...</p>
        </div>
      )}

      {state.error && <div className="error">Error: {state.error}</div>}

      {state.results && (
        <div className="results">
          {/* Text Report */}
          <div className="report">{generateComparisonReport(state.results)}</div>

          {/* Strategy Cards */}
          <h2 style={{ color: "#00d4ff", marginBottom: 20 }}>
            📊 Detailed Strategy Results
          </h2>

          <div className="strategies-grid">
            {state.results.allStrategies.map((strategyRanking) => (
              <div key={strategyRanking.strategy.name} className="strategy-card">
                <div className="rank-badge">#{strategyRanking.rank}</div>
                <div
                  className={`risk-level risk-${strategyRanking.strategy.riskLevel.toLowerCase()}`}
                >
                  Risk: {strategyRanking.strategy.riskLevel}
                </div>

                <div className="strategy-name">
                  {strategyRanking.strategy.name}
                </div>

                <p style={{ color: "#888", fontSize: "12px", marginBottom: 15 }}>
                  {strategyRanking.strategy.description}
                </p>

                <div style={{ marginBottom: 15 }}>
                  <div className="metric">
                    <span className="metric-label">Score</span>
                    <span className="metric-value">
                      {strategyRanking.score.toFixed(1)}/100
                    </span>
                  </div>

                  <div className="metric">
                    <span className="metric-label">Final Balance</span>
                    <span
                      className={`metric-value ${
                        strategyRanking.result.finalBalance >=
                        strategyRanking.result.initialBalance
                          ? "positive"
                          : "negative"
                      }`}
                    >
                      ${strategyRanking.result.finalBalance.toFixed(2)}
                    </span>
                  </div>

                  <div className="metric">
                    <span className="metric-label">Profit</span>
                    <span
                      className={`metric-value ${
                        strategyRanking.result.totalProfit >= 0
                          ? "positive"
                          : "negative"
                      }`}
                    >
                      {strategyRanking.result.totalProfit >= 0 ? "+" : ""}
                      {strategyRanking.result.totalProfit.toFixed(2)} (
                      {strategyRanking.result.profitPercent.toFixed(2)}%)
                    </span>
                  </div>

                  <div className="metric">
                    <span className="metric-label">Total Trades</span>
                    <span className="metric-value">
                      {strategyRanking.result.totalTrades}
                    </span>
                  </div>

                  <div className="metric">
                    <span className="metric-label">Win Rate</span>
                    <span className="metric-value">
                      {strategyRanking.result.winRate.toFixed(1)}%
                    </span>
                  </div>

                  <div className="metric">
                    <span className="metric-label">Profit Factor</span>
                    <span className="metric-value">
                      {strategyRanking.result.profitFactor.toFixed(2)}
                    </span>
                  </div>

                  <div className="metric">
                    <span className="metric-label">Max Drawdown</span>
                    <span
                      className={`metric-value ${
                        strategyRanking.result.maxDrawdown > 30
                          ? "negative"
                          : "positive"
                      }`}
                    >
                      {strategyRanking.result.maxDrawdown.toFixed(2)}%
                    </span>
                  </div>

                  <div className="metric">
                    <span className="metric-label">Avg Win / Loss</span>
                    <span className="metric-value">
                      {(
                        strategyRanking.result.averageWin /
                        Math.abs(strategyRanking.result.averageLoss || 1)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  className="select-button"
                  onClick={() => onStrategySelected?.(strategyRanking)}
                >
                  Select Strategy →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyTestingDashboard;
