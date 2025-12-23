const SIZE = 5;

const app = document.getElementById("app");
if (!app) throw new Error("app not found");

// コンテナ
const board = document.createElement("table");
board.className = "bingo";
let selectedCell = null;

const userId = globalThis.localStorage.getItem("userId");
const res = await fetch(
  `/api/quiz/user-status?user_id=${encodeURIComponent(userId)}`,
);

if (!res.ok) {
  app.appendChild(
    document.createTextNode(
      "ビンゴカードの取得に失敗しました、リロードしてください",
    ),
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
      cell.textContent = String(
        userStatus.choices[number] ?? "？",
      );

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

function createTask(triggeredAtMs, callback) {
  const now = Date.now();
  const delay = triggeredAtMs - now;
  if (delay <= 0) {
    callback();
    return;
  }

  setTimeout(callback, delay);
}

// 以下ポーリング関連処理

let nextEndedAtMs = null;
let resultDisplayed = false;
const statusDiv = document.getElementById("status");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll() {
  while (true) {
    try {
      const res = await fetch("/api/quiz/polling");
      const json = await res.json();
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
        // 終了時刻になったら回答を送信するタスクをセット
        createTask(nextEndedAtMs, () => {
          try {
            const selectedCell = document.querySelector(".cell.selected");
            fetch("/api/quiz/answer", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                user_id: Number(userId),
                question_id: data.question.id,
                choice_id: selectedCell
                  ? Number(selectedCell.dataset.choiceId)
                  : null,
              }),
            });
          } catch (e) {
            console.error("回答の送信に失敗:", e);
          }
          poll(); // ポーリングを再開
        });
        break; // ポーリング停止
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
        if (resultDisplayed) {
          await sleep(1000);
          continue;
        }
        statusDiv.className = "result";
        const data = json.data;
        const contextList = [...data.correct_choice].sort((a, b) => a.id - b.id)
          .map((obj) => obj.context);
        statusDiv.innerHTML =
          `第${data.round}問<br>${data.question.context}<br>正解: ${
            contextList.join(" ")
          }`;
        const selectedCell = document.querySelector(".cell.selected");
        if (
          selectedCell &&
          data.correct_choice.find((obj) =>
            obj.id === Number(selectedCell.dataset.choiceId)
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
    } catch (e) {
      console.error("Polling error:", e);
    }
    await sleep(1000);
  }
}

poll();

// ページ離脱時にポーリングを止める
self.addEventListener("beforeunload", () => {
  stopped = true;
});
