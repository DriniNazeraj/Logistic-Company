import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let dbAvailable = true;

pool.on("error", () => {
  dbAvailable = false;
});

// Test connection on startup
pool.query("SELECT 1").catch(() => {
  dbAvailable = false;
  console.warn(
    "⚠ Could not connect to PostgreSQL — the server will run but API calls will fail.\n" +
    "  To set up the database, see the README or run: npm run db:init",
  );
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
