import {
  getQuizState,
  setQuizState,
  type QuizState,
} from "../../quiz_state.ts";
import { hasDbConfig, query } from "../../utils/db.ts";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Allow empty POST (no JSON) — treat as defaults. If JSON is present, parse and validate it.
  const contentType = req.headers.get("content-type") || "";
  let bodyObj: any = {};

  if (contentType.toLowerCase().includes("application/json")) {
    // Read raw text first so we can distinguish empty body from invalid JSON
    const raw = await req.text().catch(() => "");
    if (raw.trim() === "") {
      bodyObj = {};
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
          return json({ error: "Invalid JSON body" }, 400);
        }
        bodyObj = parsed;
      } catch (_e) {
        return json({ error: "Invalid JSON body" }, 400);
      }
    }
  } else {
    // no JSON content-type -> proceed with defaults
    bodyObj = {};
  }

  // Allow caller to specify starting question id and round. Defaults: id=1, round=1
  const questionIdRaw = bodyObj?.question?.id ?? bodyObj?.question_id ?? 1;
  const round = Number(bodyObj?.round ?? 1);

  const questionId = Number(questionIdRaw);
  if (!Number.isFinite(questionId) || questionId <= 0) {
    return json({ error: "Invalid question id" }, 400);
  }

  // fixed time limit as in quiz_state
  const timeLimitSec = 15;

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

  // Fetch question from DB
  const rows = await query("SELECT id, content FROM question WHERE id = ?;", [
    String(questionId),
  ]);
  if (!rows || rows.length === 0) {
    return json({ error: "Question not found" }, 404);
  }
  const row = rows[0] as { id: number; content: string };

  const endedAt = Date.now() + timeLimitSec * 1000;

  const nextState: QuizState = {
    status: "active",
    question: { id: Number(row.id), context: row.content },
    round,
    timeLimitSec,
    endedAt,
  };

  setQuizState(nextState);

  return json({ ok: true, state: getQuizState() });
}
