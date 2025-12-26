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
      const send = (state: QuizState) => {
        const payload = buildStreamResponse(state);
        const chunk = `data: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      // 接続直後に現在の状態を1回送信
      send(getQuizState());

      // 状態が変わるたびに送信
      const unsubscribe = subscribeQuizState((state) => {
        try {
          send(state);
        } catch (e) {
          console.error("[SSE] push error", e);
        }
      });

      // プロキシなどに切断されないよう、軽量なハートビートコメントを定期送信
      const heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (e) {
          console.error("[SSE] heartbeat error", e);
          clearInterval(heartbeatId);
          unsubscribe();
          try {
            controller.close();
          } catch (_) {
            // ignore
          }
        }
      }, 30_000);
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
