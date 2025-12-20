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
  const url = new URL(req.url);

  if (req.method === "GET") {
    return json({ state: getQuizState() });
  }

  if (req.method === "POST") {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return json({ error: "Unsupported content type" }, 400);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const status = (body as any).status as QuizState["status"] | undefined;

    if (!status) {
      return json({ error: "Missing status" }, 400);
    }

    let nextState: QuizState;

    switch (status) {
      case "standby":
      case "closed":
      case "finished": {
        nextState = { status };
        break;
      }
      case "active": {
        const question = (body as any).question ?? {};
        const round = Number((body as any).round ?? 1);
        // 秒数は固定値: active から 15 秒間
        const timeLimitSec = 15;
        const endedAtSec = 0;

        if (!question.id) {
          return json(
            { error: "For status=active, question.id is required" },
            400
          );
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

        // question.id から DB の question を取得して context を埋める
        const rows = await query(
          "SELECT id, content FROM question WHERE id = ?;",
          [String(question.id)]
        );
        if (!rows || rows.length === 0) {
          return json({ error: "Question not found" }, 404);
        }
        const row = rows[0] as { id: number; content: string };

        const endedAtMs =
          endedAtSec > 0 ? endedAtSec * 1000 : Date.now() + timeLimitSec * 1000;

        nextState = {
          status: "active",
          question: { id: row.id, context: row.content },
          round,
          timeLimitSec,
          endedAt: endedAtMs,
        };
        break;
      }
      case "result": {
        const question = (body as any).question ?? {};
        const round = Number((body as any).round ?? 1);
        const correctChoiceRaw = (body as any).correct_choice ?? [];

        if (!question.id) {
          return json(
            { error: "For status=result, question.id is required" },
            400
          );
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

        // question.id から question.content と正解選択肢を DB から取得
        const questionRows = await query(
          "SELECT id, content FROM question WHERE id = ?;",
          [String(question.id)]
        );
        if (!questionRows || questionRows.length === 0) {
          return json({ error: "Question not found" }, 404);
        }
        const qRow = questionRows[0] as { id: number; content: string };

        let correctChoicesDb: { id: number; context: string }[] = [];
        const correctChoicesRows = await query(
          `SELECT c.id, c.content
					 FROM correct_answer ca
					 JOIN choice c ON ca.choice_id = c.id
					 WHERE ca.question_id = ?;`,
          [String(question.id)]
        );
        if (Array.isArray(correctChoicesRows)) {
          correctChoicesDb = correctChoicesRows.map((r: any) => ({
            id: Number(r.id),
            context: String(r.content),
          }));
        }

        // リクエストボディに correct_choice が来ていたら、それを優先しても良いが、
        // ここでは DB から取得したものを使う。
        const correctChoices = correctChoicesDb;

        nextState = {
          status: "result",
          question: { id: qRow.id, context: qRow.content },
          round,
          correctChoices,
        };
        break;
      }
      default:
        return json({ error: "Invalid status" }, 400);
    }

    setQuizState(nextState);
    return json({ ok: true, state: getQuizState() });
  }

  return json({ error: "Method not allowed" }, 405);
}
