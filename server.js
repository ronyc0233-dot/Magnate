const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const game = require('./game');
const { BOARD, GROUP_COLORS } = require('./board');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/board', (_req, res) => res.json({ board: BOARD, colors: GROUP_COLORS }));
app.get('/health', (_req, res) => res.send('ok'));

function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''); } while (rooms.has(c));
  return c;
}

function broadcast(room) {
  room.lastActivity = Date.now();
  io.to(room.code).emit('state', game.publicState(room));
}

function getRoom(code) {
  return rooms.get(String(code || '').toUpperCase().trim());
}

io.on('connection', (socket) => {
  let room = null; let player = null;

  const attach = (r, p) => {
    room = r; player = p;
    p.socketId = socket.id; p.connected = true;
    socket.join(r.code);
    socket.emit('joined', { code: r.code, token: p.token, id: p.id });
    broadcast(r);
  };

  socket.on('create', ({ name } = {}, cb = () => {}) => {
    const code = newCode();
    const r = game.createRoom(code);
    r.onChange = () => broadcast(r);
    rooms.set(code, r);
    attach(r, game.addPlayer(r, name));
    cb({ ok: true });
  });

  socket.on('join', ({ code, name } = {}, cb = () => {}) => {
    const r = getRoom(code);
    if (!r) return cb({ error: 'No existe una sala con ese código.' });
    if (r.started) return cb({ error: 'La partida ya comenzó.' });
    if (r.players.length >= game.MAX_PLAYERS) return cb({ error: `La sala está llena (máximo ${game.MAX_PLAYERS}).` });
    attach(r, game.addPlayer(r, name));
    cb({ ok: true });
  });

  socket.on('rejoin', ({ code, token } = {}, cb = () => {}) => {
    const r = getRoom(code);
    const p = r && r.players.find((x) => x.token === token);
    if (!p) return cb({ error: 'La sesión anterior ya no existe.' });
    attach(r, p);
    cb({ ok: true });
  });

  socket.on('start', (_d, cb = () => {}) => {
    if (!room) return cb({ error: 'Sin sala.' });
    const err = game.startGame(room, player.id);
    if (err) return cb({ error: err });
    broadcast(room); cb({ ok: true });
  });

  socket.on('setMoney', (amount, cb = () => {}) => {
    if (!room || !player) return cb({ error: 'Sin sala.' });
    const err = game.setStartMoney(room, player.id, amount);
    if (err) return cb({ error: err });
    broadcast(room); cb({ ok: true });
  });

  socket.on('action', (a = {}, cb = () => {}) => {
    if (!room || !player) return cb({ error: 'Sin sala.' });
    let err;
    try { err = game.handle(room, player.id, a); } catch (e) { console.error(e); err = 'Error interno.'; }
    if (err) return cb({ error: err });
    broadcast(room); cb({ ok: true });
  });

  socket.on('chat', (text) => {
    if (!room || !player) return;
    const t = String(text || '').trim().slice(0, 200);
    if (!t) return;
    room.chat.push({ from: player.id, name: player.name, color: player.color, text: t });
    if (room.chat.length > 100) room.chat.shift();
    broadcast(room);
  });

  socket.on('leaveLobby', () => {
    if (!room || !player || room.started) return;
    room.players = room.players.filter((p) => p.id !== player.id);
    socket.leave(room.code);
    if (!room.players.length) rooms.delete(room.code);
    else { if (room.hostId === player.id) room.hostId = room.players[0].id; broadcast(room); }
    room = null; player = null;
  });

  socket.on('disconnect', () => {
    if (!room || !player || player.socketId !== socket.id) return;
    player.connected = false;
    broadcast(room);
  });
});

// Limpia salas inactivas por más de 6 horas.
setInterval(() => {
  const limit = Date.now() - 6 * 3600 * 1000;
  for (const [code, r] of rooms) if ((r.lastActivity || 0) < limit) rooms.delete(code);
}, 30 * 60 * 1000);

const PORT = process.env.PORT || process.argv[2] || 3000;
server.listen(PORT, () => console.log(`Magnate escuchando en http://localhost:${PORT}`));
