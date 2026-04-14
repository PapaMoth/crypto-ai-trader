/**
 * React Hook for Paper Trading
 * Manages paper trader state and provides easy integration with React components
 */

import { useRef, useState, useCallback } from "react";
import {
  PaperTrader,
  Position,
  TradeResult,
  PaperTraderStats,
} from "./paper-trader";

export interface UsePaperTraderReturn {
  // State
  balance: number;
  stats: PaperTraderStats | null;
  openPositions: Position[];
  closedTrades: TradeResult[];

  // Actions
  openTrade: (
    symbol: string,
    side: "BUY" | "SELL",
    entryPrice: number,
    quantity?: number
  ) => Position | null;
  checkTrade: (symbol: string, currentPrice: number) => TradeResult | null;
  closeAllTrades: (prices: Map<string, number>) => TradeResult[];
  closeTrade: (symbol: string, exitPrice: number) => TradeResult | null;
  reset: () => void;

  // Queries
  getUnrealizedPnL: (prices: Map<string, number>) => number;
  getPosition: (symbol: string) => Position | undefined;
}

export function usePaperTrader(initialBalance: number = 1000): UsePaperTraderReturn {
  const traderRef = useRef<PaperTrader | null>(null);
  const [balance, setBalance] = useState(initialBalance);
  const [stats, setStats] = useState<PaperTraderStats | null>(null);

  // Initialize trader
  if (!traderRef.current) {
    traderRef.current = new PaperTrader({
      initialBalance,
      riskPerTrade: 0.02,
      takeProfitPercent: 0.005,
      stopLossPercent: 0.005,
    });
  }

  const trader = traderRef.current;

  // Update state
  const updateState = useCallback((currentPrices?: Map<string, number>) => {
    setBalance(trader.getBalance());
    setStats(trader.getStats(currentPrices));
  }, [trader]);

  // Open trade
  const openTrade = useCallback(
    (
      symbol: string,
      side: "BUY" | "SELL",
      entryPrice: number,
      quantity?: number
    ): Position | null => {
      const position = trader.openPosition(symbol, side, entryPrice, quantity);
      if (position) {
        updateState();
      }
      return position;
    },
    [trader, updateState]
  );

  // Check trade
  const checkTrade = useCallback(
    (symbol: string, currentPrice: number): TradeResult | null => {
      const result = trader.checkPosition(symbol, currentPrice);
      if (result) {
        updateState();
      }
      return result;
    },
    [trader, updateState]
  );

  // Close all trades
  const closeAllTrades = useCallback(
    (prices: Map<string, number>): TradeResult[] => {
      const results = trader.closeAllPositions(prices);
      if (results.length > 0) {
        updateState(prices);
      }
      return results;
    },
    [trader, updateState]
  );

  // Close specific trade
  const closeTrade = useCallback(
    (symbol: string, exitPrice: number): TradeResult | null => {
      const result = trader.closePosition(symbol, exitPrice);
      if (result) {
        updateState();
      }
      return result;
    },
    [trader, updateState]
  );

  // Reset
  const reset = useCallback(() => {
    trader.reset();
    updateState();
  }, [trader, updateState]);

  // Get unrealized PnL
  const getUnrealizedPnL = useCallback(
    (prices: Map<string, number>): number => {
      return trader.getUnrealizedPnL(prices);
    },
    [trader]
  );

  // Get position
  const getPosition = useCallback(
    (symbol: string): Position | undefined => {
      return trader.getPosition(symbol);
    },
    [trader]
  );

  return {
    // State
    balance,
    stats,
    openPositions: trader.getOpenPositions(),
    closedTrades: trader.getClosedTrades(),

    // Actions
    openTrade,
    checkTrade,
    closeAllTrades,
    closeTrade,
    reset,

    // Queries
    getUnrealizedPnL,
    getPosition,
  };
}
