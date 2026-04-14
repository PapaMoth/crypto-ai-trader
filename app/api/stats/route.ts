import { NextResponse } from 'next/server';
import { ensureCoreSchema, getDbPool } from '../../../lib/db';
import { getUserIdFromRequest } from '../../../lib/entitlements';

export async function GET(req: Request) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Missing x-user-id header.' }, { status: 401 });
  }

  try {
    await ensureCoreSchema();
    const pool = getDbPool();

    const whereClause = `WHERE user_id = $1`;
    const params = [userId];
    const [aggRes, balanceRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE result = 'WIN')::int AS wins,
           COUNT(*) FILTER (WHERE result = 'LOSS')::int AS losses,
           COUNT(*)::int AS total,
           COALESCE(SUM(profit), 0)::float8 AS realized_pnl
         FROM trade_history
         ${whereClause}`,
        params
      ),
      pool.query(
        `SELECT balance
         FROM trade_history
         ${whereClause}
         ORDER BY time_ms DESC
         LIMIT 1`,
        params
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
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Stats query failed'
    }, { status: 503 });
  }
}
