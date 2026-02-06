const express = require("express");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
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

/* ================= CONFIG ================= */

const OFFICE_IPS = ["127.0.0.1", "::1"]; // add office public IP later if needed

const DATA_FILE = "data/attendance.json";
const USERS_FILE = "data/users.json";

/* ================= HELPERS ================= */

function today() {
  return new Date().toISOString().split("T")[0];
}

function read(file) {
  if (!fs.existsSync(file)) return {};
  const c = fs.readFileSync(file, "utf8").trim();
  return c ? JSON.parse(c) : {};
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function ensure(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
function getMonthFolder(date) {
  const [y, m] = date.split("-");
  return `${y}-${m}`;
}
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ]
);


const sheets = google.sheets({ version: "v4", auth });
async function saveToSheet({ date, id, name, entry, exit }) {
  const sheetId = process.env.GOOGLE_SHEET_ID;

  // find existing row
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "A:E"
  });

  const rows = res.data.values || [];

  const rowIndex = rows.findIndex(
    r => r[0] === date && r[1] == id
  );

  if (rowIndex > 0) {
    // update row
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `A${rowIndex + 1}:E${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[date, id, name, entry || "", exit || ""]]
      }
    });
  } else {
    // add new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "A:E",
      valueInputOption: "RAW",
      requestBody: {
        values: [[date, id, name, entry || "", exit || ""]]
      }
    });
  }
}

async function updateDailyReports(date) {
  const data = read(DATA_FILE);
  const dayData = data[date] || {};

  const month = getMonthFolder(date);
  const day = date.split("-")[2];

  // Ensure folders exist
  ensure(`reports/excel/${month}`);
  ensure(`reports/pdf/${month}`);

  /* ===== EXCEL ===== */
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance");

  ws.addRow(["Name", "Entry", "Exit"]);

  people.forEach(p => {
    const r = dayData[p.id];
    ws.addRow([
      p.name,
      r?.entry || "-",
      r?.exit || "-"
    ]);
  });

  await wb.xlsx.writeFile(
    `reports/excel/${month}/${day}.xlsx`
  );

  /* ===== PDF ===== */
  const pdfPath = `reports/pdf/${month}/${day}.pdf`;
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(16).text(`Attendance Report - ${date}`, {
    align: "center"
  });
  doc.moveDown();

  people.forEach(p => {
    const r = dayData[p.id];
    doc.text(
      `${p.name} | IN: ${r?.entry || "-"} | OUT: ${r?.exit || "-"}`
    );
  });

  doc.end();
}

/* ================= AUTH ================= */

app.post("/login", (req, res) => {
  const users = read(USERS_FILE);
  const { username, password } = req.body;

  if (
    users.admin.username === username &&
    users.admin.password === password
  ) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }

  res.json({ success: false });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.sendStatus(401);
  next();
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
if (!process.env.GOOGLE_PRIVATE_KEY) {
  console.error("❌ GOOGLE_PRIVATE_KEY missing");
}

/* ================= API ================= */

app.get("/api/people", (req, res) => {
  const date = req.query.date || today();
  const data = read(DATA_FILE);

  res.json({
    people,
    attendance: data[date] || {},
    canEdit: date === today(),
    isAdmin: !!req.session.isAdmin
  });
});

app.post("/api/entry/:id", async (req, res) => {
  const person = people.find(p => p.id == req.params.id);
  const entryTime = format12Hour(new Date());

const data = read(DATA_FILE);
data[today()] ??= {};

data[today()][person.id] = {
  entry: entryTime,
  exit: null
};

write(DATA_FILE, data);

await saveToSheet({
  date: today(),
  id: person.id,
  name: person.name,
  entry: entryTime,
  exit: ""
});

await updateDailyReports(today());

  res.json({ success: true });
}); // ✅ CLOSE ENTRY ROUTE




app.post("/api/exit/:id", async (req, res) => {
  const person = people.find(p => p.id == req.params.id);
  const exitTime = format12Hour(new Date());

const data = read(DATA_FILE);
if (!data[today()]?.[person.id]) {
  return res.status(400).json({ message: "No entry found" });
}

data[today()][person.id].exit = exitTime;
write(DATA_FILE, data);

await saveToSheet({
  date: today(),
  id: person.id,
  name: person.name,
  entry: data[today()][person.id].entry,
  exit: exitTime
});

await updateDailyReports(today());

  res.json({ success: true });
}); // ✅ CLOSE ENTRY ROUTE




/* ================= EXPORT ================= */

app.get("/export/pdf-range", requireAdmin, (req, res) => {
  const { from, to } = req.query;
  ensure("pdf-format/pdf");

  const file = `pdf-format/pdf/report-${from}-to-${to}.pdf`;
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(file));

  doc.fontSize(18).text("Attendance Report", { align: "center" });
  doc.moveDown();

  const data = read(DATA_FILE);

  people.forEach(p => {
    doc.font("Helvetica-Bold").text(p.name);
    doc.font("Helvetica");

    Object.keys(data)
      .filter(d => d >= from && d <= to)
      .forEach(d => {
        const r = data[d][p.id];
        if (r) doc.text(`${d}: IN ${r.entry} | OUT ${r.exit || "-"}`);
      });

    doc.moveDown();
  });

  doc.end();
  setTimeout(() => res.download(file), 300);
});

app.get("/export/excel-range", requireAdmin, async (req, res) => {
  const { from, to } = req.query;
  ensure("excel-format/excel");

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance");

  ws.addRow(["Name", "Date", "Entry", "Exit"]);

  const data = read(DATA_FILE);

  people.forEach(p => {
    Object.keys(data)
      .filter(d => d >= from && d <= to)
      .forEach(d => {
        const r = data[d][p.id];
        if (r) ws.addRow([p.name, d, r.entry, r.exit || "-"]);
      });
  });

  const file = `excel-format/excel/report-${from}-to-${to}.xlsx`;
  await wb.xlsx.writeFile(file);
  res.download(file);
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
