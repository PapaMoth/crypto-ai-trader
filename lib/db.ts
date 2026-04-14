import { Pool } from "pg";

const globalWithDb = globalThis as typeof globalThis & {
  __mainPgPool?: Pool;
  __schemaReady?: boolean;
};

export function getDbPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database-backed operation.");
  }

  if (!globalWithDb.__mainPgPool) {
    globalWithDb.__mainPgPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }

  return globalWithDb.__mainPgPool;
}

export async function ensureCoreSchema(): Promise<void> {
  if (globalWithDb.__schemaReady) return;
  const pool = getDbPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_entitlements (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'free',
      live_enabled BOOLEAN NOT NULL DEFAULT false,
      max_coins INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trade_history (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL DEFAULT 'UNKNOWN',
      time_ms BIGINT NOT NULL,
      entry_price DOUBLE PRECISION NOT NULL,
      exit_price DOUBLE PRECISION NOT NULL,
      trade_type TEXT NOT NULL,
      result TEXT NOT NULL,
      profit DOUBLE PRECISION NOT NULL,
      balance DOUBLE PRECISION NOT NULL,
      confidence DOUBLE PRECISION NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS signal_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      signal TEXT NOT NULL,
      confidence DOUBLE PRECISION NOT NULL,
      market_regime TEXT NULL,
      payload JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bot_heartbeats (
      id BIGSERIAL PRIMARY KEY,
      worker_id TEXT NOT NULL,
      user_id TEXT NULL,
      status TEXT NOT NULL,
      note TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  globalWithDb.__schemaReady = true;
}
