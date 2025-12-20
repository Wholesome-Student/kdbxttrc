import { getQuizState } from "../../quiz_state.ts";

type PollingStandby = {
  status: "standby";
};

type PollingClosed = {
  status: "closed";
};

type PollingFinished = {
  status: "finished";
};

type PollingActive = {
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

type PollingResult = {
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
    // explanation?: string;
  };
};

type PollingResponse =
  | PollingStandby
  | PollingActive
  | PollingClosed
  | PollingResult
  | PollingFinished;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const state = getQuizState();

  switch (state.status) {
    case "standby": {
      const body: PollingStandby = { status: "standby" };
      return json(body satisfies PollingResponse);
    }
    case "closed": {
      const body: PollingClosed = { status: "closed" };
      return json(body satisfies PollingResponse);
    }
    case "finished": {
      const body: PollingFinished = { status: "finished" };
      return json(body satisfies PollingResponse);
    }
    case "active": {
      const body: PollingActive = {
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
      return json(body satisfies PollingResponse);
    }
    case "result": {
      const body: PollingResult = {
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
          // explanation: state.explanation,
        },
      };
      return json(body satisfies PollingResponse);
    }
  }
}
