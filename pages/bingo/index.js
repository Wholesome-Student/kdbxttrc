const SIZE = 5;

const app = document.getElementById("app");
if (!app) throw new Error("app not found");

// コンテナ
const board = document.createElement("table");
board.className = "bingo";

const res = await fetch("/api/quiz/user-status?user_id=1");

if (!res.ok) {
  app.appendChild(
    document.createTextNode(
      "ビンゴカードの取得に失敗しました、リロードしてください",
    ),
  );
} else {
  let selectedCell = null;
  const userStatus = await res.json();
  // セルを生成
  for (let row = 0; row < SIZE; row++) {
    const tr = document.createElement("tr");
    board.appendChild(tr);
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement("td");
      cell.className = "cell";
      const number = userStatus.bingo.seed[row * SIZE + col];
      // TODO: IDが返ってくるようにサーバー側が修正されたら、こっちも修正する
      cell.textContent = String(number);

      // すでに空いているマスへの処理
      if (userStatus.bingo.punch.includes(number)) {
        cell.classList.add("punched");
      } else {
        // クリックで選択 & もし他のマスを選択済みなら切り替える
        cell.addEventListener("click", () => {
          if (selectedCell !== null) {
            selectedCell.classList.remove("selected");
          }
          cell.classList.add("selected");
          selectedCell = cell;
        });
      }

      tr.appendChild(cell);
    }
  }
}

app.appendChild(board);
