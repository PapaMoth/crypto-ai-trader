import { NextResponse } from "next/server";
import { ensureCoreSchema, getDbPool } from "./db";

export type Plan = "free" | "pro" | "elite";

export interface Entitlement {
  userId: string;
  plan: Plan;
  liveEnabled: boolean;
  maxCoins: number;
}

export function getUserIdFromRequest(req: Request): string | null {
  const fromHeader = req.headers.get("x-user-id");
  return fromHeader && fromHeader.trim() ? fromHeader.trim() : null;
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  await ensureCoreSchema();
  const pool = getDbPool();
  const res = await pool.query(
    `SELECT user_id, plan, live_enabled, max_coins
     FROM user_entitlements
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (!res.rows.length) {
    // Auto-provision default free entitlement.
    await pool.query(
      `INSERT INTO user_entitlements (user_id, plan, live_enabled, max_coins)
       VALUES ($1, 'free', false, 1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    return {
      userId,
      plan: "free",
      liveEnabled: false,
      maxCoins: 1,
    };
  }

  const row = res.rows[0];
  return {
    userId: String(row.user_id),
    plan: (String(row.plan) as Plan) || "free",
    liveEnabled: Boolean(row.live_enabled),
    maxCoins: Number(row.max_coins || 1),
  };
}

export async function requirePlan(req: Request, allowed: Plan[]) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Missing x-user-id header." }, { status: 401 }),
    };
  }
  const ent = await getEntitlement(userId);
  if (!allowed.includes(ent.plan)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `Plan '${ent.plan}' cannot access this feature.` },
        { status: 403 }
      ),
    };
  }
  return { ok: true as const, userId, entitlement: ent };
}

export async function requireLiveTradingAccess(req: Request) {
  const check = await requirePlan(req, ["pro", "elite"]);
  if (!check.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Upgrade to access live trading" },
        { status: 403 }
      ),
    };
  }
  return check;
}
