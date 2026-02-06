const express = require("express");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const session = require("express-session");

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.set("trust proxy", true);

app.use(
  session({
    secret: "attendance-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }
  })
);

/* ================= CONFIG ================= */

const OFFICE_IPS = ["49.43.111.148", "127.0.0.1", "::1"];
const DATA_FILE = "data/attendance.json";
const USERS_FILE = "data/users.json";

/* ================= HELPERS ================= */

function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress
  );
}

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

function diffMinutes(a, b) {
  return (a - b) / (1000 * 60);
}

function format12Hour(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
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

/* -------- ENTRY -------- */
app.post("/api/entry/:id", (req, res) => {
  const ip = getIP(req);
  if (!OFFICE_IPS.includes(ip))
    return res.status(403).json({ message: "Office network only" });

  const { entryTime } = req.body;
  const now = new Date();
  const selected = new Date(`${today()} ${entryTime}`);

  if (diffMinutes(now, selected) < 0 || diffMinutes(now, selected) > 30)
    return res.status(400).json({ message: "Invalid time" });

  const data = read(DATA_FILE);
  data[today()] ??= {};

  if (data[today()][req.params.id])
    return res.status(400).json({ message: "Already marked" });

  data[today()][req.params.id] = {
    entry: format12Hour(selected),
    exit: null,
    ip
  };

  write(DATA_FILE, data);
  res.json({ success: true });
});

/* -------- EXIT -------- */
app.post("/api/exit/:id", (req, res) => {
  const ip = getIP(req);
  if (!OFFICE_IPS.includes(ip))
    return res.status(403).json({ message: "Office network only" });

  const data = read(DATA_FILE);
  const r = data[today()]?.[req.params.id];
  if (!r || r.exit)
    return res.status(400).json({ message: "Invalid exit" });

  r.exit = format12Hour(new Date());
  write(DATA_FILE, data);
  res.json({ success: true });
});

/* -------- EXPORTS -------- */

app.get("/export/pdf-range", requireAdmin, (req, res) => {
  const { from, to } = req.query;
  ensure("pdf-format/pdf");

  const file = `pdf-format/pdf/report-${from}-to-${to}.pdf`;
  const doc = new PDFDocument({ margin: 40 });
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
        if (r) doc.text(`  ${d}: IN ${r.entry} | OUT ${r.exit || "-"}`);
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
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
