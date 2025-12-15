export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return json({ error: "Missing user_id query parameter" }, 400);
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

    const user = await query("SELECT * FROM user WHERE id = ?;", [userId]);
    if (user.length === 0) {
      return json({ error: "User not found" }, 404);
    }
    const choices = await query("SELECT * FROM choice;");
    const bingo = await query(
      "SELECT seed, punch FROM bingo WHERE id = (SELECT bingo_id FROM user WHERE id = ?);",
      [userId]
    );
    const userAnswer = await query(
      "SELECT choice_id FROM user_answer WHERE user_id = ?;",
      [userId]
    );

    return json({
      choices: choices.map((c: { id: number; content: string }) => c.content),
      bingo: {
        seed: JSON.parse(bingo[0].seed),
        punch: JSON.parse(bingo[0].punch),
      },
      round_status: {
        answered: userAnswer.length > 0,
        choice_id: userAnswer.length > 0 ? userAnswer[0].choice_id : null,
      },
    });
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
