/* Cliente de Magnate */
const socket = io();
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CORNER_CLASS = { go: 'c-go', jail: 'c-jail', parking: 'c-parking', gotojail: 'c-gotojail' };

// Ilustraciones propias del tablero (SVG 48×48).
const svg = (body, cls = '') => `<svg class="art ${cls}" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
const ART = {
  bus: svg(`<rect x="3" y="11" width="42" height="24" rx="6" fill="#ffd43b" stroke="#a87300" stroke-width="1.6"/>
    <rect x="7" y="15" width="8" height="8" rx="2" fill="#a5d8ff"/><rect x="17" y="15" width="8" height="8" rx="2" fill="#a5d8ff"/><rect x="27" y="15" width="6" height="8" rx="2" fill="#a5d8ff"/>
    <rect x="35" y="15" width="7" height="15" rx="1.5" fill="#74c0fc" stroke="#a87300" stroke-width="1"/><rect x="3" y="27" width="32" height="3" fill="#f08c00"/>
    <circle cx="12" cy="36" r="5" fill="#343a40"/><circle cx="12" cy="36" r="2" fill="#ced4da"/><circle cx="35" cy="36" r="5" fill="#343a40"/><circle cx="35" cy="36" r="2" fill="#ced4da"/>`, 'a-drive'),
  train: svg(`<path d="M10 45 L17 37 M38 45 L31 37" stroke="#495057" stroke-width="2.2"/><path d="M12 42 H36 M14 40 H34" stroke="#868e96" stroke-width="1.4"/>
    <rect x="12" y="5" width="24" height="32" rx="8" fill="#e03131" stroke="#7d1616" stroke-width="1.6"/><rect x="16" y="10" width="16" height="10" rx="3" fill="#a5d8ff"/>
    <rect x="12" y="23" width="24" height="3" fill="#ffd43b"/><circle cx="18" cy="31" r="2.6" fill="#ffe066" class="a-blink"/><circle cx="30" cy="31" r="2.6" fill="#ffe066" class="a-blink"/>`),
  ship: svg(`<rect x="26" y="9" width="5" height="10" fill="#f03e3e"/><rect x="26" y="9" width="5" height="2.5" fill="#212529"/>
    <rect x="12" y="18" width="22" height="10" rx="2" fill="#fff" stroke="#1864ab" stroke-width="1.4"/>
    <circle cx="17" cy="23" r="1.7" fill="#4dabf7"/><circle cx="23" cy="23" r="1.7" fill="#4dabf7"/><circle cx="29" cy="23" r="1.7" fill="#4dabf7"/>
    <path d="M4 28 H44 L37 39 H11Z" fill="#1c7ed6" stroke="#0b4f8a" stroke-width="1.4"/>
    <path d="M1 43 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#74c0fc" stroke-width="2" class="a-wave"/>`, 'a-float'),
  plane: svg(`<path d="M24 4 c2 0 3 2 3 5 v10 l15 8 v4 l-15 -4 v8 l5 4 v3 l-8 -2 l-8 2 v-3 l5 -4 v-8 l-15 4 v-4 l15 -8 v-10 c0 -3 1 -5 3 -5z" fill="#91a7ff" stroke="#364fc7" stroke-width="1.4"/>
    <path d="M24 6 c1 0 1.6 1.4 1.6 3.4 v8" stroke="#dbe4ff" stroke-width="1.6" fill="none"/>`, 'a-fly'),
  bulb: svg(`<g class="a-rays" stroke="#fab005" stroke-width="2" stroke-linecap="round"><path d="M24 1 V4 M6 18 H9 M39 18 H42 M11 6 L13 8 M37 6 L35 8"/></g>
    <circle cx="24" cy="18" r="12" fill="#ffe066" stroke="#f59f00" stroke-width="1.6" class="a-glow"/><path d="M19 19 q2.5 -5 5 0 t5 0" stroke="#e8590c" stroke-width="1.6" fill="none"/>
    <rect x="18" y="29" width="12" height="4" rx="1" fill="#adb5bd"/><rect x="19" y="33" width="10" height="3" rx="1" fill="#868e96"/><rect x="21" y="36" width="6" height="3" rx="1.5" fill="#495057"/>`),
  water: svg(`<defs><linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#74c0fc"/><stop offset="1" stop-color="#1864ab"/></linearGradient></defs>
    <path d="M24 4 C24 4 11 21 11 30 a13 13 0 0 0 26 0 C37 21 24 4 24 4Z" fill="url(#gw)" stroke="#0b4f8a" stroke-width="1.4"/>
    <ellipse cx="18.5" cy="28" rx="3" ry="5.5" fill="#fff" opacity=".6" transform="rotate(20 18.5 28)"/>`, 'a-drip'),
  chance: svg(`<g class="a-wobble"><rect x="11" y="5" width="26" height="37" rx="5" fill="#ff922b" stroke="#c2410c" stroke-width="1.6"/>
    <rect x="14" y="8" width="20" height="31" rx="3" fill="none" stroke="#fff" stroke-width="1" opacity=".7"/>
    <text x="24" y="33" font-size="25" font-weight="700" text-anchor="middle" fill="#fff" font-family="Fredoka, sans-serif" stroke="#c2410c" stroke-width=".8">?</text></g>
    <path d="M41 8 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z M6 34 l.9 2.2 2.2.9 -2.2.9 -.9 2.2 -.9 -2.2 -2.2 -.9 2.2 -.9z" fill="#fcc419" class="a-twinkle"/>`),
  chest: svg(`<circle cx="15" cy="9" r="4" fill="#ffd43b" stroke="#e67700" class="a-bounce"/><circle cx="24" cy="6" r="4" fill="#ffd43b" stroke="#e67700" class="a-bounce d2"/><circle cx="33" cy="9" r="4" fill="#ffd43b" stroke="#e67700" class="a-bounce d3"/>
    <path d="M6 23 Q6 12 24 12 Q42 12 42 23Z" fill="#d9822b" stroke="#6b3a10" stroke-width="1.6"/>
    <rect x="6" y="23" width="36" height="19" rx="2" fill="#b5651d" stroke="#6b3a10" stroke-width="1.6"/>
    <rect x="6" y="22" width="36" height="3.5" fill="#ffd43b" stroke="#b07d00" stroke-width=".8"/><rect x="21" y="20" width="6" height="8" rx="1" fill="#ffd43b" stroke="#b07d00"/>
    <path d="M12 12.5 V42 M36 12.5 V42" stroke="#6b3a10" stroke-width="1.4"/>`),
  tax: svg(`<path d="M18 13 L30 13 L33 6 Q24 9 15 6Z" fill="#69db7c" stroke="#2b8a3e" stroke-width="1.4"/>
    <path d="M24 13 C9 18 7 41 14 43 L34 43 C41 41 39 18 24 13Z" fill="#8ce99a" stroke="#2b8a3e" stroke-width="1.6"/>
    <rect x="17" y="12" width="14" height="3" rx="1.5" fill="#c92a2a"/>
    <text x="24" y="37" font-size="17" font-weight="700" text-anchor="middle" fill="#2b8a3e" font-family="Fredoka, sans-serif">$</text>`, 'a-sway'),
  luxury: svg(`<polygon points="8,18 16,8 32,8 40,18 24,42" fill="#99e9f2" stroke="#0c8599" stroke-width="1.6"/>
    <path d="M8 18 H40 M16 8 L20 18 L24 42 L28 18 L32 8 M20 18 L24 8 L28 18" stroke="#0c8599" stroke-width="1" fill="none"/>
    <polygon points="16,8 20,18 8,18" fill="#e3fafc"/>
    <path d="M40 3 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1z" fill="#fff" stroke="#0c8599" stroke-width=".6" class="a-twinkle"/>`),
  go: svg(`<path d="M3 24 L19 8 V17 H45 V31 H19 V40Z" fill="#e03131" stroke="#7d1616" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M19 17 H45 V21 H19Z" fill="#ff8787"/>`, 'a-pulse'),
  jail: svg(`<rect x="6" y="6" width="36" height="36" rx="4" fill="#ffd8a8" stroke="#a0522d" stroke-width="2"/>
    <circle cx="24" cy="27" r="10" fill="#ffe066" stroke="#e67700"/><circle cx="20.5" cy="25" r="1.4" fill="#333"/><circle cx="27.5" cy="25" r="1.4" fill="#333"/>
    <path d="M20 32 q4 -3 8 0" stroke="#333" stroke-width="1.4" fill="none"/>
    <g fill="#495057"><rect x="11" y="6" width="3" height="36"/><rect x="19" y="6" width="3" height="36"/><rect x="27" y="6" width="3" height="36"/><rect x="35" y="6" width="3" height="36"/></g>
    <rect x="6" y="13" width="36" height="2.5" fill="#343a40"/>`),
  parking: svg(`<circle cx="39" cy="9" r="5" fill="#ffd43b" class="a-glow"/>
    <ellipse cx="24" cy="43" rx="20" ry="4" fill="#ffe8a3"/><path d="M24 22 V43" stroke="#795548" stroke-width="2"/>
    <path d="M4 22 Q24 -4 44 22Z" fill="#ff6b6b" stroke="#c92a2a" stroke-width="1.4"/>
    <path d="M17 22 Q24 2 31 22Z" fill="#fff"/><path d="M4 22 Q9 6 17 22 M44 22 Q39 6 31 22" fill="#fff" opacity=".9"/>
    <path d="M32 33 h8 v6 a4 4 0 0 1 -8 0z" fill="#fff" stroke="#795548"/><path d="M33 31 q1 -2 0 -3 M37 31 q1 -2 0 -3" stroke="#adb5bd" stroke-width="1" fill="none" class="a-steam"/>`),
  gotojail: svg(`<g class="a-rays2" stroke-width="2.4" stroke-linecap="round"><path d="M8 12 L12 16 M4 26 H9" stroke="#e03131"/><path d="M40 12 L36 16 M44 26 H39" stroke="#1c7ed6"/></g>
    <path d="M14 32 Q14 12 24 12 Q34 12 34 32Z" fill="#e03131" stroke="#7d1616" stroke-width="1.6" class="a-siren"/>
    <path d="M24 12 Q34 12 34 32 H24Z" fill="#1c7ed6" class="a-siren2"/>
    <ellipse cx="19.5" cy="20" rx="2.2" ry="4.5" fill="#fff" opacity=".6"/>
    <rect x="9" y="32" width="30" height="8" rx="2" fill="#495057" stroke="#212529" stroke-width="1.4"/>`),
};
const RAIL_ART = { 'Terminal de Buses': 'bus', 'Estación del Tren': 'train', 'Puerto Marítimo': 'ship', 'Aeropuerto': 'plane' };
const UTIL_ART = { 'Empresa de Luz': 'bulb', 'Acueducto': 'water' };
// Símbolo de cada ciudad, mostrado en una medalla con el color de su grupo.
const LANDMARK = {
  'Potosí': '⛏️', 'Oruro': '🎭', 'Cuenca': '⛪', 'Arequipa': '🌋', 'Cusco': '🦙', 'Valparaíso': '🎨', 'Rosario': '🌻',
  'Córdoba': '🎓', 'Medellín': '🌸', 'Cali': '💃', 'Guadalajara': '🌵', 'Montevideo': '🧉', 'Quito': '🧭', 'La Paz': '🚠',
  'Santiago': '🏔️', 'Lima': '🐟', 'Bogotá': '☕', 'Caracas': '🌴', 'Panamá': '🦜', 'Monterrey': '🏞️', 'Buenos Aires': '🌹',
  'Ciudad de México': '🌮',
};
function artFor(sq) {
  if (sq.type === 'rail') return ART[RAIL_ART[sq.name]];
  if (sq.type === 'util') return ART[UTIL_ART[sq.name]];
  if (sq.type === 'tax') return sq.amount === 100 ? ART.luxury : ART.tax;
  return ART[sq.type] || '';
}

