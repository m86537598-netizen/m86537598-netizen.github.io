// server.js
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const APP_PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// === ADMIN HIDDEN CREDENTIALS (as requested) ===
const ADMIN_USER = "BUBBLDEDS";
const ADMIN_PASS = "ERG98UESG9";
const ADMIN_CODE = "8723";
// ==============================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(session({ secret: 'dwwiki-secret-please-change', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, 'public')));

// multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/\s+/g,'_');
    cb(null, safe);
  }
});
const upload = multer({ storage });

// === SQLite DB init ===
const dbFile = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'user', banned_until INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY, title TEXT UNIQUE, content TEXT, author INTEGER, created_at INTEGER, updated_at INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pending_pages (
    id INTEGER PRIMARY KEY, title TEXT UNIQUE, purpose TEXT, content TEXT, requester INTEGER, created_at INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY, page_id INTEGER, user_id INTEGER, content TEXT, created_at INTEGER
  )`);
});

// middleware: load user from session
app.use((req,res,next)=>{
  if(req.session.userId){
    db.get('SELECT id,username,role,banned_until FROM users WHERE id=?',[req.session.userId],(err,row)=>{
      req.user = row || null;
      next();
    });
  } else next();
});

// === API: Auth ===
app.post('/api/register', async (req,res)=>{
  const { username, email, password } = req.body;
  if(!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users(username,email,password) VALUES(?,?,?)', [username, email, hashed], function(err){
    if(err) return res.status(400).json({ error: 'Username or email taken' });
    req.session.userId = this.lastID;
    res.json({ ok: true, id: this.lastID, username });
  });
});

app.post('/api/login', async (req,res)=>{
  const { username, password, code } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'Missing' });

  // admin backdoor: if exact ADMIN_USER & ADMIN_PASS & ADMIN_CODE, create or assign admin
  if(username === ADMIN_USER && password === ADMIN_PASS && code === ADMIN_CODE){
    // create or update admin user if missing
    db.get('SELECT * FROM users WHERE username=?',[ADMIN_USER], (e,row)=>{
      if(row){
        db.run('UPDATE users SET role="admin" WHERE id=?',[row.id]);
        req.session.userId = row.id;
        return res.json({ ok:true, admin:true, username: ADMIN_USER });
      } else {
        bcrypt.hash(ADMIN_PASS, 10).then(hp=>{
          db.run('INSERT INTO users(username,email,password,role) VALUES(?,?,?,?)',
            [ADMIN_USER, 'admin@dwwiki.local', hp, 'admin'], function(err){
              req.session.userId = this.lastID;
              return res.json({ ok:true, admin:true, username: ADMIN_USER });
          });
        });
      }
    });
    return;
  }

  db.get('SELECT id,username,password,role FROM users WHERE username=?',[username], async (err,row)=>{
    if(err || !row) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, row.password);
    if(!ok) return res.status(400).json({ error: 'Invalid credentials' });
    req.session.userId = row.id;
    res.json({ ok:true, username: row.username, role: row.role });
  });
});

app.post('/api/logout',(req,res)=>{
  req.session.destroy(()=>res.json({ ok:true }));
});

// === API: Pages & Requests ===
app.get('/api/pages', (req,res)=>{
  db.all('SELECT id,title,created_at,updated_at FROM pages ORDER BY title',[],(e,rows)=>res.json(rows));
});
app.get('/api/page/:title', (req,res)=>{
  const t = req.params.title;
  db.get('SELECT p.*, u.username as author_name FROM pages p LEFT JOIN users u ON u.id=p.author WHERE p.title=?',[t],(e,row)=>{
    if(!row) return res.status(404).json({ error:'Not found' });
    res.json(row);
  });
});

// request creation — must be logged in and not banned
app.post('/api/request-page', (req,res)=>{
  if(!req.user) return res.status(403).json({ error: 'Login required' });
  const now = Date.now();
  if(req.user.banned_until && req.user.banned_until > now) return res.status(403).json({ error: 'Banned' });

  const { title, purpose, content } = req.body;
  if(!title || title.trim()==='') return res.status(400).json({ error: 'Missing title' });

  db.get('SELECT 1 FROM pages WHERE title=? UNION SELECT 1 FROM pending_pages WHERE title=?',[title,title],(err,row)=>{
    if(row) return res.status(400).json({ error: 'exists', message: 'Page already made! Please request another.' });
    db.run('INSERT INTO pending_pages(title,purpose,content,requester,created_at) VALUES(?,?,?,?,?)',
      [title,purpose,content, req.user.id, now], function(err){
        if(err) return res.status(500).json({ error: 'db' });
        res.json({ ok:true, pendingId: this.lastID });
    });
  });
});

app.get('/api/pending', (req,res)=>{
  if(!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  db.all('SELECT p.*, u.username as requester_name FROM pending_pages p LEFT JOIN users u ON u.id=p.requester ORDER BY p.created_at DESC',[],(e,rows)=>res.json(rows));
});

app.post('/api/approve', (req,res)=>{
  if(!req.user || req.user.role !== 'admin') return res.status(403).json({ error:'admin only' });
  const { pendingId } = req.body;
  db.get('SELECT * FROM pending_pages WHERE id=?',[pendingId], (err,row)=>{
    if(!row) return res.status(404).json({ error:'not found' });
    const now = Date.now();
    db.run('INSERT INTO pages(title,content,author,created_at,updated_at) VALUES(?,?,?,?,?)',
      [row.title, row.content, req.user.id, now, now], function(e){
        if(e) return res.status(500).json({ error:'db' });
        db.run('DELETE FROM pending_pages WHERE id=?',[pendingId]);
        res.json({ ok:true, pageId: this.lastID });
      });
  });
});

app.post('/api/reject', (req,res)=>{
  if(!req.user || req.user.role !== 'admin') return res.status(403).json({ error:'admin only' });
  const { pendingId } = req.body;
  db.run('DELETE FROM pending_pages WHERE id=?',[pendingId], function(err){
    res.json({ ok:true });
  });
});

// === Comments ===
app.get('/api/comments/:pageId', (req,res)=>{
  const pid = req.params.pageId;
  db.all(`SELECT c.*, u.username FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.page_id=? ORDER BY c.created_at ASC`, [pid], (e,rows)=>res.json(rows));
});

app.post('/api/comment', (req,res)=>{
  if(!req.user) return res.status(403).json({ error: 'Login required' });
  const now = Date.now();
  if(req.user.banned_until && req.user.banned_until > now) return res.status(403).json({ error: 'Banned' });

  const { pageId, content } = req.body;
  db.run('INSERT INTO comments(page_id,user_id,content,created_at) VALUES(?,?,?,?)',[pageId, req.user.id, content, now], function(err){
    if(err) return res.status(500).json({ error:'db' });
    res.json({ ok:true, id:this.lastID });
  });
});

// === Ban / Timeout users (admin) ===
app.post('/api/ban', (req,res)=>{
  if(!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  const { userId, until } = req.body; // until: epoch ms
  db.run('UPDATE users SET banned_until=? WHERE id=?',[until, userId], function(err){
    res.json({ ok:true });
  });
});

app.get('/api/users', (req,res)=>{
  if(!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  db.all('SELECT id,username,email,role,banned_until FROM users ORDER BY username',[],(e,rows)=>res.json(rows));
});

// === Upload endpoint ===
app.post('/api/upload', upload.single('file'), (req,res)=>{
  if(!req.user) return res.status(403).json({ error:'Login required' });
  const url = '/uploads/' + path.basename(req.file.path);
  res.json({ ok:true, url });
});

app.listen(APP_PORT, ()=>console.log(`DWWiki server running on ${APP_PORT}`));
