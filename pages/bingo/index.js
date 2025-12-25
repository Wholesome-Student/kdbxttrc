const SIZE = 5;

const app = document.getElementById("app");
if (!app) throw new Error("app not found");

// コンテナ
const board = document.createElement("table");
board.className = "bingo";
let selectedCell = null;

const userId = globalThis.localStorage.getItem("userId");
const res = await fetch(
  `/api/quiz/user-status?user_id=${encodeURIComponent(userId)}`
);

if (!res.ok) {
  app.appendChild(
    document.createTextNode(
      "ビンゴカードの取得に失敗しました、リロードしてください"
    )
  );
} else {
  const userStatus = await res.json();
  // セルを生成
  for (let row = 0; row < SIZE; row++) {
    const tr = document.createElement("tr");
    board.appendChild(tr);
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement("td");
      cell.classList.add("cell");
      const number = userStatus.bingo.seed[row * SIZE + col];
      cell.dataset.choiceId = number + 1;
      cell.textContent = String(userStatus.choices[number] ?? "？");

      // すでに空いているマスへの処理
      if (userStatus.bingo.punch.includes(number)) {
        cell.classList.add("punched");
      }
      tr.appendChild(cell);
    }
  }
}
app.appendChild(board);

const toggleSelected = (event) => {
  if (selectedCell !== null) {
    selectedCell.classList.remove("selected");
  }
  const cell = event.target;
  cell.classList.add("selected");
  selectedCell = cell;
};

// 長時間の setTimeout に依存すると、ブラウザがバックグラウンド時に
// タイマーをスロットリングしてしまい、復帰時にタイマーがまとめて発火
// して一斉にリクエストが飛ぶ問題がある。そこで long wait は短い間隔で
// 監視する方式に変更する。
async function waitUntil(triggeredAtMs) {
  while (!stopped) {
    const now = Date.now();
    const rem = triggeredAtMs - now;
    if (rem <= 0) return;
    // 最大で 1 秒単位で繰り返しチェックする（スロットリングの影響を受けにくい）
    await sleep(Math.min(1000, rem));
  }
}

// 以下 SSE 関連処理

let nextEndedAtMs = null;
let resultDisplayed = false;
let stopped = false; // ページ離脱時や停止制御用フラグ
const statusDiv = document.getElementById("status");
let quizEventSource = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handleQuizData(json) {
  if (json.status === "standby") {
    // クイズ開始前
    statusDiv.className = "standby";
    statusDiv.textContent = "次の問題が始まるまでお待ちください...";
  } else if (json.status === "active") {
    // クイズ出題中
    resultDisplayed = false;
    statusDiv.className = "active";
    const data = json.data;
    statusDiv.innerHTML = `第${data.round}問<br>${data.question.context}`;
    nextEndedAtMs = data.ended_at * 1000;
    // セルクリックイベントを設定
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
      cell.removeEventListener("click", toggleSelected);
      cell.addEventListener("click", toggleSelected);
    });

    // 回答締め切りまで待機し、その後回答を送信
    await waitUntil(nextEndedAtMs);

    if (stopped) return;

    try {
      const selectedCell = document.querySelector(".cell.selected");
      const resp = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: Number(userId),
          question_id: data.question.id,
          choice_id: selectedCell
            ? Number(selectedCell.dataset.choiceId)
            : null,
        }),
      });
      if (!resp.ok) console.error("Answer POST failed", resp.status);
    } catch (e) {
      console.error("回答の送信に失敗:", e);
    }
  } else if (json.status === "closed") {
    // 回答締め切り・集計中
    statusDiv.className = "closed";
    statusDiv.textContent =
      "回答が締め切られました。結果発表までお待ちください。";
    // セルのクリックイベントを解除
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
      cell.removeEventListener("click", toggleSelected);
    });
  } else if (json.status === "result") {
    // 結果発表中
    if (resultDisplayed) return;
    statusDiv.className = "result";
    const data = json.data;
    const contextList = [...data.correct_choice]
      .sort((a, b) => a.id - b.id)
      .map((obj) => obj.context);
    statusDiv.innerHTML = `第${data.round}問<br>${
      data.question.context
    }<br>正解: ${contextList.join(" ")}`;
    const selectedCell = document.querySelector(".cell.selected");
    if (
      selectedCell &&
      data.correct_choice.find(
        (obj) => obj.id === Number(selectedCell.dataset.choiceId)
      )
    ) {
      const ans = selectedCell.textContent;
      statusDiv.innerHTML += `<br>あなたの回答「${ans}」は正解です！`;
      selectedCell.classList.remove("selected");
      selectedCell.classList.add("punched");
    }
    resultDisplayed = true;
  } else if (json.status === "finished") {
    // ビンゴゲーム終了
    statusDiv.className = "finished";
    statusDiv.textContent = "ビンゴゲームは終了しました。お疲れ様でした！";
  } else {
    console.error("Unknown status:", json.status);
  }
}

function startQuizSse() {
  if (quizEventSource) return;
  quizEventSource = new EventSource("/api/quiz/stream");

  quizEventSource.onmessage = async (event) => {
    try {
      const json = JSON.parse(event.data);
      await handleQuizData(json);
    } catch (e) {
      console.error("SSE data parse error:", e);
    }
  };

  quizEventSource.onerror = (err) => {
    console.error("SSE error:", err);
  };
}

startQuizSse();

// ページ離脱時にSSEを止める
self.addEventListener("beforeunload", () => {
  stopped = true;
  if (quizEventSource) {
    quizEventSource.close();
    quizEventSource = null;
  }
});
