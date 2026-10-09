const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const ADMIN_PASS = process.env.ADMIN_PASS || 'chetan'; // admin password yahan badal sakte ho
const DB = 'users.json';
let users = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : {};
const save = () => fs.writeFileSync(DB, JSON.stringify(users, null, 1));

const app = express();
app.use(express.json());
app.use(express.static('public'));

const tokens = {};
const rnd = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

app.post('/api/login', (req, res) => {
  const { id, pass } = req.body || {};
  if (String(id).trim().toLowerCase() === 'admin' && String(pass).trim().toLowerCase() === ADMIN_PASS.toLowerCase()) {
    const t = rnd(); tokens[t] = { role: 'admin' };
    return res.json({ token: t, role: 'admin' });
  }
  const u = Object.values(users).find(u => u.name === id && u.pass === pass);
  if (!u) return res.status(401).json({ error: 'Galat ID ya password' });
  const t = rnd(); tokens[t] = { role: 'user', number: u.number };
  res.json({ token: t, role: 'user', number: u.number });
});

const adminOnly = (req, res, next) => {
  const s = tokens[req.headers.authorization];
  if (s && s.role === 'admin') return next();
  res.sendStatus(403);
};

app.get('/api/users', adminOnly, (q, r) => r.json(Object.values(users)));

app.post('/api/users', adminOnly, (req, res) => {
  const { name, pass } = req.body;
  if (!name || !pass) return res.status(400).json({ error: 'Naam aur password chahiye' });
  if (Object.values(users).some(u => u.name === name))
    return res.status(400).json({ error: 'Ye naam pehle se hai' });
  if (Object.keys(users).length >= 900)
    return res.status(400).json({ error: '3-digit numbers khatam' });
  let n;
  do { n = String(100 + Math.floor(Math.random() * 900)); } while (users[n]);
  users[n] = { name, pass, number: n };
  save();
  res.json(users[n]);
});

app.delete('/api/users/:n', adminOnly, (req, res) => {
  delete users[req.params.n]; save(); res.sendStatus(200);
});

const server = http.createServer(app);
const io = new Server(server);
const online = {};

io.use((s, next) => {
  const t = tokens[s.handshake.auth.token];
  if (!t || t.role !== 'user') return next(new Error('auth'));
  s.number = t.number; next();
});

io.on('connection', s => {
  online[s.number] = s.id;
  s.on('call', ({ to, offer }) => {
    const id = online[to];
    if (!id) return s.emit('unavailable', to);
    io.to(id).emit('incoming', { from: s.number, offer });
  });
  s.on('answer', ({ to, answer }) => online[to] && io.to(online[to]).emit('answered', { answer }));
  s.on('ice', ({ to, candidate }) => online[to] && io.to(online[to]).emit('ice', { candidate }));
  s.on('hangup', ({ to }) => online[to] && io.to(online[to]).emit('hangup'));
  s.on('disconnect', () => { if (online[s.number] === s.id) delete online[s.number]; });
});

server.listen(process.env.PORT || 3000, () => console.log('Server chal raha hai'));
