const SIZE = 5;

const app = document.getElementById("app");
if (!app) throw new Error("app not found");

// 1〜75からランダムに25個選ぶ（簡易版）
function generateNumbers() {
  const nums = Array.from({ length: 75 }, (_, i) => i + 1);
  nums.sort(() => Math.random() - 0.5);
  return nums.slice(0, SIZE * SIZE);
}

const numbers = generateNumbers();

// コンテナ
const board = document.createElement("table");
board.className = "bingo";

// セルを生成
for (let row = 0; row < SIZE; row++) {
  const tr = document.createElement("tr");
  board.appendChild(tr);
  for (let col = 0; col < SIZE; col++) {
    const cell = document.createElement("td");
    cell.className = "cell";
    const number = numbers[row * SIZE + col];
    cell.textContent = String(number);

    // 真ん中を FREE にする
    if (row === Math.floor(SIZE / 2) && col === Math.floor(SIZE / 2)) {
      cell.textContent = "FREE";
      cell.classList.add("checked");
    }

    // クリックでON/OFF
    cell.addEventListener("click", () => {
      cell.classList.toggle("checked");
    });

    tr.appendChild(cell);
  }
}

app.appendChild(board);