let BOARD = [], COLORS = {};
let S = null;            // último estado del servidor
let me = loadMe();       // {code, token, id}
let modalKind = null, modalArg = null;
let chatSeen = 0, tab = 'log';

// Estado "visual": lo que se muestra mientras corren las animaciones.
let synced = false;              // ya recibimos el primer estado
const dispPos = {};              // posición mostrada de cada ficha
const dispMoney = {};            // dinero mostrado de cada jugador
const seenMove = {};             // último movimiento animado por jugador
let lastRollSeq = 0, lastCardSeq = 0, diceSpin = 0;
let queue = Promise.resolve(), busy = 0;

function loadMe() { try { return JSON.parse(sessionStorage.getItem('magnate') || 'null'); } catch { return null; } }
function saveMe(v) { me = v; try { v ? sessionStorage.setItem('magnate', JSON.stringify(v)) : sessionStorage.removeItem('magnate'); } catch {} }
try { $('#in-name').value = localStorage.getItem('magnate-name') || ''; } catch {}

function toast(msg, info) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (info ? ' info' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 3500);
}
const cb = (r) => { if (r && r.error) toast(r.error); };
const act = (type, extra = {}) => socket.emit('action', { type, ...extra }, cb);
const money = (n) => '$' + Number(n).toLocaleString('es');

