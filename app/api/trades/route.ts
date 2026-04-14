import { NextResponse } from 'next/server';
import { ensureCoreSchema, getDbPool } from '../../../lib/db';
import { requirePlan } from '../../../lib/entitlements';

type TradeLogPayload = {
  time: number;
  entry: number;
  exit: number;
  type: 'BUY' | 'SELL' | string;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN' | string;
  profit: number;
  balance: number;
  symbol?: string;
  confidence?: number;
};

export async function POST(req: Request) {
  const planCheck = await requirePlan(req, ['pro', 'elite']);
  if (!planCheck.ok) return planCheck.response;

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

  try {
    await ensureCoreSchema();
    const pool = getDbPool();
    await pool.query(
      `INSERT INTO trade_history (user_id, symbol, time_ms, entry_price, exit_price, trade_type, result, profit, balance, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        planCheck.userId,
        payload.symbol || 'UNKNOWN',
        payload.time,
        payload.entry,
        payload.exit,
        payload.type,
        payload.result,
        payload.profit,
        payload.balance,
        payload.confidence ?? null
      ]
    );
    return NextResponse.json({ ok: true, storage: 'postgres' });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      storage: 'postgres',
      warning: error instanceof Error ? error.message : 'DB insert failed'
    }, { status: 503 });
  }
}
