/**
 * Standalone database client for CLI scripts.
 *
 * Deliberately does not import `lib/db` — that module is marked `server-only`,
 * which throws outside a React Server Component context.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "../lib/db/schema";

neonConfig.webSocketConstructor = ws;

export function connect(url = process.env.DATABASE_URL) {
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  return { pool, db: drizzle(pool, { schema }) };
}

export { schema };