// ---------- gráficos SVG ----------
function mix(hex, other, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(other.slice(1), 16);
  const ch = (x, s) => (x >> s) & 255;
  const m = (s) => Math.round(ch(a, s) * (1 - t) + ch(b, s) * t);
  return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
}
let gid = 0;
function pawnSVG(color) {
  const n = ++gid, lt = mix(color, '#ffffff', .55), dk = mix(color, '#000000', .35), dd = mix(color, '#000000', .6);
  return `<svg viewBox="0 0 40 56" aria-hidden="true"><defs>
    <radialGradient id="ph${n}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${lt}"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="${dk}"/></radialGradient>
    <linearGradient id="pb${n}" x1="0" x2="1"><stop offset="0" stop-color="${dk}"/><stop offset=".3" stop-color="${lt}"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${dd}"/></linearGradient></defs>
    <ellipse cx="20" cy="53" rx="15" ry="3" fill="#000" opacity=".28"/>
    <path d="M5 49.5 Q5 43.5 12 42.5 L28 42.5 Q35 43.5 35 49.5 Q35 53 20 53 Q5 53 5 49.5Z" fill="url(#pb${n})" stroke="${dd}" stroke-width=".7"/>
    <path d="M12.5 44 C14 36 16 30 16.5 25.5 L23.5 25.5 C24 30 26 36 27.5 44Z" fill="url(#pb${n})" stroke="${dd}" stroke-width=".7"/>
    <ellipse cx="20" cy="25.5" rx="8.8" ry="2.9" fill="url(#pb${n})" stroke="${dd}" stroke-width=".7"/>
    <circle cx="20" cy="14.5" r="9.8" fill="url(#ph${n})" stroke="${dd}" stroke-width=".7"/>
    <ellipse cx="16.3" cy="10.3" rx="3.3" ry="2.1" fill="#fff" opacity=".6" transform="rotate(-25 16.3 10.3)"/></svg>`;
}
const miniPawn = (p) => `<span class="mini-pawn">${pawnSVG(p.color)}</span>`;
const HOUSE_SVG = `<svg class="house" viewBox="0 0 20 20" aria-hidden="true">
  <polygon points="12,10 17,7.5 17,15.5 12,18" fill="#1f7a37"/><polygon points="3,10 12,10 12,18 3,18" fill="#38b25a"/>
  <polygon points="7.5,3.5 12.5,1.5 17,7.5 12,10" fill="#176b2d"/><polygon points="2.2,10.3 7.5,3.5 12.8,10.3" fill="#52d474"/>
  <rect x="6.3" y="13.3" width="2.4" height="4.7" fill="#0e4a1f"/><rect x="9.6" y="12" width="1.6" height="1.6" fill="#d9ffe3"/></svg>`;
const HOTEL_SVG = `<svg class="hotel" viewBox="0 0 34 22" aria-hidden="true">
  <polygon points="24,8 31,4.5 31,17.5 24,21" fill="#9e1c1c"/><polygon points="2,8 24,8 24,21 2,21" fill="#e03131"/>
  <polygon points="2,8 9,4.5 31,4.5 24,8" fill="#ff7272"/>
  ${[4.5, 9, 13.5, 18].map((x) => `<rect x="${x}" y="10.5" width="2.6" height="2.6" fill="#ffe7a3"/><rect x="${x}" y="15" width="2.6" height="2.6" fill="#ffe7a3"/>`).join('')}
  <rect x="10.5" y="1" width="5" height="3.5" rx=".6" fill="#ffd43b" stroke="#9e1c1c" stroke-width=".5"/><text x="13" y="3.9" font-size="3.2" font-weight="900" text-anchor="middle" fill="#9e1c1c">H</text></svg>`;

// ---------- dados 3D ----------
const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
for (const id of ['die0', 'die1']) {
  $('#' + id).innerHTML = [1, 2, 3, 4, 5, 6].map((f) => `<div class="face f${f}">${PIPS[f].map((k) =>
    `<span class="pip" style="grid-row:${Math.ceil(k / 3)};grid-column:${((k - 1) % 3) + 1}"></span>`).join('')}</div>`).join('');
}
function setDice(vals, animate) {
  if (animate) diceSpin++;
  vals.forEach((v, i) => {
    const d = $('#die' + i); if (!v) return;
    const [rx, ry] = ROT[v]; const k = diceSpin * 2 + i;
    if (!animate) d.style.transition = 'none';
    d.style.transform = `rotateX(${rx + 360 * k}deg) rotateY(${ry + 360 * (k + 1)}deg) rotateZ(${360 * diceSpin}deg)`;
    if (!animate) { void d.offsetWidth; d.style.transition = ''; }
  });
}
async function rollDice(vals) {
  document.querySelectorAll('.die-wrap').forEach((w, i) => {
    w.style.setProperty('--tx', (i ? 1 : -1) * (10 + Math.random() * 25) + 'px');
    w.classList.remove('toss'); void w.offsetWidth; w.classList.add('toss');
  });
  setDice(vals, true);
  await wait(1150);
}

// ---------- conexión ----------
fetch('/board').then((r) => r.json()).then((d) => { BOARD = d.board; COLORS = d.colors; buildBoard(); if (S) { render(); layoutTokens(); } });

socket.on('connect', () => {
  if (me) socket.emit('rejoin', me, (r) => { if (r.error) { saveMe(null); show('home'); } });
});
socket.on('joined', (d) => { saveMe(d); history.replaceState(null, '', '?sala=' + d.code); });
socket.on('state', onState);
socket.on('disconnect', () => toast('Conexión perdida. Reconectando…'));

const params = new URLSearchParams(location.search);
if (params.get('sala')) $('#in-code').value = params.get('sala').toUpperCase();

