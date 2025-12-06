async function showResult(el, res) {
  try {
    const json = await res.json();
    el.textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    el.textContent = `Error parsing response: ${e}\nStatus: ${res.status}`;
  }
}

document.getElementById("getForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const name = new FormData(form).get("name");
  const res = await fetch(
    "/api/hello?name=" + encodeURIComponent(String(name))
  );
  await showResult(document.getElementById("getResult"), res);
});

document
  .getElementById("postJsonForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = new FormData(form).get("name");
    const res = await fetch("/api/hello", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await showResult(document.getElementById("postResult"), res);
  });

const dbBtn = document.getElementById("dbTestBtn");
if (dbBtn) {
  dbBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const res = await fetch("/api/dbtest");
    await showResult(document.getElementById("dbResult"), res);
  });
}
