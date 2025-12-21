const questionNumberElem = document.getElementById("questionNumber");
const questionContentElem = document.getElementById("questionContent");
const answersContentElem = document.getElementById("answersContent");
const timeElem = document.getElementById("time");
const timerRowElem = document.getElementById("timer-row");
const otherContentElem = document.getElementById("otherContent");
const answerAreaElem = document.getElementById("answerArea");

async function fetchAndShowMockQuestion() {
  const errorArea = document.getElementById("errorArea");
  errorArea.textContent = "";

  const url = "/api/quiz/polling";
  const res = await fetch(url);
  if (!res.ok) {
    errorArea.textContent = `APIエラー: ${res.status}`;
    return;
  }

  try {
    const data = (await res.json());

    if(data.status == "standby" || data.status == "closed" || data.status == "finished") {
      questionNumberElem.textContent = "";
      questionContentElem.textContent = "";
      timerRowElem.style.display = "none";
      answerAreaElem.style.display = "none";
      if(data.status == "standby") {
          otherContentElem.textContent = "問題";
      } else if(data.status == "closed") {
          otherContentElem.textContent = "集計中";
      } else if(data.status == "finished") {
          otherContentElem.textContent = "終了";
      }
    } else {
      const data2 = data.data;
      questionNumberElem.textContent = data2.round + "問目";
      questionContentElem.textContent = data2.question.context;
      otherContentElem.textContent = "";

      if(data.status == "active") {
          timeElem.textContent = String(Math.max(0, Math.floor((data2.ended_at - Date.now()) / 1000))).padStart(2, '0');
          timerRowElem.style.display = "flex";
          answerAreaElem.style.display = "none";
      } else {
        timeElem.textContent = "";
        timerRowElem.style.display = "none";
        answerAreaElem.style.display = "block";

        let answersListString = "";
        for (let i = 0; i < data2.correct_choice.length; i++) {
          answersListString += data2.correct_choice[i].context;
          if(i % 13 == 12) {
            answersListString += "\n";
          }else if(i != data2.correct_choice.length - 1) {
            answersListString += ", ";
          }
        }
        answersContentElem.textContent = answersListString;
      }
    }
  } catch (e) {
    errorArea.textContent = `通信エラー: ${e}`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  fetchAndShowMockQuestion();
  setInterval(fetchAndShowMockQuestion, 1000);
});