function getName() {
  const n = $('#in-name').value.trim();
  if (!n) { toast('Escribe tu nombre.'); $('#in-name').focus(); return null; }
  try { localStorage.setItem('magnate-name', n); } catch {}
  return n;
}
$('#btn-create').onclick = () => { const name = getName(); if (name) socket.emit('create', { name }, cb); };
$('#btn-join').onclick = () => {
  const name = getName(); const code = $('#in-code').value.trim().toUpperCase();
  if (!name) return; if (code.length !== 5) return toast('El código tiene 5 caracteres.');
  socket.emit('join', { code, name }, cb);
};
$('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });
$('#btn-start').onclick = () => socket.emit('start', null, cb);
$('#btn-leave').onclick = () => { socket.emit('leaveLobby'); resetLocal(); show('home'); };
$('#btn-copy').onclick = () => {
  const url = location.origin + location.pathname + '?sala=' + S.code;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Enlace copiado', true), () => prompt('Copia este enlace:', url));
};
for (let v = 1500; v <= 5000; v += 500) $('#sel-money').insertAdjacentHTML('beforeend', `<option value="${v}">${money(v)}</option>`);
$('#sel-money').onchange = (e) => socket.emit('setMoney', +e.target.value, cb);

function resetLocal() { saveMe(null); S = null; synced = false; history.replaceState(null, '', location.pathname); }
function show(name) { for (const s of ['home', 'lobby', 'game']) $('#screen-' + s).classList.toggle('hidden', s !== name); }

// ---------- cola de animaciones ----------
function enqueue(fn) {
  busy++;
  queue = queue.then(fn).catch((e) => console.error(e)).finally(() => { busy--; if (!busy) { syncAll(); render(); } });
}
function syncAll() {
  if (!S) return;
  S.players.forEach((p) => { dispPos[p.id] = p.pos; });
  layoutTokens();
}

function onState(st) {
  const first = !synced || !S || S.code !== st.code;
  S = st;
  if (first || !st.started) {
    synced = true;
    st.players.forEach((p) => { dispPos[p.id] = p.pos; dispMoney[p.id] = p.money; seenMove[p.id] = p.move ? p.move.seq : 0; });
    lastRollSeq = st.rollSeq; lastCardSeq = st.lastCard ? st.lastCard.seq : 0;
    if (st.dice[0]) setDice(st.dice, false);
    render(); layoutTokens();
    if (st.started) setTimeout(centerOnMe, 300);
    return;
  }
  // 1) dados
  if (st.rollSeq !== lastRollSeq) { lastRollSeq = st.rollSeq; const d = st.dice.slice(); enqueue(() => rollDice(d)); }
  // 2) movimientos
  for (const p of st.players) {
    if (p.move && p.move.seq !== seenMove[p.id]) {
      seenMove[p.id] = p.move.seq;
      const segs = p.move.segs.slice(); const id = p.id;
      if (segs.length) enqueue(() => animateMove(id, segs));
    }
    if (dispMoney[p.id] === undefined) dispMoney[p.id] = p.money;
  }
  // 3) tarjeta
  if (st.lastCard && st.lastCard.seq !== lastCardSeq) {
    lastCardSeq = st.lastCard.seq; const c = st.lastCard;
    enqueue(async () => { showCard(c); await wait(150); });
  }
  // 4) dinero (al final, cuando la ficha ya llegó)
  const snap = st.players.map((p) => [p.id, p.money]);
  enqueue(() => applyMoney(snap));
  render();
}

async function animateMove(id, segs) {
  const el = pawnEls[id]; if (!el) return;
  el.classList.add('turn');
  for (const s of segs) {
    dispPos[id] = s.from;
    if (s.mode === 'jump') {
      el.classList.add('fly'); dispPos[id] = s.to; layoutTokens();
      await wait(780); el.classList.remove('fly');
    } else {
      const dir = s.mode === 'back' ? -1 : 1;
      const n = dir > 0 ? (s.to - s.from + 40) % 40 : (s.from - s.to + 40) % 40;
      for (let k = 1; k <= n; k++) {
        dispPos[id] = (s.from + dir * k + 40) % 40;
        layoutTokens();
        if (k % 3 === 1 || k === n) centerOn(id); // con la lupa, la cámara sigue a la ficha
        el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
        await wait(n > 12 ? 150 : 210);
      }
      el.classList.remove('hop');
    }
    el.classList.remove('land'); void el.offsetWidth; el.classList.add('land');
    await wait(260);
  }
  el.classList.remove('turn');
}

function applyMoney(snap) {
  for (const [id, m] of snap) {
    const old = dispMoney[id]; dispMoney[id] = m;
    if (old === undefined || old === m) continue;
    const d = m - old;
    floatText($(`.pcard[data-id="${id}"]`), d);
    const pw = pawnEls[id];
    if (pw) {
      const r = pw.getBoundingClientRect(), b = $('#tokens').getBoundingClientRect();
      floatText($('#tokens'), d, r.left - b.left + r.width / 2, r.top - b.top);
    }
  }
  renderPlayers();
}
function floatText(host, d, x, y) {
  if (!host) return;
  const f = document.createElement('div');
  f.className = 'floater ' + (d > 0 ? 'plus' : 'minus');
  f.textContent = (d > 0 ? '+' : '−') + money(Math.abs(d));
  if (x !== undefined) { f.style.left = x + 'px'; f.style.top = y + 'px'; }
  host.appendChild(f);
  setTimeout(() => f.remove(), 2300);
  const mEl = host.querySelector && host.querySelector('.money');
  if (mEl) { mEl.classList.add(d > 0 ? 'up' : 'down'); setTimeout(() => mEl.classList.remove('up', 'down'), 1200); }
}

// ---------- tablero ----------
function cellOf(i) {
  if (i <= 10) return { r: 11, c: 11 - i, side: 'bottom' };
  if (i <= 20) return { r: 11 - (i - 10), c: 1, side: 'left' };
  if (i <= 30) return { r: 1, c: 1 + (i - 20), side: 'top' };
  return { r: 1 + (i - 30), c: 11, side: 'right' };
}
function buildBoard() {
  const b = $('#board');
  b.querySelectorAll('.tile').forEach((t) => t.remove());
  BOARD.forEach((sq, i) => {
    const { r, c, side } = cellOf(i);
    const t = document.createElement('div');
    const corner = i % 10 === 0;
    t.className = `tile s-${side}` + (corner ? ' corner ' + (CORNER_CLASS[sq.type] || '') : '');
    t.style.gridRow = r; t.style.gridColumn = c; t.dataset.i = i;
    let html = '';
    if (sq.type === 'prop') html += `<div class="band" style="--c:${COLORS[sq.group]}"></div><div class="builds"></div>`;
    if (corner) {
      const label = sq.type === 'go' ? '<div class="go-pay">+$200</div>' : '';
      html += `<div class="corner-art">${artFor(sq)}</div><div class="name">${esc(sq.name)}</div>${label}`;
    } else {
      html += `<div class="name">${esc(sq.name)}</div>`;
      html += sq.type === 'prop'
        ? `<div class="medal" style="--c:${COLORS[sq.group]}"><span>${LANDMARK[sq.name] || '🏙️'}</span></div>`
        : `<div class="tile-art">${artFor(sq)}</div>`;
      if (sq.price) html += `<div class="price">$${sq.price}</div>`;
      else if (sq.amount) html += `<div class="price">$${sq.amount}</div>`;
    }
    html += `<div class="owner hidden"></div>`;
    t.innerHTML = html;
    t.onclick = () => { if (BOARD[i].price) openModal('prop', i); };
    b.insertBefore(t, $('#tokens'));
  });
  new ResizeObserver(() => layoutTokens()).observe(b);
  $('#art-chance').innerHTML = ART.chance;
  $('#art-chest').innerHTML = ART.chest;
  $('#skyline').innerHTML = skylineSVG();
}

// Silueta de ciudad para el centro del tablero (siempre la misma).
function skylineSVG() {
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let x = 0, back = '', front = '', lights = '';
  while (x < 400) {
    const w = 14 + rnd() * 22, h = 30 + rnd() * 70;
    back += `<rect x="${x}" y="${120 - h - 12}" width="${w}" height="${h + 12}" />`;
    x += w * .7;
  }
  x = 0;
  while (x < 400) {
    const w = 16 + rnd() * 26, h = 18 + rnd() * 55;
    front += `<rect x="${x}" y="${120 - h}" width="${w}" height="${h}" rx="1.5"/>`;
    if (rnd() > .55) front += `<polygon points="${x},${120 - h} ${x + w / 2},${120 - h - 10} ${x + w},${120 - h}"/>`;
    for (let yy = 120 - h + 6; yy < 112; yy += 9) for (let xx = x + 4; xx < x + w - 5; xx += 7)
      if (rnd() > .55) lights += `<rect x="${xx}" y="${yy}" width="3" height="4" class="${rnd() > .7 ? 'win tw' : 'win'}"/>`;
    x += w + 2;
  }
  return `<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <g class="sky-back">${back}</g><g class="sky-front">${front}</g><g class="sky-lights">${lights}</g></svg>`;
}

// Lupa para el teléfono: agranda el tablero y permite moverlo con el dedo.
$('#btn-zoom').onclick = () => {
  const wrap = $('#board-wrap'); const on = !wrap.classList.contains('zoomed');
  wrap.classList.toggle('zoomed', on);
  $('#btn-zoom').textContent = on ? '↩️ Ver completo' : '🔍 Acercar';
  try { localStorage.setItem('magnate-zoom', on ? '1' : ''); } catch {}
  placeUI();
  requestAnimationFrame(() => { layoutTokens(); if (on) centerOnMe(); });
};
try { if (localStorage.getItem('magnate-zoom')) { $('#board-wrap').classList.add('zoomed'); $('#btn-zoom').textContent = '↩️ Ver completo'; } } catch {}
// Con la lupa en el teléfono, los dados y botones pasan debajo del tablero para que siempre se vean.
function placeUI() {
  const docked = $('#board-wrap').classList.contains('zoomed') && innerWidth <= 900;
  const ui = $('.center-ui'); const target = docked ? $('#dock') : $('.center');
  if (ui.parentElement !== target) target.appendChild(ui);
  $('#dock').classList.toggle('on', docked);
}
placeUI();
addEventListener('resize', placeUI);
function centerOnMe() { if (me) centerOn(me.id); }
function centerOn(id) {
  const wrap = $('#board-wrap'); if (!wrap.classList.contains('zoomed')) return;
  const el = pawnEls[id]; if (!el) return;
  const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  wrap.scrollBy({ left: r.left - w.left - w.width / 2, top: r.top - w.top - w.height / 2, behavior: 'smooth' });
}

const pawnEls = {};
function layoutTokens() {
  if (!S || !BOARD.length || !S.started) return;
  const layer = $('#tokens');
  const alive = S.players.filter((p) => !p.bankrupt);
  for (const id of Object.keys(pawnEls)) if (!alive.some((p) => p.id === id)) { pawnEls[id].remove(); delete pawnEls[id]; }
  const groups = {};
  for (const p of alive) {
    if (!pawnEls[p.id]) {
      const el = document.createElement('div');
      el.className = 'pawn' + (p.id === me.id ? ' me' : '');
      el.innerHTML = `<div class="pi">${pawnSVG(p.color)}</div>`;
      el.title = p.name; el.dataset.fresh = '1';
      layer.appendChild(el); pawnEls[p.id] = el;
    }
    const pos = dispPos[p.id] ?? p.pos;
    (groups[pos] = groups[pos] || []).push(p.id);
  }
  for (const [pos, ids] of Object.entries(groups)) {
    const tile = $(`.tile[data-i="${pos}"]`); if (!tile) continue;
    const cx = tile.offsetLeft + tile.offsetWidth / 2, cy = tile.offsetTop + tile.offsetHeight / 2;
    const n = ids.length, cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols);
    const sc = n > 4 ? .72 : n > 2 ? .86 : 1;
    ids.forEach((id, k) => {
      const el = pawnEls[id]; const w = el.offsetWidth, h = el.offsetHeight;
      const col = k % cols, row = Math.floor(k / cols);
      const dx = (col - (cols - 1) / 2) * w * .7 * sc, dy = (row - (rows - 1) / 2) * h * .42 * sc;
      // Una ficha recién creada aparece directo en su casilla (sin deslizarse desde la esquina).
      if (el.dataset.fresh) el.style.transition = 'none';
      el.style.transform = `translate(${cx - w / 2 + dx}px, ${cy - h * .45 + dy}px) scale(${sc})`;
      el.style.zIndex = 10 + row;
      if (el.dataset.fresh) { void el.offsetWidth; el.style.transition = ''; delete el.dataset.fresh; }
    });
  }
}

