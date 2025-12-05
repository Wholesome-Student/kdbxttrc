export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const name = url.searchParams.get("name") ?? "world";
    return json({ message: `Hello, ${name}` });
  }

  if (req.method === "POST") {
    try {
      const ct = (req.headers.get("content-type") || "").toLowerCase();
      let name: string | undefined;

      if (!ct.includes("application/json")) {
        return json({ error: "Unsupported content type" }, 400);
      }

      const data = await req.json().catch(() => null);
      if (data && typeof data.name === "string") name = data.name;

      console.log("/api/hello POST parsed name:", name ?? "world");
      return json({
        message: `Hello, ${name ?? "world"}`,
      });
    } catch (e) {
      console.error("/api/hello POST error", e);
      return json({ error: "Invalid request" }, 400);
    }
  }

  return json({ error: "Method not allowed" }, 405);
}

/**
 * 返すJSONレスポンスを作成する
 *
 * @param obj 返すオブジェクト
 * @param status HTTPステータスコード
 * @returns JSONレスポンス
 */
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
