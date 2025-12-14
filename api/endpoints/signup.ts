import { query, close } from "../utils/db.ts";

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "POST") {
    try {
      const contentType: string = (
        req.headers.get("content-type") || ""
      ).toLowerCase();

      if (!contentType.includes("x-www-form-urlencoded")) {
        return json({ error: `Unsupported content type, ${contentType}` }, 400);
      }

      const data = await req.formData().catch(() => null);
      const username: string | undefined = data?.get("username")?.toString();
      if (username === undefined || username.trim() === "") {
        return json({ error: "ユーザー名は必須です" }, 400);
      }

      // ここでユーザー名の処理を行う（例: データベースに保存、セッション開始など）
      const sessionId: string = crypto.randomUUID();
      const now: string = new Date()
        .toLocaleString("ja-JP")
        .replaceAll("/", "-");
      try {
        await query(
          `INSERT INTO session (session_id, username , created_at) VALUES (?, ?, ?);`,
          [sessionId, username, now]
        );
      } catch (e) {
        return json(
          {
            error: "ログイン失敗",
            sessionId: sessionId,
            username: username,
            datetime: now,
            errormessage: (e as Error).message,
          },
          500
        );
      } finally {
        await close();
      }
      return json({ message: "ログイン成功", sessionId: sessionId });
    } catch (_) {
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