const player = (id) => S.players.find((p) => p.id === id);
const mine = () => S && me && player(me.id);
const isMyTurn = () => S && S.players[S.turn] && me && S.players[S.turn].id === me.id;

// ---------- render ----------
function render() {
  if (!S) return;
  if (!S.started) return renderLobby();
  show('game');
  $('#game-code').textContent = S.code;
  if (!BOARD.length) return;
  renderBoard(); renderCenter(); renderPlayers(); renderTrades(); renderFeeds();
  if (modalKind && modalKind !== 'card' && modalKind !== 'trade') openModal(modalKind, modalArg, true);
  if (!busy) layoutTokens();
}

function renderLobby() {
  show('lobby');
  $('#lobby-code').textContent = S.code;
  $('#lobby-players').innerHTML = S.players.map((p) => `<li>${miniPawn(p)} <b>${esc(p.name)}</b>${p.id === S.hostId ? ' <span class="tagx">anfitrión</span>' : ''}${p.id === me.id ? ' <span class="tagx">tú</span>' : ''}${p.connected ? '' : ' <span class="tagx off">desconectado</span>'}</li>`).join('');
  const host = S.hostId === me.id;
  $('#sel-money').classList.toggle('hidden', !host);
  $('#lbl-money').classList.toggle('hidden', host);
  $('#sel-money').value = S.startMoney; $('#lbl-money').textContent = money(S.startMoney);
  $('#btn-start').classList.toggle('hidden', !host);
  $('#btn-start').disabled = S.players.length < 2;
  const max = S.maxPlayers || 8;
  $('#lobby-hint').textContent = S.players.length < 2 ? `Comparte el código o el enlace. Se necesitan al menos 2 jugadores (máximo ${max}).`
    : host ? `${S.players.length} de ${max} jugadores. Elige el dinero inicial e inicia cuando quieras.` : 'Esperando a que el anfitrión inicie la partida…';
}

