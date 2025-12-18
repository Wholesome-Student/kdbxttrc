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

      // 'a'~'z'までの配列を作成してランダムにシャッフルする
      const seed = shuffleArray(
        Array.from(
          { length: 26 },
          (_, i) => String.fromCharCode(97 + i) // 97 = 'a'
        ).filter((c) => c !== "x")
      );

      try {
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
        return json(
          {
            error: "DB 操作に失敗しました",
            errormessage: (e as Error).message,
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
