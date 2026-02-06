const express = require("express");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const session = require("express-session");
const { google } = require("googleapis");

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.set("trust proxy", true);

app.use(
  session({
    secret: "attendance-secret-key",
    resave: false,
    saveUninitialized: false
  })
);

/* ================= GOOGLE AUTH ================= */

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

/* ================= HELPERS ================= */

function today() {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function nowIST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

function format12Hour(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

/* ================= PEOPLE ================= */

const people = [
  { id: 1, name: "Pratham Garg" },
  { id: 2, name: "Karandeep Singh" },
  { id: 3, name: "Suraj Kumar" },
  { id: 4, name: "Dupinder" },
  { id: 5, name: "Anuj" },
  { id: 6, name: "Sudhagar" },
  { id: 7, name: "Roshan" },
  { id: 8, name: "Devi Chand" }
];

/* ================= SHEET FUNCTIONS ================= */

async function getAllRows() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "A:E"
  });
  return res.data.values || [];
}

async function upsertRow(date, person, entry, exit) {
  const rows = await getAllRows();
  const idx = rows.findIndex(r => r[0] === date && r[1] == person.id);

  const values = [[date, person.id, person.name, entry || "", exit || ""]];

  if (idx > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `A${idx + 1}:E${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "A:E",
      valueInputOption: "RAW",
      requestBody: { values }
    });
  }
}

/* ================= API ================= */

app.get("/api/people", async (req, res) => {
  const date = req.query.date || today();
  const rows = await getAllRows();

  const attendance = {};
  rows.forEach(r => {
    if (r[0] === date) {
      attendance[r[1]] = { entry: r[3], exit: r[4] };
    }
  });

  res.json({
    people,
    attendance,
    canEdit: date === today(),
    isAdmin: !!req.session.isAdmin
  });
});

app.post("/api/entry/:id", async (req, res) => {
  const person = people.find(p => p.id == req.params.id);
  await upsertRow(today(), person, format12Hour(nowIST()), null);
  res.json({ success: true });
});

app.post("/api/exit/:id", async (req, res) => {
  const person = people.find(p => p.id == req.params.id);

  const rows = await getAllRows();
  const row = rows.find(r => r[0] === today() && r[1] == person.id);

  await upsertRow(today(), person, row?.[3], format12Hour(nowIST()));
  res.json({ success: true });
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
