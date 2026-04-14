import { NextResponse } from 'next/server';
import { Pool } from 'pg';

type TradeLogPayload = {
  time: number;
  entry: number;
  exit: number;
  type: 'BUY' | 'SELL' | string;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN' | string;
  profit: number;
  balance: number;
};

const globalWithDb = globalThis as typeof globalThis & {
  __tradeHistory?: TradeLogPayload[];
  __pgPool?: Pool;
  __tradeTableReady?: boolean;
};

function getTradeHistoryFallback() {
  globalWithDb.__tradeHistory = globalWithDb.__tradeHistory || [];
  return globalWithDb.__tradeHistory;
}

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!globalWithDb.__pgPool) {
    globalWithDb.__pgPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
  }
  return globalWithDb.__pgPool;
}

async function ensureTable(pool: Pool) {
  if (globalWithDb.__tradeTableReady) return;
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
  globalWithDb.__tradeTableReady = true;
}

export async function POST(req: Request) {
  const payload = (await req.json()) as TradeLogPayload;

  if (
    typeof payload?.time !== 'number' ||
    typeof payload?.entry !== 'number' ||
    typeof payload?.exit !== 'number' ||
    typeof payload?.profit !== 'number' ||
    typeof payload?.balance !== 'number'
  ) {
    return NextResponse.json({ error: 'Invalid trade payload' }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) {
    const fallback = getTradeHistoryFallback();
    fallback.push(payload);
    if (fallback.length > 5000) fallback.shift();
    return NextResponse.json({ ok: true, storage: 'memory' });
  }

  try {
    await ensureTable(pool);
    await pool.query(
      `INSERT INTO trade_history (time_ms, entry_price, exit_price, trade_type, result, profit, balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [payload.time, payload.entry, payload.exit, payload.type, payload.result, payload.profit, payload.balance]
    );
    return NextResponse.json({ ok: true, storage: 'postgres' });
  } catch (error) {
    const fallback = getTradeHistoryFallback();
    fallback.push(payload);
    if (fallback.length > 5000) fallback.shift();
    return NextResponse.json({
      ok: true,
      storage: 'memory',
      warning: error instanceof Error ? error.message : 'DB insert failed'
    });
  }
}