function renderBoard() {
  document.querySelectorAll('.tile').forEach((t) => {
    const i = +t.dataset.i; const st = S.props[i];
    if (!st) return;
    const ow = t.querySelector('.owner');
    const o = st.owner && player(st.owner);
    ow.classList.toggle('hidden', !o);
    if (o) ow.style.setProperty('--oc', o.color);
    t.classList.toggle('mortgaged', st.mortgaged);
    const bd = t.querySelector('.builds');
    if (bd && bd.dataset.h !== String(st.houses)) {
      bd.dataset.h = st.houses;
      bd.innerHTML = st.houses === 5 ? HOTEL_SVG : HOUSE_SVG.repeat(st.houses);
    }
  });
}

function renderCenter() {
  const cp = S.players[S.turn]; const p = mine();
  const A = $('#actions');
  A.classList.toggle('wait', busy > 0);
  if (S.over) {
    const w = player(S.winner);
    $('#turn-info').textContent = '';
    A.innerHTML = `<div class="winner">🏆 ¡${esc(w.name)} gana!</div><button class="primary" id="b-new">Nueva partida</button>`;
    $('#b-new').onclick = () => { resetLocal(); show('home'); };
    return;
  }
  $('#turn-info').innerHTML = isMyTurn() ? '⭐ ¡Es tu turno!' : `Turno de <span style="color:${mix(cp.color, '#000000', .2)}">${esc(cp.name)}</span>`;
  let h = '';
  const sq = BOARD[cp.pos];

  if (S.phase === 'auction' && S.auction) {
    const a = S.auction; const as = BOARD[a.pos]; const bidder = a.bidder && player(a.bidder);
    const left = Math.max(0, Math.ceil((a.endsAt - S.now) / 1000));
    const out = !p || p.bankrupt || a.passed.includes(p.id);
    h += `<div class="auction-box"><div>🔨 Subasta: <b>${esc(as.name)}</b> (precio $${as.price})</div>
      <div class="big">${money(a.high)}</div><div>${bidder ? 'Oferta de ' + esc(bidder.name) : 'Sin ofertas'} · <span id="auc-left" data-end="${Date.now() + left * 1000}">${left}s</span></div>
      ${out ? '<div class="muted">Te retiraste de la subasta.</div>' : `<div class="btns">
        <button data-bid="${a.high + 10}">+10</button><button data-bid="${a.high + 50}">+50</button><button data-bid="${a.high + 100}">+100</button>
        <input id="bid-in" type="number" min="${a.high + 1}" placeholder="$"><button class="primary" id="bid-go">Ofertar</button>
        ${a.bidder !== p.id ? '<button class="ghost" id="bid-pass">Retirarme</button>' : ''}</div>`}</div>`;
  } else if (S.phase === 'debt') {
    const d = S.debts[0]; const dp = player(d.debtor);
    if (d.debtor === me.id) {
      h += `<div class="info">Debes <b>${money(d.amount)}</b> (${esc(d.reason)}) a ${d.creditor ? esc(player(d.creditor).name) : 'el banco'}. Tienes ${money(p.money)}.<br>Vende construcciones o hipoteca desde “Mis propiedades”.</div>
        <div class="btns"><button class="primary" id="b-paydebt" ${p.money < d.amount ? 'disabled' : ''}>Pagar deuda</button><button id="b-props2">Mis propiedades</button><button class="danger" id="b-bk">Declararme en bancarrota</button></div>`;
    } else h += `<div class="info">Esperando a que ${esc(dp.name)} pague ${money(d.amount)}…</div>`;
  } else if (isMyTurn()) {
    if (S.phase === 'roll') {
      if (p.inJail) {
        h += `<div class="info">Estás en la cárcel (intento ${p.jailTurns + 1} de 3).</div><div class="btns">
          <button class="primary" id="b-roll">🎲 Tirar por dobles</button>
          <button id="b-payjail" ${p.money < 50 ? 'disabled' : ''}>Pagar $50</button>
          ${p.jailCards.length ? '<button id="b-card">Usar tarjeta</button>' : ''}</div>`;
      } else h += `<div class="btns"><button class="primary" id="b-roll">🎲 Tirar dados</button></div>`;
    } else if (S.phase === 'buy') {
      h += `<div class="info">¿Comprar <b>${esc(sq.name)}</b> por ${money(sq.price)}? Tienes ${money(p.money)}.</div><div class="btns">
        <button class="ok" id="b-buy" ${p.money < sq.price ? 'disabled' : ''}>Comprar</button>
        <button id="b-see">Ver tarjeta</button><button class="ghost" id="b-decline">Subastar</button></div>`;
    } else if (S.phase === 'end') {
      h += `<div class="btns"><button class="primary" id="b-end">Terminar turno</button></div><div class="muted">Puedes construir o intercambiar antes de terminar.</div>`;
    }
  } else {
    const verb = { roll: 'tirar los dados', buy: `decidir si compra ${sq.name}`, end: 'terminar su turno' }[S.phase] || 'jugar';
    h += `<div class="info muted">Esperando a que ${esc(cp.name)} termine de ${esc(verb)}…</div>`;
    if (!cp.connected && S.hostId === me.id) h += `<button class="danger small" id="b-kick">Retirar a ${esc(cp.name)} (desconectado)</button>`;
  }
  A.innerHTML = h;
  const on = (id, fn) => { const el = A.querySelector(id); if (el) el.onclick = fn; };
  on('#b-roll', () => act('roll'));
  on('#b-payjail', () => act('payJail'));
  on('#b-card', () => act('useJailCard'));
  on('#b-buy', () => act('buy'));
  on('#b-decline', () => act('decline'));
  on('#b-see', () => openModal('prop', cp.pos));
  on('#b-end', () => act('endTurn'));
  on('#b-paydebt', () => act('payDebt'));
  on('#b-props2', () => openModal('myprops'));
  on('#b-bk', () => { if (confirm('¿Seguro? Perderás todo y quedarás fuera de la partida.')) act('bankrupt'); });
  on('#b-kick', () => act('kick', { target: cp.id }));
  on('#bid-go', () => { const v = +$('#bid-in').value; if (v) act('bid', { amount: v }); });
  on('#bid-pass', () => act('passAuction'));
  A.querySelectorAll('[data-bid]').forEach((b) => (b.onclick = () => act('bid', { amount: +b.dataset.bid })));
}
setInterval(() => {
  const el = $('#auc-left'); if (el) el.textContent = Math.max(0, Math.ceil((+el.dataset.end - Date.now()) / 1000)) + 's';
}, 250);

