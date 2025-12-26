const API_START = "/api/admin/start";
const API_STATE = "/api/admin/state";
const API_RESET = "/api/admin/reset";

const STORAGE_KEY_AUTH = "kdbxttrc_admin_auth";

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

async function refreshState() {
  const stateStatusEl = el("startStatus");
  const stateJsonEl = el("stateJson");

  try {
    setStatus(stateStatusEl, null, "状態取得中…");
    const data = await fetchJson(API_STATE);
    const state =
      data && typeof data === "object" && "state" in data ? data.state : data;

    setBadge(state?.status ?? null);
    stateJsonEl.textContent = prettyJson(state);
    setStatus(stateStatusEl, "ok", `最終更新: ${nowJstString()}`);
  } catch (e) {
    setStatus(stateStatusEl, "err", `状態取得失敗: ${String(e?.message || e)}`);
  }
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
        ...buildAuthHeader(),
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

function buildAuthHeader() {
  const raw = window.localStorage.getItem(STORAGE_KEY_AUTH);
  if (!raw) return {};
  try {
    const { username, password } = JSON.parse(raw);
    if (!username || !password) return {};
    const token = btoa(`${username}:${password}`);
    return { Authorization: `Basic ${token}` };
  } catch {
    return {};
  }
}

function saveAuth(username, password) {
  window.localStorage.setItem(
    STORAGE_KEY_AUTH,
    JSON.stringify({ username, password })
  );
}

function clearAuth() {
  window.localStorage.removeItem(STORAGE_KEY_AUTH);
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

    // refresh state view after starting
    await refreshState();
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

let pollTimer = null;

function setPollingEnabled(enabled) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (enabled) {
    pollTimer = setInterval(() => {
      refreshState();
    }, 2000);
  }
}

function main() {
  // Login form
  const loginForm = document.getElementById("loginForm");
  const loginStatusEl = document.getElementById("loginStatus");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginForm && loginStatusEl && logoutBtn) {
    loginForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(loginForm);
      const username = String(fd.get("username") || "").trim();
      const password = String(fd.get("password") || "");

      if (!username || !password) {
        setStatus(
          loginStatusEl,
          "err",
          "ユーザー名とパスワードを入力してください"
        );
        return;
      }

      saveAuth(username, password);
      setStatus(
        loginStatusEl,
        "ok",
        "保存しました。この認証情報でAPIを呼び出します。"
      );
    });

    logoutBtn.addEventListener("click", () => {
      clearAuth();
      setStatus(loginStatusEl, "ok", "認証情報を削除しました");
    });
  }

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

  const pollToggle = el("pollToggle");
  pollToggle.addEventListener("change", () => {
    setPollingEnabled(pollToggle.checked);
    appendLog(`Auto refresh: ${pollToggle.checked ? "ON" : "OFF"}`);
  });

  // initial
  refreshState();
  setPollingEnabled(pollToggle.checked);
}

main();
