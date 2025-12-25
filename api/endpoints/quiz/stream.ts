import {
  getQuizState,
  subscribeQuizState,
  type QuizState,
} from "../../quiz_state.ts";

type StreamStandby = {
  status: "standby";
};

type StreamClosed = {
  status: "closed";
};

type StreamFinished = {
  status: "finished";
};

type StreamActive = {
  status: "active";
  data: {
    question: {
      id: number;
      context: string;
    };
    round: number;
    time_limit_sec: number;
    ended_at: number;
  };
};

type StreamResult = {
  status: "result";
  data: {
    question: {
      id: number;
      context: string;
    };
    round: number;
    correct_choice: {
      id: number;
      context: string;
    }[];
  };
};

type StreamResponse =
  | StreamStandby
  | StreamActive
  | StreamClosed
  | StreamResult
  | StreamFinished;

function buildStreamResponse(state: QuizState): StreamResponse {
  switch (state.status) {
    case "standby": {
      return { status: "standby" };
    }
    case "closed": {
      return { status: "closed" };
    }
    case "finished": {
      return { status: "finished" };
    }
    case "active": {
      return {
        status: "active",
        data: {
          question: {
            id: state.question.id,
            context: state.question.context,
          },
          round: state.round,
          time_limit_sec: state.timeLimitSec,
          ended_at: Math.floor(state.endedAt / 1000),
        },
      };
    }
    case "result": {
      return {
        status: "result",
        data: {
          question: {
            id: state.question.id,
            context: state.question.context,
          },
          round: state.round,
          correct_choice: state.correctChoices.map((c) => ({
            id: c.id,
            context: c.context,
          })),
        },
      };
    }
  }
}

export default function handler(req: Request): Response {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const cleanupFns: Array<() => void> = [];

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch (e) {
          closed = true;
          console.error("[SSE] enqueue error", e);
          // 後始末
          for (const fn of cleanupFns) {
            try {
              fn();
            } catch (_) {
              // ignore
            }
          }
          cleanupFns.length = 0;
          try {
            controller.close();
          } catch (_) {
            // ignore
          }
        }
      };
      const send = (state: QuizState) => {
        const payload = buildStreamResponse(state);
        const chunk = `data: ${JSON.stringify(payload)}\n\n`;
        safeEnqueue(encoder.encode(chunk));
      };

      // 接続直後に現在の状態を1回送信
      send(getQuizState());

      // 状態が変わるたびに送信
      const unsubscribe = subscribeQuizState((state) => {
        send(state);
      });
      cleanupFns.push(unsubscribe);

      // プロキシなどに切断されないよう、軽量なハートビートコメントを定期送信
      const heartbeatId = setInterval(() => {
        safeEnqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);
      cleanupFns.push(() => clearInterval(heartbeatId));

      // クライアント切断などでストリームがキャンセルされたときの後始末
      controller.signal?.addEventListener?.("abort", () => {
        if (closed) return;
        closed = true;
        for (const fn of cleanupFns) {
          try {
            fn();
          } catch (_) {
            // ignore
          }
        }
        cleanupFns.length = 0;
        try {
          controller.close();
        } catch (_) {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
