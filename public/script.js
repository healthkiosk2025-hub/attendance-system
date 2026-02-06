const dateInput = document.getElementById("reportDate");
const tableBody = document.getElementById("tableBody");
const adminBar = document.getElementById("adminBar");

dateInput.value = new Date().toISOString().split("T")[0];

dateInput.addEventListener("change", load);
load();

function load() {
  fetch(`/api/people?date=${dateInput.value}`)
    .then(res => {
      if (res.status === 401) {
        location.href = "/login.html";
        return;
      }
      return res.json();
    })
    .then(data => {
      if (!data) return;

      tableBody.innerHTML = "";

      // admin bar visibility
      if (adminBar) {
        adminBar.style.display = data.isAdmin ? "block" : "none";
      }

      data.people.forEach(p => {
        const r = data.attendance[p.id] || {};

        let action = "-";
        if (data.canEdit) {
          if (!r.entry) {
            action = `
              <input type="time" id="t${p.id}">
              <button onclick="markEntry(${p.id})">Entry</button>
            `;
          } else if (!r.exit) {
            action = `<button onclick="markExit(${p.id})">Exit</button>`;
          } else {
            action = "✔";
          }
        }

        tableBody.innerHTML += `
          <tr>
            <td>${p.name}</td>
            <td>${r.entry || "-"}</td>
            <td>${r.exit || "-"}</td>
            <td>${action}</td>
          </tr>
        `;
      });
    });
}

function markEntry(id) {
  const timeInput = document.getElementById("t" + id);
  if (!timeInput || !timeInput.value) {
    alert("Please select entry time");
    return;
  }

  fetch(`/api/entry/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryTime: timeInput.value })
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

function logout() {
  fetch("/logout", { method: "POST" })
    .then(() => (location.href = "/login.html"));
}
