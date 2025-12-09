export default async function handler(req: Request): Promise<Response> {
  if (req.method === "POST") {
    try {
      const contentType: string = (
        req.headers.get("content-type") || ""
      ).toLowerCase();
      let username: string | undefined;

      if (!contentType.includes("application/json")) {
        return json({ error: "Unsupported content type" }, 400);
      }

      const data = await req.json().catch(() => null);
      if (data && typeof data.username === "string") username = data.username;

      return json({
        message: `Hello, ${username ?? "world"}`,
      });
    } catch (e) {
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
