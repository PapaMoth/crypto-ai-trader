/**
 * React Trade Executor Component
 * Handles AI signal detection and trade execution with rate limiting
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { TradeClient, TradeResult, RateLimitInfo, TradeError } from "./trade-client";

// ============= TYPES =============

interface TradeExecutorProps {
  apiUrl: string;
  apiKey: string;
  onTradeSuccess?: (orderId: string) => void;
  onTradeError?: (error: TradeError) => void;
}

interface ExecutionState {
  isExecuting: boolean;
  lastTrade?: {
    symbol: string;
    side: "BUY" | "SELL";
    orderId: string;
    timestamp: Date;
  };
  rateLimit: RateLimitInfo | null;
  error?: TradeError;
  message: string;
}

interface Signal {
  action: "BUY" | "SELL" | "NONE";
  confidence: number;
  symbol: string;
}

// ============= MAIN COMPONENT =============

export const TradeExecutor: React.FC<TradeExecutorProps> = ({
  apiUrl,
  apiKey,
  onTradeSuccess,
  onTradeError,
}) => {
  const clientRef = useRef<TradeClient | null>(null);
  const [state, setState] = useState<ExecutionState>({
    isExecuting: false,
    rateLimit: null,
    message: "Ready",
  });

  // Initialize client
  useEffect(() => {
    clientRef.current = new TradeClient({
      apiUrl,
      apiKey,
      maxRetries: 3,
      onRateLimited: (info) => {
        setState((prev) => ({
          ...prev,
          message: `⏳ Rate limited. Reset in ${Math.ceil(
            (info.resetTime.getTime() - Date.now()) / 1000
          )}s`,
          rateLimit: info,
        }));
      },
      onError: (error) => {
        setState((prev) => ({
          ...prev,
          error,
          message: `❌ ${error.type}: ${error.message}`,
        }));
        onTradeError?.(error);
      },
    });
  }, [apiUrl, apiKey, onTradeError]);

  /**
   * Execute a trade
   */
  const executeTrade = useCallback(
    async (symbol: string, side: "BUY" | "SELL", quantity: number) => {
      if (!clientRef.current) return;

      // Check if near rate limit
      if (clientRef.current.isNearRateLimit()) {
        setState((prev) => ({
          ...prev,
          message: `⚠️ Approaching rate limit. ${clientRef.current?.getResetInSeconds()}s until reset`,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isExecuting: true,
        message: "⏳ Executing trade...",
      }));

      const result = await clientRef.current.executeTrade({
        symbol,
        side,
        quantity,
      });

      if (result.success) {
        setState((prev) => ({
          ...prev,
          isExecuting: false,
          lastTrade: {
            symbol,
            side,
            orderId: result.data!.orderId,
            timestamp: new Date(),
          },
          rateLimit: result.rateLimit || null,
          message: `✅ ${side} order executed! ID: ${result.data!.orderId}`,
        }));
        onTradeSuccess?.(result.data!.orderId);
      } else {
        setState((prev) => ({
          ...prev,
          isExecuting: false,
          error: result.error,
          rateLimit: result.rateLimit || null,
          message: `❌ Trade failed (attempt ${result.attempts}/${result.error?.retryable ? "retried" : "no retry"})`,
        }));
      }
    },
    []
  );

  /**
   * Process AI signal and execute trade if conditions met
   */
  const processSignal = useCallback(
    async (signal: Signal) => {
      // Ignore NONE signals
      if (signal.action === "NONE") {
        setState((prev) => ({
          ...prev,
          message: "📊 No clear signal",
        }));
        return;
      }

      // Check confidence threshold
      if (signal.confidence < 0.7) {
        setState((prev) => ({
          ...prev,
          message: `📊 Low confidence signal (${(signal.confidence * 100).toFixed(
            1
          )}%) - skipping`,
        }));
        return;
      }

      // Prevent overlapping trades
      if (state.isExecuting) {
        setState((prev) => ({
          ...prev,
          message: "⏳ Trade already in progress",
        }));
        return;
      }

      // Check if we already traded this symbol recently (cooldown)
      if (
        state.lastTrade &&
        state.lastTrade.symbol === signal.symbol &&
        Date.now() - state.lastTrade.timestamp.getTime() < 60000 // 1 min cooldown
      ) {
        const secondsLeft = Math.ceil(
          (60000 - (Date.now() - state.lastTrade.timestamp.getTime())) / 1000
        );
        setState((prev) => ({
          ...prev,
          message: `⏱️ Cooldown active for ${signal.symbol}. Retry in ${secondsLeft}s`,
        }));
        return;
      }

      // Execute trade
      setState((prev) => ({
        ...prev,
        message: `📢 Signal detected: ${signal.action} ${signal.symbol} (${(
          signal.confidence * 100
        ).toFixed(1)}% confidence)`,
      }));

      await executeTrade(signal.symbol, signal.action, 0.01); // 0.01 quantity
    },
    [state.isExecuting, state.lastTrade, executeTrade]
  );

  return (
    <TradeExecutorUI
      state={state}
      onProcessSignal={processSignal}
      onExecuteTrade={executeTrade}
      rateLimit={state.rateLimit}
      client={clientRef.current}
    />
  );
};

// ============= UI COMPONENT =============

interface TradeExecutorUIProps {
  state: ExecutionState;
  onProcessSignal: (signal: Signal) => Promise<void>;
  onExecuteTrade: (symbol: string, side: "BUY" | "SELL", quantity: number) => Promise<void>;
  rateLimit: RateLimitInfo | null;
  client: TradeClient | null;
}