function renderPlayers() {
  if (!S || !S.started) return;
  $('#players').innerHTML = S.players.map((p, idx) => {
    const owned = Object.entries(S.props).filter(([, st]) => st.owner === p.id).map(([i, st]) => ({ i: +i, st }));
    const chips = owned.map(({ i, st }) => `<span class="chip${st.mortgaged ? ' m' : ''}" style="--c:${chipColor(i)}" title="${esc(BOARD[i].name)}"></span>`).join('');
    const tags = [p.id === me.id && 'tú', p.inJail && '🚔 cárcel', p.jailCards.length && `🔓×${p.jailCards.length}`].filter(Boolean)
      .map((t) => `<span class="tagx">${t}</span>`).join(' ') + (p.connected ? '' : ' <span class="tagx off">desconectado</span>');
    const m = dispMoney[p.id] ?? p.money;
    return `<div class="pcard${idx === S.turn && !S.over ? ' turn' : ''}${p.bankrupt ? ' bankrupt' : ''}" data-id="${p.id}" style="--c:${p.color}">
      ${miniPawn(p)}
      <div class="top"><div class="nm"><span>${esc(p.name)}</span></div><div class="money">${p.bankrupt ? 'quiebra' : money(m)}</div></div>
      <div>${tags}</div><div class="chips">${chips}</div></div>`;
  }).join('');
}
function chipColor(i) { const sq = BOARD[i]; return sq.type === 'prop' ? COLORS[sq.group] : sq.type === 'rail' ? '#555555' : '#7a9aa8'; }

function renderTrades() {
  const mineT = S.trades.filter((t) => t.to === me.id || t.from === me.id);
  const pl = (arr) => arr.map((i) => esc(BOARD[i].name)).join(', ');
  $('#trades').innerHTML = mineT.map((t) => {
    const f = player(t.from), to = player(t.to); const incoming = t.to === me.id;
    const give = [t.give.length && pl(t.give), t.giveMoney && money(t.giveMoney), t.giveCards && `${t.giveCards} tarjeta(s) de cárcel`].filter(Boolean).join(' + ') || 'nada';
    const get = [t.get.length && pl(t.get), t.getMoney && money(t.getMoney)].filter(Boolean).join(' + ') || 'nada';
    return `<div class="trade-card"><b>🤝 ${incoming ? esc(f.name) + ' te propone' : 'Propuesta a ' + esc(to.name)}</b>
      <div>${incoming ? 'Recibes' : 'Das'}: ${give}</div><div>${incoming ? 'Entregas' : 'Pides'}: ${get}</div>
      <div class="btns">${incoming ? `<button class="ok small" data-acc="${t.id}">Aceptar</button><button class="small" data-rej="${t.id}">Rechazar</button>` : `<button class="small" data-rej="${t.id}">Cancelar</button>`}</div></div>`;
  }).join('');
  $('#trades').querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => act('respondTrade', { id: b.dataset.acc, accept: true })));
  $('#trades').querySelectorAll('[data-rej]').forEach((b) => (b.onclick = () => act('respondTrade', { id: b.dataset.rej, accept: false })));
}

