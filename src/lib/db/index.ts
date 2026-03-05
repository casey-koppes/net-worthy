import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Create database connection
function getDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    // Return a mock for development without DB
    console.warn("DATABASE_URL not set - database operations will fail");
    return null as unknown as ReturnType<typeof drizzle>;
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

// Export singleton database instance
export const db = getDb();

// Export schema for use in queries
export * from "./schema";
