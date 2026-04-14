import { NextResponse } from 'next/server';
import { Pool } from 'pg';

type TradeLog = {
  result?: 'WIN' | 'LOSS' | string;
  balance?: number;
  profit?: number;
};

const globalWithStats = globalThis as typeof globalThis & {
  __tradeHistory?: TradeLog[];
  __pgPool?: Pool;
  __tradeTableReady?: boolean;
};

function getTradeHistoryFallback() {
  globalWithStats.__tradeHistory = globalWithStats.__tradeHistory || [];
  return globalWithStats.__tradeHistory;
}

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!globalWithStats.__pgPool) {
    globalWithStats.__pgPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
  }
  return globalWithStats.__pgPool;
}

async function ensureTable(pool: Pool) {
  if (globalWithStats.__tradeTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id BIGSERIAL PRIMARY KEY,
      time_ms BIGINT NOT NULL,
      entry_price DOUBLE PRECISION NOT NULL,
      exit_price DOUBLE PRECISION NOT NULL,
      trade_type TEXT NOT NULL,
      result TEXT NOT NULL,
      profit DOUBLE PRECISION NOT NULL,
      balance DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  globalWithStats.__tradeTableReady = true;
}

export async function GET() {
  const pool = getPool();

  if (pool) {
    try {
      await ensureTable(pool);
      const [aggRes, balanceRes] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE result = 'WIN')::int AS wins,
             COUNT(*) FILTER (WHERE result = 'LOSS')::int AS losses,
             COUNT(*)::int AS total,
             COALESCE(SUM(profit), 0)::float8 AS realized_pnl
           FROM trade_history`
        ),
        pool.query(
          `SELECT balance
           FROM trade_history
           ORDER BY time_ms DESC
           LIMIT 1`
        )
      ]);

      const row = aggRes.rows[0] || { wins: 0, losses: 0, total: 0, realized_pnl: 0 };
      const total = Number(row.total || 0);
      const wins = Number(row.wins || 0);
      const losses = Number(row.losses || 0);
      const winRate = total ? (wins / total) * 100 : 0;
      const latestBalance = balanceRes.rows[0]?.balance ? Number(balanceRes.rows[0].balance) : 1000;

      return NextResponse.json({
        totalTrades: total,
        wins,
        losses,
        winRate: winRate.toFixed(2),
        balance: latestBalance,
        realizedPnl: Number(row.realized_pnl || 0),
        storage: 'postgres'
      });
    } catch {
      // Fall through to memory fallback.
    }
  }

  const trades = getTradeHistoryFallback();
  const wins = trades.filter((t) => t.result === 'WIN').length;
  const losses = trades.filter((t) => t.result === 'LOSS').length;
  const total = wins + losses;
  const winRate = total ? (wins / total) * 100 : 0;
  const latestBalance = trades.length ? Number(trades[trades.length - 1].balance || 1000) : 1000;
  const realizedPnl = trades.reduce((sum, t) => sum + Number(t.profit || 0), 0);

  return NextResponse.json({
    totalTrades: total,
    wins,
    losses,
    winRate: winRate.toFixed(2),
    balance: latestBalance,
    realizedPnl,
    storage: 'memory'
  });
}