const TradeExecutorUI: React.FC<TradeExecutorUIProps> = ({
  state,
  onProcessSignal,
  onExecuteTrade,
  rateLimit,
  client,
}) => {
  return (
    <div className="trade-executor">
      <div className="header">
        <h2>Trade Executor</h2>
        <div className={`status ${state.isExecuting ? "executing" : ""}`}>
          {state.isExecuting ? "⏳" : "✓"} {state.message}
        </div>
      </div>

      {/* Rate Limit Info */}
      {rateLimit && (
        <div className="rate-limit-info">
          <h3>Rate Limit</h3>
          <div className="info-row">
            <span>Remaining:</span>
            <span className={rateLimit.remaining <= 2 ? "warning" : ""}>
              {rateLimit.remaining} / {rateLimit.limit}
            </span>
          </div>
          <div className="info-row">
            <span>Reset:</span>
            <span>{rateLimit.resetTime.toLocaleTimeString()}</span>
          </div>
          {rateLimit.remaining <= 2 && (
            <div className="warning">
              ⚠️ Approaching rate limit! {client?.getResetInSeconds()}s until reset
            </div>
          )}
        </div>
      )}

      {/* Last Trade Info */}
      {state.lastTrade && (
        <div className="last-trade">
          <h3>Last Trade</h3>
          <div className="info-row">
            <span>Type:</span>
            <span className={state.lastTrade.side === "BUY" ? "buy" : "sell"}>
              {state.lastTrade.side}
            </span>
          </div>
          <div className="info-row">
            <span>Symbol:</span>
            <span>{state.lastTrade.symbol}</span>
          </div>
          <div className="info-row">
            <span>Order ID:</span>
            <span className="mono">{state.lastTrade.orderId}</span>
          </div>
          <div className="info-row">
            <span>Time:</span>
            <span>{state.lastTrade.timestamp.toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Error Info */}
      {state.error && (
        <div className="error-info">
          <h3>Error Details</h3>
          <div className="info-row">
            <span>Type:</span>
            <span className="error">{state.error.type}</span>
          </div>
          <div className="info-row">
            <span>Message:</span>
            <span>{state.error.message}</span>
          </div>
          {state.error.statusCode && (
            <div className="info-row">
              <span>HTTP Status:</span>
              <span>{state.error.statusCode}</span>
            </div>
          )}
          <div className="info-row">
            <span>Retryable:</span>
            <span className={state.error.retryable ? "success" : "error"}>
              {state.error.retryable ? "Yes" : "No"}
            </span>
          </div>
        </div>
      )}

      {/* Manual Trade Controls */}
      <div className="controls">
        <h3>Manual Controls</h3>
        <div className="button-group">
          <button
            onClick={() => onExecuteTrade("ETHUSDT", "BUY", 0.01)}
            disabled={state.isExecuting}
            className="btn-buy"
          >
            Buy ETH
          </button>
          <button
            onClick={() => onExecuteTrade("ETHUSDT", "SELL", 0.01)}
            disabled={state.isExecuting}
            className="btn-sell"
          >
            Sell ETH
          </button>
        </div>
      </div>

      {/* Signal Simulator */}
      <div className="signal-simulator">
        <h3>Signal Simulator</h3>
        <div className="button-group">
          <button
            onClick={() =>
              onProcessSignal({
                action: "BUY",
                confidence: 0.85,
                symbol: "ETHUSDT",
              })
            }
            disabled={state.isExecuting}
            className="btn-buy"
          >
            Simulate BUY Signal
          </button>
          <button
            onClick={() =>
              onProcessSignal({
                action: "SELL",
                confidence: 0.9,
                symbol: "ETHUSDT",
              })
            }
            disabled={state.isExecuting}
            className="btn-sell"
          >
            Simulate SELL Signal
          </button>
          <button
            onClick={() =>
              onProcessSignal({
                action: "NONE",
                confidence: 0.5,
                symbol: "ETHUSDT",
              })
            }
            disabled={state.isExecuting}
          >
            Simulate NONE Signal
          </button>
        </div>
      </div>

      <style jsx>{`
        .trade-executor {
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f9f9f9;
          font-family: monospace;
        }

        .header {
          margin-bottom: 20px;
        }

        h2,
        h3 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .status {
          padding: 10px;
          border-radius: 4px;
          background: #e8f5e9;
          color: #2e7d32;
          font-weight: bold;
        }

        .status.executing {
          background: #fff3e0;
          color: #f57c00;
        }

        .rate-limit-info,
        .last-trade,
        .error-info {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-row span:first-child {
          font-weight: bold;
          color: #666;
        }

        .warning {
          color: #d32f2f;
          font-weight: bold;
          margin-top: 10px;
          padding: 10px;
          background: #ffebee;
          border-radius: 4px;
        }

        .buy {
          color: #4caf50;
        }

        .sell {
          color: #f44336;
        }

        .success {
          color: #4caf50;
        }

        .error {
          color: #d32f2f;
        }

        .mono {
          font-family: monospace;
        }

        .controls,
        .signal-simulator {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
        }

        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }

        button {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          font-family: monospace;
          transition: all 0.3s;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-buy {
          background: #4caf50;
          color: white;
        }

        .btn-buy:hover:not(:disabled) {
          background: #45a049;
        }

        .btn-sell {
          background: #f44336;
          color: white;
        }

        .btn-sell:hover:not(:disabled) {
          background: #da190b;
        }

        button:not(.btn-buy):not(.btn-sell) {
          background: #2196f3;
          color: white;
        }

        button:not(.btn-buy):not(.btn-sell):hover:not(:disabled) {
          background: #0b7dda;
        }
      `}</style>
    </div>
  );
};

export default TradeExecutor;
