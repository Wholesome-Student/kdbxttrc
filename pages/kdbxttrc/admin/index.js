const API_START = "/api/admin/start";
const API_RESET = "/api/admin/reset";

const el = (id) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element: #${id}`);
  return e;
};

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function nowJstString() {
  // simple, locale-friendly. (Server doesn't care)
  return new Date().toLocaleString("ja-JP", { hour12: false });
}

function setBadge(status) {
  const badge = el("stateBadge");
  const text = status ?? "unknown";
  badge.textContent = text;
  badge.dataset.status = text;
}

function setStatus(targetEl, kind, message) {
  targetEl.classList.remove("status--ok", "status--err");
  if (!message) {
    targetEl.textContent = "";
    return;
  }
  if (kind === "ok") targetEl.classList.add("status--ok");
  if (kind === "err") targetEl.classList.add("status--err");
  targetEl.textContent = message;
}

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timeoutMs = 8000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
      },
      signal: controller.signal,
    });

    const ct = resp.headers.get("content-type") || "";
    const isJson = ct.toLowerCase().includes("application/json");
    const data = isJson
      ? await resp.json().catch(() => null)
      : await resp.text();

    if (!resp.ok) {
      const msg =
        typeof data === "string"
          ? data
          : data && typeof data === "object" && data.error
          ? data.error
          : `HTTP ${resp.status}`;
      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(t);
  }
}

async function startQuiz(payloadOrNull) {
  const startBtn = el("startBtn");
  const startDefaultsBtn = el("startDefaultsBtn");
  const startStatusEl = el("startStatus");

  startBtn.disabled = true;
  startDefaultsBtn.disabled = true;
  setStatus(startStatusEl, null, "送信中…");

  try {
    const opts = payloadOrNull
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payloadOrNull),
        }
      : { method: "POST" };

    const data = await fetchJson(API_START, opts);
    setStatus(startStatusEl, "ok", "開始しました");

    // クイズ状態は SSE で自動更新されるため、ここでは明示的な再取得はしない
  } catch (e) {
    const detail = e?.data ?? undefined;
    setStatus(startStatusEl, "err", `失敗: ${String(e?.message || e)}`);
    appendLog("POST /api/admin/start failed", {
      message: String(e?.message || e),
      status: e?.status,
      detail,
    });
  } finally {
    startBtn.disabled = false;
    startDefaultsBtn.disabled = false;
  }
}

async function resetQuiz() {
  const resetBtn = el("resetBtn");
  const startStatusEl = el("startStatus");

  resetBtn.disabled = true;
  setStatus(startStatusEl, null, "リセット中…");

  try {
    const data = await fetchJson(API_RESET, { method: "POST" });
    setStatus(startStatusEl, "ok", "リセットしました");
  } catch (e) {
    setStatus(startStatusEl, "err", `リセット失敗: ${String(e?.message || e)}`);
  } finally {
    resetBtn.disabled = false;
  }
}

function parseStartForm() {
  const form = el("startForm");
  const fd = new FormData(form);
  const questionId = Number(fd.get("questionId"));
  const round = Number(fd.get("round"));

  return {
    question: { id: questionId },
    round,
  };
}

let quizEventSource = null;

function connectQuizSse() {
  if (quizEventSource) return;

  const stateJsonEl = el("stateJson");

  quizEventSource = new EventSource("/api/quiz/stream");

  quizEventSource.onopen = () => {
    setStatus(el("startStatus"), null, "クイズ状態を監視中…");
  };

  quizEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      setBadge(data.status);
      stateJsonEl.textContent = prettyJson(data);
    } catch (e) {
      stateJsonEl.textContent = `SSEデータのパースに失敗しました\n\n${String(
        e
      )}`;
    }
  };

  quizEventSource.onerror = (err) => {
    console.error("Admin SSE error", err);
    setStatus(
      el("startStatus"),
      "err",
      "クイズ状態SSE接続でエラーが発生しました"
    );
  };
}

function main() {
  el("refreshBtn").addEventListener("click", () => {
    appendLog("Manual refresh");
    refreshState();
  });

  el("startForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    startQuiz(parseStartForm());
  });

  el("startDefaultsBtn").addEventListener("click", () => {
    startQuiz(null);
  });

  el("resetBtn").addEventListener("click", () => {
    resetQuiz();
  });

  // 初期表示: クイズ状態を SSE で購読
  connectQuizSse();
}

main();
