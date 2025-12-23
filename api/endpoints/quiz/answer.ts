export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const ct = (req.headers.get("content-type") || "").toLowerCase();

  if (!ct.includes("application/json")) {
    return json({ error: "Unsupported content type" }, 400);
  }

  const data = await req.json().catch(() => null);
  if (!data) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const userId = data.user_id;
  const questionId = data.question_id;
  const choiceId = data.choice_id;

  if (!userId) {
    return json({ error: "Missing user_id in request body" }, 400);
  }
  if (!questionId) {
    return json({ error: "Missing question_id in request body" }, 400);
  }
  if (!choiceId) {
    return json({ ok: true }, 200);
  }

  try {
    const { hasDbConfig, query } = await import("../../utils/db.ts");

    if (!hasDbConfig()) {
      return json({
        ok: false,
        configured: false,
        message: "DB not configured (set DB_HOST and DB_USER)",
      });
    }

    // 存在チェック
    const user = await query("SELECT * FROM user WHERE id = ?;", [userId]);
    if (user.length === 0) {
      return json({ error: "User not found" }, 404);
    }
    const question = await query("SELECT * FROM question WHERE id = ?;", [
      questionId,
    ]);
    if (question.length === 0) {
      return json({ error: "Question not found" }, 404);
    }
    const choice = await query("SELECT * FROM choice WHERE id = ?;", [
      choiceId,
    ]);
    if (choice.length === 0) {
      return json({ error: "Choice not found" }, 404);
    }

    // 回答登録
    await query(
      "INSERT INTO user_answer (user_id, question_id, choice_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE choice_id = VALUES(choice_id);",
      [userId, questionId, choiceId]
    );

    return json({ ok: true });
  } catch (e) {
    console.error("DB Operation Error", e);
    return json({ ok: false, error: String(e) }, 500);
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
