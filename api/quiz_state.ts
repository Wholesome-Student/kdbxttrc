/**
 * クイズの現在の状態を管理するモジュール
 */
import { hasDbConfig, query } from "./utils/db.ts";
export type QuizStatus =
  | "standby"
  | "active"
  | "closed"
  | "result"
  | "finished";

/**
 * クイズの状態を表す型
 */
export type QuizState =
  | { status: "standby" }
  | {
      status: "active";
      question: { id: number; context: string };
      round: number;
      timeLimitSec: number;
      endedAt: number;
    }
  | {
      status: "closed";
      question: { id: number; context: string };
      round: number;
    }
  | {
      status: "result";
      question: { id: number; context: string };
      round: number;
      correctChoices: { id: number; context: string }[];
    }
  | { status: "finished" };

// 現在のクイズ状態
let currentState: QuizState = { status: "standby" };

// 内部で管理する自動遷移タイマー (setTimeout の ID)
let autoTransitionTimer: number | undefined = undefined;

/**
 * 自動遷移タイマーをクリアするヘルパー関数
 */
function clearAutoTransitionTimer() {
  if (autoTransitionTimer !== undefined) {
    clearTimeout(autoTransitionTimer);
    autoTransitionTimer = undefined;
  }
}

/**
 * 現在のクイズ状態を取得する関数
 * @returns 現在のクイズ状態
 */
export function getQuizState(): QuizState {
  return currentState;
}

/**
 * クイズ状態を設定する関数
 * @param state 設定するクイズ状態
 */
export function setQuizState(state: QuizState): void {
  // 既存のタイマーがあればクリア
  clearAutoTransitionTimer();

  currentState = state;

  if (state.status === "active") {
    // 出題時間: 15秒
    const delayMs = 15_000;
    autoTransitionTimer = setTimeout(() => {
      const s = currentState;

      const closedState: QuizState = {
        status: "closed",
        question: s.question,
        round: s.round,
      };

      setQuizState(closedState);
    }, delayMs) as unknown as number;
  } else if (state.status === "closed") {
    // 待機時間: 5秒
    const delayMs = 5_000;

    autoTransitionTimer = setTimeout(async () => {
      const s = currentState;

      const correctAnswerRows = await query(
        "SELECT choice_id FROM correct_answer WHERE question_id = ?;",
        [String(s.question.id)]
      );

      const correctIds = (correctAnswerRows || [])
        .map((r: any) => Number(r.choice_id))
        .filter((id) => Number.isFinite(id));

      let correctChoices: { id: number; context: string }[] = [];

      if (correctIds.length > 0 && hasDbConfig()) {
        try {
          const placeholders = correctIds.map(() => "?").join(",");
          const rows = await query(
            `SELECT id, content FROM choice WHERE id IN (${placeholders});`,
            correctIds.map(String)
          );
          correctChoices = (rows || []).map((r: any) => ({
            id: Number(r.id),
            context: r.content,
          }));
        } catch {
          correctChoices = [];
        }
      }

      const resultState: QuizState = {
        status: "result",
        question: s.question,
        round: s.round,
        correctChoices,
      };
      setQuizState(resultState);
    }, delayMs) as unknown as number;
  } else if (state.status === "result") {
    // 表示時間: 5秒
    const delayMs = 5_000;
    autoTransitionTimer = setTimeout(async () => {
      const s = currentState;

      try {
        // 現在の問題IDより大きい最初の問題を次の問題とする
        const nextQuestionId = s.question.id + 1;
        const nextQuestionRows = await query(
          "SELECT id, content FROM question WHERE id = ?;",
          [String(nextQuestionId)]
        );
        if (!nextQuestionRows || nextQuestionRows.length === 0) {
          setQuizState({ status: "finished" });
          return;
        }

        const nextRow = nextQuestionRows[0] as { id: number; content: string };

        const timeLimitSec = 15;
        const nextState: QuizState = {
          status: "active",
          question: {
            id: nextRow.id,
            context: nextRow.content,
          },
          round: s.round + 1,
          timeLimitSec,
          endedAt: Date.now() + timeLimitSec * 1000,
        };

        setQuizState(nextState);
      } catch {
        // 何かあったら finished にする
        setQuizState({ status: "finished" });
      }
    }, delayMs) as unknown as number;
  }
}
