import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

let dbAvailable = true;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

pool.on("error", () => {
  dbAvailable = false;
  scheduleRetry();
});

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    try {
      await pool.query("SELECT 1");
      dbAvailable = true;
      console.log("Database connection restored.");
    } catch {
      scheduleRetry();
    }
  }, 5_000);
}

// Test connection on startup
pool.query("SELECT 1").catch(() => {
  dbAvailable = false;
  console.warn(
    "⚠ Could not connect to PostgreSQL — the server will run but API calls will fail.\n" +
    "  To set up the database, see the README or run: npm run db:init",
  );
  scheduleRetry();
});

export function isDatabaseAvailable() {
  return dbAvailable;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  if (!dbAvailable) {
    throw new Error("Database is not available");
  }
  return pool.query<T>(text, params);
}

export async function shutdown() {
  if (retryTimer) clearTimeout(retryTimer);
  await pool.end();
}
