import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'localdev';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new Database(path.join(__dirname, 'data', 'app.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

const uploadsDir = path.join(__dirname, 'uploads');
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 25 * 1024 * 1024 }
});

const otpStore = new Map();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, phone: user.phone },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function isLocalhost(req) {
  const ip = req.ip || '';
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return [ip, forwarded].some((value) => value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1');
}

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '..')));

app.post('/api/signup', async (req, res) => {
  const { email, password, phone } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const info = db.prepare('INSERT INTO users (email, phone, password_hash) VALUES (?, ?, ?)').run(email, phone || null, password_hash);
  const user = db.prepare('SELECT id, email, phone FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = signToken(user);
  return res.json({ token, user });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT id, email, phone, password_hash FROM users WHERE email = ?').get(email);
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user);
  return res.json({ token, user: { id: user.id, email: user.email, phone: user.phone } });
});

app.post('/api/request-otp', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Email or phone required' });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(identifier, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
  return res.json({ message: 'OTP generated (mock).', code });
});

app.post('/api/verify-otp', (req, res) => {
  const { identifier, code } = req.body;
  const record = otpStore.get(identifier);
  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'OTP expired' });
  }
  if (record.code !== code) {
    return res.status(400).json({ error: 'Invalid code' });
  }
  otpStore.delete(identifier);

  let user = db.prepare('SELECT id, email, phone FROM users WHERE email = ? OR phone = ?').get(identifier, identifier);
  if (!user) {
    const isEmail = identifier.includes('@');
    const info = db.prepare('INSERT INTO users (email, phone) VALUES (?, ?)').run(isEmail ? identifier : null, isEmail ? null : identifier);
    user = db.prepare('SELECT id, email, phone FROM users WHERE id = ?').get(info.lastInsertRowid);
  }
  const token = signToken(user);
  return res.json({ token, user });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, phone, created_at FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user });
});

app.get('/api/reports', authMiddleware, (req, res) => {
  const reports = db.prepare('SELECT id, title, filename, uploaded_at FROM reports WHERE user_id = ? ORDER BY uploaded_at DESC').all(req.user.id);
  const payload = reports.map((report) => ({
    ...report,
    url: `/uploads/${report.filename}`
  }));
  return res.json({ reports: payload });
});

app.post('/api/admin/upload', upload.single('report'), (req, res) => {
  if (!isLocalhost(req)) {
    return res.status(403).json({ error: 'Admin upload restricted to localhost' });
  }
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }
  const { userEmail, userPhone, title } = req.body;
  if (!req.file || !title || (!userEmail && !userPhone)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let user = db.prepare('SELECT id FROM users WHERE email = ? OR phone = ?').get(userEmail || '', userPhone || '');
  if (!user) {
    const info = db.prepare('INSERT INTO users (email, phone) VALUES (?, ?)').run(userEmail || null, userPhone || null);
    user = { id: info.lastInsertRowid };
  }

  db.prepare('INSERT INTO reports (user_id, title, filename) VALUES (?, ?, ?)').run(user.id, title, req.file.filename);
  return res.json({ message: 'Report uploaded' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
