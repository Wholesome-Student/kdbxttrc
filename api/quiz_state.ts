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

// 状態変更を通知するための購読者リスト
type QuizStateListener = (state: QuizState) => void;
const listeners = new Set<QuizStateListener>();

export function subscribeQuizState(listener: QuizStateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyQuizStateChanged(state: QuizState) {
  for (const l of listeners) {
    try {
      l(state);
    } catch (e) {
      console.error("quiz state listener error", e);
    }
  }
}

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

  // 購読者へ通知
  notifyQuizStateChanged(state);

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

      if (!hasDbConfig()) {
        // DB設定がない場合は punch 計算をスキップしてそのまま result へ
        const resultState: QuizState = {
          status: "result",
          question: s.question,
          round: s.round,
          correctChoices: [],
        };
        setQuizState(resultState);
        return;
      }

      try {
        // 1. 正答となる choice_id を取得
        const correctAnswerRows = await query(
          "SELECT choice_id FROM correct_answer WHERE question_id = ?;",
          [String(s.question.id)]
        );

        const correctIds = (correctAnswerRows || [])
          .map((r: any) => Number(r.choice_id))
          .filter((id) => Number.isFinite(id));

        // 2. 各ユーザーの回答を取得し、正解かどうか判定
        if (correctIds.length > 0) {
          const placeholders = correctIds.map(() => "?").join(",");

          // user_answer からこの問題に対する各ユーザーの選択を取得
          const answerRows = await query(
            "SELECT ua.user_id, ua.choice_id, u.bingo_id FROM user_answer ua JOIN `user` u ON ua.user_id = u.id WHERE ua.question_id = ?;",
            [String(s.question.id)]
          );

          // 3. 正解しているユーザーに対して punch(JSON配列) に question.id を追加
          const winners: { user_id: number; bingo_id: number }[] = [];

          for (const r of answerRows || []) {
            const choiceId = Number(r.choice_id);
            if (!Number.isFinite(choiceId)) continue;
            if (correctIds.includes(choiceId)) {
              winners.push({
                user_id: Number(r.user_id),
                bingo_id: Number(r.bingo_id),
              });
            }
          }

          // bingo ごとに punch を更新
          for (const w of winners) {
            const bingoRows = await query(
              "SELECT punch FROM bingo WHERE id = ? FOR UPDATE;",
              [String(w.bingo_id)]
            );

            let punch: number[] = [];
            if (bingoRows && bingoRows.length > 0) {
              try {
                const raw = (bingoRows[0] as any).punch;
                if (typeof raw === "string") {
                  punch = JSON.parse(raw);
                } else if (Array.isArray(raw)) {
                  punch = raw
                    .map((v: unknown) => Number(v))
                    .filter((v) => Number.isFinite(v));
                }
              } catch {
                punch = [];
              }
            }

            // 既に含まれていない場合のみ追加（0-index で保存するため -1 して保存）
            const punchedIndex = s.question.id - 1;
            if (!punch.includes(punchedIndex)) {
              punch.push(punchedIndex);
            }

            await query("UPDATE bingo SET punch = ? WHERE id = ?;", [
              JSON.stringify(punch),
              String(w.bingo_id),
            ]);
          }
        }

        // 4. 結果表示用に正解選択肢の内容を取得
        let correctChoices: { id: number; context: string }[] = [];

        if (correctIds.length > 0) {
          const placeholders2 = correctIds.map(() => "?").join(",");
          const rows = await query(
            `SELECT id, content FROM choice WHERE id IN (${placeholders2});`,
            correctIds.map(String)
          );
          correctChoices = (rows || []).map((r: any) => ({
            id: Number(r.id),
            context: r.content,
          }));
        }

        const resultState: QuizState = {
          status: "result",
          question: s.question,
          round: s.round,
          correctChoices,
        };
        setQuizState(resultState);
      } catch {
        // 何かあった場合もとりあえず result へ遷移
        const fallbackState: QuizState = {
          status: "result",
          question: s.question,
          round: s.round,
          correctChoices: [],
        };
        setQuizState(fallbackState);
      }
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
