import { query, close } from "../utils/db.ts";

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "POST") {
    try {
      const contentType: string = (
        req.headers.get("content-type") || ""
      ).toLowerCase();

      let userName: string | undefined;

      if (contentType.includes("application/json")) {
        const body = await req.json().catch(() => null);
        if (body && typeof body === "object") {
          userName = (body as any)["user_name"] ?? (body as any)["userName"];
          if (typeof userName === "string") userName = userName.toString();
        }
      } else {
        return json({ error: `Unsupported content type, ${contentType}` }, 400);
      }

      if (userName === undefined || userName.trim() === "") {
        return json({ error: "ユーザー名は必須です" }, 400);
      }

      // 0~24までの配列を作成してランダムにシャッフルする
      const seed = shuffleArray(Array.from({ length: 25 }, (_, i) => i));

      try {
        // 既に同じユーザー名が存在するかをチェック
        const existingUsers: any[] = await query(
          `SELECT id FROM user WHERE name = ? LIMIT 1;`,
          [userName]
        );

        if (Array.isArray(existingUsers) && existingUsers.length > 0) {
          return json(
            {
              error: "このユーザー名は既に使われています。別の名前を入力してください",
              code: "DUPLICATE_USER_NAME",
            },
            409,
          );
        }

        const bingoResult: any = await query(
          `INSERT INTO bingo (seed, punch) VALUES (?, ?);`,
          [JSON.stringify(seed), JSON.stringify([])]
        );
        const bingoId = bingoResult.insertId ?? bingoResult.lastInsertId;
        if (typeof bingoId !== "number") {
          throw new Error("INSERT bingo returned no insert id");
        }

        const userResult = await query(
          `INSERT INTO user (name, bingo_id) VALUES (?, ?);`,
          [userName, bingoId.toString()]
        );

        const userId = userResult.insertId ?? userResult.lastInsertId;
        if (typeof userId !== "number") {
          throw new Error("INSERT user returned no insert id");
        }

        return json({
          message: "ユーザー登録成功",
          userId,
        });
      } catch (e) {
        // DB のユニーク制約違反などでユーザー名重複が検出された場合にも
        // わかりやすいメッセージを返す
        const msg = (e as Error).message || "";
        if (msg.includes("Duplicate entry") && msg.includes("for key 'name'")) {
          return json(
            {
              error: "このユーザー名は既に使われています。別の名前を入力してください",
              code: "DUPLICATE_USER_NAME",
            },
            409,
          );
        }

        return json(
          {
            error: "DB 操作に失敗しました",
            errormessage: msg,
          },
          500
        );
      } finally {
        await close();
      }
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

/**
 * 配列をランダムにシャッフルする
 *
 * @param array 配列
 * @returns シャッフルされた配列
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}
