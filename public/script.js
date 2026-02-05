<<<<<<< HEAD
const dateInput = document.getElementById("reportDate");
dateInput.value = new Date().toISOString().split("T")[0];

load();

dateInput.addEventListener("change", load);

function load() {
  fetch(`/api/people?date=${dateInput.value}`)
    .then(res => {
      if (res.status === 401) location.href = "/login.html";
      return res.json();
    })
    .then(data => {
      const tbody = document.getElementById("tableBody");
      tbody.innerHTML = "";

      data.people.forEach(p => {
        const r = data.attendance[p.id] || {};
        tbody.innerHTML += `
         <tr>
  <td>${p.name}</td>
  <td>${r.entry || "-"}</td>
  <td>${r.exit || "-"}</td>
  <td>
    ${
      data.canEdit
        ? r.entry
          ? r.exit
            ? "✔"
            : `<button onclick="markExit(${p.id})">Exit</button>`
          : `<input type="time" id="t${p.id}">
             <button onclick="markEntry(${p.id})">Entry</button>`
        : "-"
    }
  </td>
</tr>
`;
      });
    });
}

function markEntry(id) {
  fetch(`/api/entry/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryTime: document.getElementById("t" + id).value
    })
  }).then(load);
}

function markExit(id) {
  fetch(`/api/exit/${id}`, { method: "POST" }).then(load);
}

function downloadPDF() {
  location.href = `/export/pdf-range?from=${dateInput.value}&to=${dateInput.value}`;
}

function downloadExcel() {
  location.href = `/export/excel-range?from=${dateInput.value}&to=${dateInput.value}`;
}


const adminBar = document.getElementById("adminBar");
if (data.isAdmin) {
  adminBar.style.display = "block";
} else {
  adminBar.style.display = "none";
}
function logout() {
  fetch("/logout", { method: "POST" })
    .then(() => location.href = "/login.html");

const dateInput = document.getElementById("reportDate");
dateInput.value = new Date().toISOString().split("T")[0];

load();

dateInput.addEventListener("change", load);

function load() {
  fetch(`/api/people?date=${dateInput.value}`)
    .then(res => {
      if (res.status === 401) location.href = "/login.html";
      return res.json();
    })
    .then(data => {
      const tbody = document.getElementById("tableBody");
      tbody.innerHTML = "";

      data.people.forEach(p => {
        const r = data.attendance[p.id] || {};
        tbody.innerHTML += `
         <tr>
  <td>${p.name}</td>
  <td>${r.entry || "-"}</td>
  <td>${r.exit || "-"}</td>
  <td>
    ${
      data.canEdit
        ? r.entry
          ? r.exit
            ? "✔"
            : `<button onclick="markExit(${p.id})">Exit</button>`
          : `<input type="time" id="t${p.id}">
             <button onclick="markEntry(${p.id})">Entry</button>`
        : "-"
    }
  </td>
</tr>
`;
      });
    });
}

function markEntry(id) {
  fetch(`/api/entry/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryTime: document.getElementById("t" + id).value
    })
  }).then(load);
}

function markExit(id) {
  fetch(`/api/exit/${id}`, { method: "POST" }).then(load);
}

function downloadPDF() {
  location.href = `/export/pdf-range?from=${dateInput.value}&to=${dateInput.value}`;
}

function downloadExcel() {
  location.href = `/export/excel-range?from=${dateInput.value}&to=${dateInput.value}`;
}


const adminBar = document.getElementById("adminBar");
if (data.isAdmin) {
  adminBar.style.display = "block";
} else {
  adminBar.style.display = "none";
}
function logout() {
  fetch("/logout", { method: "POST" })
    .then(() => location.href = "/login.html");
>>>>>>> 6052f2d (Initial attendance system)
}