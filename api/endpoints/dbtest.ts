export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { hasDbConfig, query } = await import("../utils/db.ts");

    if (!hasDbConfig()) {
      return json({
        ok: false,
        configured: false,
        message: "DB not configured (set DB_HOST and DB_USER)",
      });
    }

    const rows = await query("SELECT 1+1 AS sum");
    return json({ ok: true, configured: true, rows });
  } catch (e) {
    console.error("/api/dbtest error", e);
    return json({ ok: false, configured: true, error: String(e) }, 500);
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
