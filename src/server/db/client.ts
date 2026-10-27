import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { MIGRATION_SQL } from "@/server/db/migrate";

export type Database = LibSQLDatabase<typeof schema>;

function ensureFileDirectory(url: string) {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  if (filePath === ":memory:" || filePath.length === 0) return;
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

export async function openDatabase(url?: string, authToken?: string) {
  const databaseUrl = url ?? process.env.DATABASE_URL ?? "file:./data/nexo.db";
  const token = authToken ?? process.env.DATABASE_AUTH_TOKEN;
  ensureFileDirectory(databaseUrl);
  const client = createClient({
    url: databaseUrl,
    authToken: token && token.length > 0 ? token : undefined,
  });
  await client.executeMultiple(MIGRATION_SQL);
  return drizzle(client, { schema });
}

let singleton: Promise<Database> | null = null;

export function getDatabase() {
  singleton ??= openDatabase();
  return singleton;
}

export async function closeClient(client: Client) {
  client.close();
}
