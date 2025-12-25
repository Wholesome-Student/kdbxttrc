const questionNumberElem = document.getElementById("questionNumber");
const questionContentElem = document.getElementById("questionContent");
const answersContentElem = document.getElementById("answersContent");
const timeElem = document.getElementById("time");
const timerRowElem = document.getElementById("timer-row");
const otherContentElem = document.getElementById("otherContent");
const answerAreaElem = document.getElementById("answerArea");
const questionAreaElem = document.getElementById("questionAreaMain");
const qrImageElem = document.getElementById("qrImage");
const errorArea = document.getElementById("errorArea");
let enterHandled = false;
let eventSource = null;
let countdownTimerId = null;

function updateViewFromData(data) {
  if (
    data.status == "standby" ||
    data.status == "closed" ||
    data.status == "finished"
  ) {
    questionNumberElem.textContent = "";
    questionContentElem.textContent = "";
    timerRowElem.style.display = "none";
    answerAreaElem.style.display = "none";
    if (data.status == "standby") {
      otherContentElem.textContent = "問題";
    } else if (data.status == "closed") {
      otherContentElem.textContent = "集計中";
    } else if (data.status == "finished") {
      otherContentElem.textContent = "終了";
    }
  } else {
    const data2 = data.data;
    questionNumberElem.textContent = data2.round + "問目";
    questionContentElem.textContent = data2.question.context;
    otherContentElem.textContent = "";

    if (data.status == "active") {
      // 前回までのカウントダウン interval をクリア
      if (countdownTimerId !== null) {
        clearInterval(countdownTimerId);
        countdownTimerId = null;
      }

      // サーバー側からは ended_at が「秒」で送られてくる前提
      const endedAtSec =
        typeof data2.ended_at === "number" ? data2.ended_at : 0;

      const updateCountdown = () => {
        const nowSec = Date.now() / 1000;
        const remainingSec = Math.max(0, Math.floor(endedAtSec - nowSec));
        timeElem.textContent = String(remainingSec).padStart(2, "0");

        // 0 になったらこれ以上マイナスに行かないように interval を止める
        if (remainingSec <= 0 && countdownTimerId !== null) {
          clearInterval(countdownTimerId);
          countdownTimerId = null;
        }
      };

      // 即時に1回更新してから、1秒ごとに更新
      updateCountdown();
      countdownTimerId = setInterval(updateCountdown, 1000);

      timerRowElem.style.display = "flex";
      answerAreaElem.style.display = "none";
    } else {
      // active 以外に遷移したらカウントダウンを止める
      if (countdownTimerId !== null) {
        clearInterval(countdownTimerId);
        countdownTimerId = null;
      }

      timeElem.textContent = "";
      timerRowElem.style.display = "none";
      answerAreaElem.style.display = "block";

      let answersListString = "";
      for (let i = 0; i < data2.correct_choice.length; i++) {
        answersListString += data2.correct_choice[i].context;
        if (i % 13 == 12) {
          answersListString += "\n";
        } else if (i != data2.correct_choice.length - 1) {
          answersListString += ", ";
        }
      }
      answersContentElem.textContent = answersListString;
    }
  }
}

function startSse() {
  if (eventSource) return;

  const url = "/api/quiz/stream";
  eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      errorArea.textContent = "";
      updateViewFromData(data);
    } catch (e) {
      console.error("SSE data parse error", e);
      errorArea.textContent = `データパースエラー: ${e}`;
    }
  };

  eventSource.onerror = (err) => {
    console.error("SSE error", err);
    errorArea.textContent = "SSE接続でエラーが発生しました";
    // 必要ならここで再接続ロジックを実装
  };
}

document.addEventListener("DOMContentLoaded", function () {
  document.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !enterHandled) {
      enterHandled = true;
      questionAreaElem.style.display = "block";
      answerAreaElem.style.display = "block";
      qrImageElem.style.display = "none";

      // SSE購読開始
      startSse();
    }
  });
});
