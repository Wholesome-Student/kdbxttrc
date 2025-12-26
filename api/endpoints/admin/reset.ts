import { getQuizState, setQuizState } from "../../quiz_state.ts";
import { hasDbConfig, query } from "../../utils/db.ts";
import { isAdminRequest, unauthorizedResponse } from "../../utils/auth.ts";

/**
 * 管理者用: 全ユーザーの回答・ビンゴ状態をリセットするエンドポイント
 *
 * - user_answer テーブルを全削除
 * - user は残したまま、関連する bingo レコードの
 *   - seed を再生成
 *   - punch を空配列にする
 * - アプリ内の quiz_state を standby に戻す
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isAdminRequest(req)) {
    return unauthorizedResponse();
  }

  if (!hasDbConfig()) {
    return json(
      {
        ok: false,
        configured: false,
        message: "DB not configured (set DB_HOST and DB_USER)",
      },
      500
    );
  }

  try {
    // 1. 全 user_answer レコードを削除
    await query("DELETE FROM user_answer;", []);

    // 2. 既存の全 bingo を取得
    const bingoRows = await query("SELECT id FROM bingo;", []);

    // 3. 各 bingo レコードの seed を再生成し、punch を空配列にする
    for (const row of bingoRows ?? []) {
      const id = Number((row as any).id);
      if (!Number.isFinite(id)) continue;

      const seedNumbers = Array.from({ length: 25 }, (_, i) => i);
      for (let i = seedNumbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seedNumbers[i], seedNumbers[j]] = [seedNumbers[j], seedNumbers[i]];
      }

      const seedJson = JSON.stringify(seedNumbers);
      const punchJson = JSON.stringify([]);

      await query("UPDATE bingo SET seed = ?, punch = ? WHERE id = ?;", [
        seedJson,
        punchJson,
        String(id),
      ]);
    }

    // 4. アプリ内のクイズ状態を standby に戻す
    setQuizState({ status: "standby" });

    return json({ ok: true, state: getQuizState() });
  } catch (e) {
    console.error("/admin/reset error", e);
    return json({ ok: false, error: String(e?.message ?? e) }, 500);
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