function renderFeeds() {
  const L = $('#tab-log');
  const atBottom = L.scrollHeight - L.scrollTop - L.clientHeight < 40;
  L.innerHTML = S.log.map((l) => `<div>${esc(l)}</div>`).join('');
  if (atBottom || !renderFeeds.done) L.scrollTop = L.scrollHeight;
  const C = $('#tab-chat');
  $('#chat-list').innerHTML = S.chat.map((m) => `<div><b style="color:${m.color}">${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('') || '<div class="muted">Sin mensajes.</div>';
  C.scrollTop = C.scrollHeight;
  if (tab === 'chat') chatSeen = S.chat.length;
  const unread = S.chat.length - chatSeen;
  $('#chat-badge').textContent = unread; $('#chat-badge').classList.toggle('hidden', unread <= 0);
  renderFeeds.done = true;
}
document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  $('#tab-log').classList.toggle('hidden', tab !== 'log');
  $('#tab-chat').classList.toggle('hidden', tab !== 'chat');
  $('#chat-form').classList.toggle('hidden', tab !== 'chat');
  if (tab === 'chat') { chatSeen = S ? S.chat.length : 0; renderFeeds(); $('#chat-in').focus(); }
}));
$('#chat-form').onsubmit = (e) => { e.preventDefault(); const v = $('#chat-in').value.trim(); if (v) socket.emit('chat', v); $('#chat-in').value = ''; };
$('#btn-myprops').onclick = () => openModal('myprops');
$('#btn-trade').onclick = () => openModal('trade');

// ---------- ventanas ----------
$('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
function closeModal() { modalKind = null; modalArg = null; $('#modal').classList.add('hidden'); }

function showCard(c) {
  if (modalKind === 'trade') return; // no interrumpir un intercambio a medio escribir
  openModal('card', c);
}

function openModal(kind, arg, refresh) {
  const box = $('#modal-box');
  modalKind = kind; modalArg = arg;
  if (kind === 'prop') box.innerHTML = deedHTML(arg) + propButtons(arg) + '<button class="ghost" data-close>Cerrar</button>';
  else if (kind === 'card') box.innerHTML = cardHTML(arg);
  else if (kind === 'myprops') box.innerHTML = myPropsHTML();
  else if (kind === 'trade') { if (!refresh) box.innerHTML = tradeHTML(); }
  $('#modal').classList.remove('hidden');
  box.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal));
  box.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act, { pos: +b.dataset.pos })));
  box.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openModal('prop', +b.dataset.open)));
  if (kind === 'trade' && !refresh) wireTrade();
}

function cardHTML(c) {
  const who = player(c.player); const mineCard = c.player === me.id;
  const deckColor = c.deck === 'chance' ? '#f76707' : '#1c7ed6';
  const effects = (c.effects || []).map((e) => {
    const p = player(e.id); const plus = e.delta > 0;
    return `<div class="eff"><span>${miniPawn(p)} ${e.id === me.id ? '<b>Tú</b>' : esc(p.name)}</span><span class="amt ${plus ? 'plus' : 'minus'}">${plus ? '+' : '−'}${money(Math.abs(e.delta))}</span></div>`;
  }).join('') + (c.debts || []).map((d) => `<div class="eff"><span>${esc(player(d.id).name)}</span><span class="amt minus">debe ${money(d.amount)}</span></div>`).join('');
  return `<div class="card-pop">
    <div class="kind" style="color:${deckColor}">${c.deck === 'chance' ? '❓ SORPRESA' : '💰 FONDO COMÚN'}</div>
    <div class="who${mineCard ? ' mine' : ''}">${miniPawn(who)} ${mineCard ? '¡Tu tarjeta!' : esc(who.name) + ' sacó esta tarjeta'}</div>
    <div class="paper" style="--deck:${deckColor}">${esc(c.text)}</div>
    ${effects ? `<div class="effects">${effects}</div>` : ''}
    ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
    ${mineCard && c.balance !== undefined ? `<div class="note">Tu saldo ahora: <b>${money(c.balance)}</b></div>` : ''}
    <button class="primary" data-close>Entendido</button></div>`;
}

function deedHTML(i) {
  const sq = BOARD[i]; const st = S.props[i]; const o = st.owner && player(st.owner);
  const c = sq.type === 'prop' ? COLORS[sq.group] : sq.type === 'rail' ? '#333333' : '#5f7d8a';
  let rows = '';
  if (sq.type === 'prop') {
    const labels = ['Alquiler', 'Con 1 casa', 'Con 2 casas', 'Con 3 casas', 'Con 4 casas', 'Con hotel'];
    rows = sq.rent.map((r, k) => `<tr class="${o && st.houses === k ? 'cur' : ''}"><td>${labels[k]}</td><td>$${r}</td></tr>`).join('')
      + `<tr><td>Grupo completo sin casas</td><td>$${sq.rent[0] * 2}</td></tr><tr><td>Casa / hotel cuesta</td><td>$${sq.house} c/u</td></tr>`;
  } else if (sq.type === 'rail') rows = [1, 2, 3, 4].map((n) => `<tr><td>Con ${n} transporte${n > 1 ? 's' : ''}</td><td>$${25 * 2 ** (n - 1)}</td></tr>`).join('');
  else rows = '<tr><td>Con 1 servicio</td><td>4 × dados</td></tr><tr><td>Con 2 servicios</td><td>10 × dados</td></tr>';
  rows += `<tr><td>Hipoteca</td><td>$${sq.price / 2}</td></tr>`;
  const status = o ? `Dueño: <b style="color:${o.color}">${esc(o.name)}</b>${st.mortgaged ? ' · HIPOTECADA' : ''}${st.houses ? ' · ' + (st.houses === 5 ? 'hotel' : st.houses + ' casa(s)') : ''}` : `Sin dueño · Precio $${sq.price}`;
  return `<div class="deed" style="--c:${c}"><div class="hd">${esc(sq.name)}</div><table>${rows}</table><div class="ft">${status}</div></div>`;
}

function propButtons(i) {
  const sq = BOARD[i]; const st = S.props[i]; const p = mine();
  if (!p || st.owner !== p.id || S.over) return '';
  const b = [];
  if (sq.type === 'prop' && !st.mortgaged && st.houses < 5)
    b.push(`<button class="ok" data-act="build" data-pos="${i}" ${p.money < sq.house ? 'disabled' : ''}>${st.houses === 4 ? '🏨 Hotel' : '🏠 Casa'} ($${sq.house})</button>`);
  if (st.houses > 0) b.push(`<button data-act="sell" data-pos="${i}">Vender ${st.houses === 5 ? 'hotel' : 'casa'} (+$${sq.house / 2})</button>`);
  if (!st.mortgaged && !st.houses) b.push(`<button data-act="mortgage" data-pos="${i}">Hipotecar (+$${sq.price / 2})</button>`);
  if (st.mortgaged) b.push(`<button data-act="unmortgage" data-pos="${i}">Levantar hipoteca ($${Math.ceil(sq.price / 2 * 1.1)})</button>`);
  return `<div class="btn-row">${b.join('')}</div><div class="muted" style="font-size:12px">Tienes ${money(p.money)}. Banco: ${S.housesLeft} casas, ${S.hotelsLeft} hoteles.</div>`;
}

function myPropsHTML() {
  const p = mine();
  const owned = Object.entries(S.props).filter(([, st]) => st.owner === p.id).map(([i]) => +i);
  const list = owned.map((i) => {
    const st = S.props[i];
    const extra = st.mortgaged ? ' · hipotecada' : st.houses === 5 ? ' · 🏨' : st.houses ? ' · ' + '🏠'.repeat(st.houses) : '';
    return `<div class="prop-item" data-open="${i}"><span class="chip" style="--c:${chipColor(i)}"></span><span class="grow">${esc(BOARD[i].name)}${extra}</span><span class="muted">›</span></div>`;
  }).join('');
  return `<h3>Mis propiedades · ${money(p.money)}</h3><div class="muted" style="font-size:13px">Toca una para construir, vender o hipotecar. Puedes construir sin tener el grupo completo; hacen falta 4 casas antes del hotel.</div>
    <div class="prop-list">${list || '<div class="muted">Aún no tienes propiedades.</div>'}</div><button class="ghost" data-close>Cerrar</button>`;
}

function tradeHTML() {
  const others = S.players.filter((p) => !p.bankrupt && p.id !== me.id);
  if (!others.length) return '<h3>Intercambiar</h3><div class="muted">No hay con quién intercambiar.</div><button data-close>Cerrar</button>';
  return `<h3>Proponer intercambio</h3>
    <label>Con<select id="tr-to">${others.map((o) => `<option value="${o.id}">${o.icon} ${esc(o.name)}</option>`).join('')}</select></label>
    <div class="trade-cols"><div><h4>Tú das</h4><div id="tr-give" class="prop-list"></div><label>Dinero<input id="tr-gm" type="number" min="0" value="0"></label>
      ${mine().jailCards.length ? `<label>Tarjetas de cárcel<input id="tr-gc" type="number" min="0" max="${mine().jailCards.length}" value="0"></label>` : ''}</div>
    <div><h4>Tú pides</h4><div id="tr-get" class="prop-list"></div><label>Dinero<input id="tr-rm" type="number" min="0" value="0"></label></div></div>
    <div class="muted" style="font-size:12px">Solo se pueden intercambiar propiedades sin construcciones.</div>
    <div class="btn-row"><button class="primary" id="tr-send">Enviar propuesta</button><button class="ghost" data-close>Cancelar</button></div>`;
}
function wireTrade() {
  const sel = $('#tr-to'); if (!sel) return;
  const listFor = (id, el) => {
    const ids = Object.entries(S.props).filter(([, st]) => st.owner === id && !st.houses).map(([i]) => +i);
    el.innerHTML = ids.map((i) => `<label class="prop-item"><input type="checkbox" value="${i}"><span class="chip" style="--c:${chipColor(i)}"></span><span class="grow">${esc(BOARD[i].name)}</span></label>`).join('') || '<div class="muted" style="font-size:12px">Nada</div>';
  };
  const upd = () => { listFor(me.id, $('#tr-give')); listFor(sel.value, $('#tr-get')); };
  sel.onchange = upd; upd();
  $('#tr-send').onclick = () => {
    const vals = (el) => [...el.querySelectorAll('input:checked')].map((x) => +x.value);
    socket.emit('action', {
      type: 'proposeTrade', to: sel.value, giveProps: vals($('#tr-give')), getProps: vals($('#tr-get')),
      giveMoney: +$('#tr-gm').value || 0, getMoney: +$('#tr-rm').value || 0, giveCards: $('#tr-gc') ? +$('#tr-gc').value || 0 : 0,
    }, (r) => { if (r.error) toast(r.error); else { toast('Propuesta enviada', true); closeModal(); } });
  };
}
