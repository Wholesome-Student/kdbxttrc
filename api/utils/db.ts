import { Client } from "https://deno.land/x/mysql@v2.11.0/mod.ts";

let client: Client | null = null;

export function hasDbConfig(): boolean {
  return Boolean(Deno.env.get("DB_HOST") && Deno.env.get("DB_USER"));
}

async function ensureClient(): Promise<Client> {
  if (client) return client;
  if (!hasDbConfig())
    throw new Error("DB not configured (set DB_HOST and DB_USER)");

  const DB_HOST = Deno.env.get("DB_HOST")!;
  const DB_PORT = Number(Deno.env.get("DB_PORT") ?? "3306");
  const DB_USER = Deno.env.get("DB_USER")!;
  const DB_PASS = Deno.env.get("DB_PASS") ?? "";
  const DB_NAME = Deno.env.get("DB_NAME") ?? "";

  client = await new Client().connect({
    hostname: DB_HOST,
    username: DB_USER,
    password: DB_PASS,
    db: DB_NAME || undefined,
    port: DB_PORT,
    charset: "utf8mb4",
  });

  return client;
}

/**
 * SQLクエリを実行する
 *
 * @param sql 実行するSQLクエリ
 * @param params クエリパラメータ
 */
export async function query(sql: string, params: string[] = []) {
  const c = await ensureClient();
  return await c.query(sql, params);
}

/** Close DB connection (optional) */
export async function close() {
  if (client) {
    try {
      await client.close();
    } catch {
      // ignore
    }
    client = null;
  }
}
