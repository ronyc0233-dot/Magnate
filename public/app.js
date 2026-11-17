/* Cliente de Magnate */
const socket = io();
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DICE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ICONS = { go: '➡️', chance: '❓', chest: '💰', tax: '💸', jail: '🚔', parking: '☕', gotojail: '👮', rail: '🚆', util: '💡' };
const UTIL_ICON = { 'Empresa de Luz': '💡', 'Acueducto': '🚰' };
const RAIL_ICON = { 'Terminal de Buses': '🚌', 'Estación del Tren': '🚆', 'Puerto Marítimo': '⛴️', 'Aeropuerto': '✈️' };

let BOARD = [], COLORS = {};
let S = null;            // estado del servidor
let me = loadMe();       // {code, token, id}
let modalKind = null;    // qué modal está abierto (para refrescarlo)
let modalArg = null;
let lastCardSeq = 0, lastDiceKey = '', chatSeen = 0, tab = 'log';

// La sesión se guarda por pestaña: así una recarga reconecta al mismo jugador.
function loadMe() { try { return JSON.parse(sessionStorage.getItem('magnate') || 'null'); } catch { return null; } }
function saveMe(v) { me = v; try { v ? sessionStorage.setItem('magnate', JSON.stringify(v)) : sessionStorage.removeItem('magnate'); } catch {} }
try { $('#in-name').value = localStorage.getItem('magnate-name') || ''; } catch {}

function toast(msg, info) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (info ? ' info' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 3500);
}
const cb = (r) => { if (r && r.error) toast(r.error); };
const act = (type, extra = {}) => socket.emit('action', { type, ...extra }, cb);

// ---------- conexión ----------
fetch('/board').then((r) => r.json()).then((d) => { BOARD = d.board; COLORS = d.colors; buildBoard(); if (S) render(); });

socket.on('connect', () => {
  if (me) socket.emit('rejoin', me, (r) => { if (r.error) { saveMe(null); show('home'); } });
});
socket.on('joined', (d) => { saveMe(d); history.replaceState(null, '', '?sala=' + d.code); });
socket.on('state', (st) => { S = st; render(); });
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
$('#btn-leave').onclick = () => { socket.emit('leaveLobby'); saveMe(null); S = null; history.replaceState(null, '', location.pathname); show('home'); };
$('#btn-copy').onclick = () => {
  const url = location.origin + location.pathname + '?sala=' + S.code;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Enlace copiado', true), () => prompt('Copia este enlace:', url));
};

function show(name) {
  for (const s of ['home', 'lobby', 'game']) $('#screen-' + s).classList.toggle('hidden', s !== name);
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
    t.className = `tile s-${side}` + (corner ? ' corner' : '');
    t.style.gridRow = r; t.style.gridColumn = c; t.dataset.i = i;
    let html = '';
    if (sq.type === 'prop') html += `<div class="band" style="--c:${COLORS[sq.group]}"></div><div class="builds"></div>`;
    const ico = sq.type === 'rail' ? RAIL_ICON[sq.name] : sq.type === 'util' ? UTIL_ICON[sq.name] : ICONS[sq.type];
    if (corner) html += `<div class="ico">${ico}</div><div class="name">${esc(sq.name)}</div>`;
    else {
      html += `<div class="name">${esc(sq.name)}</div>`;
      if (ico) html += `<div class="ico">${ico}</div>`;
      if (sq.price) html += `<div class="price">$${sq.price}</div>`;
      else if (sq.amount) html += `<div class="price">$${sq.amount}</div>`;
    }
    html += `<div class="owner hidden"></div><div class="tokens"></div>`;
    t.innerHTML = html;
    t.onclick = () => { if (BOARD[i].price) openModal('prop', i); };
    b.appendChild(t);
  });
}

const player = (id) => S.players.find((p) => p.id === id);
const mine = () => S && player(me && me.id);
const isMyTurn = () => S && S.players[S.turn] && me && S.players[S.turn].id === me.id;

// ---------- render ----------
function render() {
  if (!S) return;
  if (!S.started) return renderLobby();
  show('game');
  $('#game-code').textContent = S.code;
  if (!BOARD.length) return;
  renderBoard(); renderCenter(); renderPlayers(); renderTrades(); renderFeeds();
  // Al reconectar no se repite la última tarjeta; después, cada tarjeta nueva se muestra.
  const seq = S.lastCard ? S.lastCard.seq : 0;
  if (!render.seenFirst) { render.seenFirst = true; lastCardSeq = seq; }
  else if (seq !== lastCardSeq) {
    lastCardSeq = seq;
    if (!modalKind || modalKind === 'card') openModal('card', S.lastCard);
  }
  if (modalKind && modalKind !== 'card' && modalKind !== 'trade') openModal(modalKind, modalArg, true);
}

function renderLobby() {
  show('lobby');
  $('#lobby-code').textContent = S.code;
  $('#lobby-players').innerHTML = S.players.map((p) => `<li><span class="dot" style="background:${p.color}"></span>${p.icon} <b>${esc(p.name)}</b>${p.id === S.hostId ? ' <span class="tagx">anfitrión</span>' : ''}${p.id === me.id ? ' <span class="tagx">tú</span>' : ''}${p.connected ? '' : ' <span class="tagx off">desconectado</span>'}</li>`).join('');
  const host = S.hostId === me.id;
  $('#btn-start').classList.toggle('hidden', !host);
  $('#btn-start').disabled = S.players.length < 2;
  $('#lobby-hint').textContent = S.players.length < 2 ? 'Comparte el código o el enlace. Se necesitan al menos 2 jugadores (máximo 4).'
    : host ? `${S.players.length} de 4 jugadores. Puedes iniciar cuando quieras.` : 'Esperando a que el anfitrión inicie la partida…';
}

function renderBoard() {
  document.querySelectorAll('.tile').forEach((t) => {
    const i = +t.dataset.i; const st = S.props[i];
    const ow = t.querySelector('.owner');
    if (st) {
      const o = st.owner && player(st.owner);
      ow.classList.toggle('hidden', !o);
      if (o) ow.style.background = o.color;
      t.classList.toggle('mortgaged', st.mortgaged);
      const bd = t.querySelector('.builds');
      if (bd) bd.innerHTML = st.houses === 5 ? '<div class="hotel"></div>' : '<div class="house"></div>'.repeat(st.houses);
    }
    const here = S.players.filter((p) => !p.bankrupt && p.pos === i);
    t.querySelector('.tokens').innerHTML = here.map((p) => `<div class="token${p.id === me.id ? ' me' : ''}" style="--c:${p.color}" title="${esc(p.name)}">${p.icon}</div>`).join('');
  });
}

function renderCenter() {
  const cp = S.players[S.turn]; const p = mine();
  const key = S.dice.join('-') + '|' + S.log.length;
  const roll = S.dice[0] && key !== lastDiceKey && S.log.some((l) => l.startsWith('🎲'));
  lastDiceKey = key;
  $('#dice').innerHTML = S.dice[0] ? S.dice.map((d) => `<span class="${roll ? 'roll' : ''}">${DICE[d]}</span>`).join('') : '';

  const A = $('#actions');
  if (S.over) {
    const w = player(S.winner);
    $('#turn-info').textContent = '';
    A.innerHTML = `<div class="winner">🏆 ¡${esc(w.name)} gana!</div><button class="primary" id="b-new">Nueva partida</button>`;
    $('#b-new').onclick = () => { saveMe(null); S = null; history.replaceState(null, '', location.pathname); show('home'); };
    return;
  }
  $('#turn-info').innerHTML = isMyTurn() ? '⭐ Es tu turno' : `Turno de <span style="color:${cp.color}">${cp.icon} ${esc(cp.name)}</span>`;
  let h = '';
  const sq = BOARD[cp.pos];

  if (S.phase === 'auction' && S.auction) {
    const a = S.auction; const as = BOARD[a.pos]; const bidder = a.bidder && player(a.bidder);
    const left = Math.max(0, Math.ceil((a.endsAt - S.now) / 1000));
    const out = !p || p.bankrupt || a.passed.includes(p.id);
    h += `<div class="auction-box"><div>🔨 Subasta: <b>${esc(as.name)}</b> (precio $${as.price})</div>
      <div class="big">$${a.high}</div><div>${bidder ? 'Oferta de ' + esc(bidder.name) : 'Sin ofertas'} · <span id="auc-left" data-end="${Date.now() + left * 1000}">${left}s</span></div>
      ${out ? '<div class="muted">Te retiraste de la subasta.</div>' : `<div class="btns">
        <button data-bid="${a.high + 10}">+10</button><button data-bid="${a.high + 50}">+50</button><button data-bid="${a.high + 100}">+100</button>
        <input id="bid-in" type="number" min="${a.high + 1}" placeholder="$"><button class="primary" id="bid-go">Ofertar</button>
        ${a.bidder !== p.id ? '<button class="ghost" id="bid-pass">Retirarme</button>' : ''}</div>`}</div>`;
  } else if (S.phase === 'debt') {
    const d = S.debts[0]; const dp = player(d.debtor);
    if (d.debtor === me.id) {
      h += `<div class="info">Debes <b>$${d.amount}</b> (${esc(d.reason)}) a ${d.creditor ? esc(player(d.creditor).name) : 'el banco'}. Tienes $${p.money}.<br>Vende construcciones o hipoteca desde “Mis propiedades”.</div>
        <div class="btns"><button class="primary" id="b-paydebt" ${p.money < d.amount ? 'disabled' : ''}>Pagar deuda</button><button id="b-props2">Mis propiedades</button><button class="danger" id="b-bk">Declararme en bancarrota</button></div>`;
    } else h += `<div class="info">Esperando a que ${esc(dp.name)} pague $${d.amount}…</div>`;
  } else if (isMyTurn()) {
    if (S.phase === 'roll') {
      if (p.inJail) {
        h += `<div class="info">Estás en la cárcel (intento ${p.jailTurns + 1} de 3).</div><div class="btns">
          <button class="primary" id="b-roll">Tirar por dobles</button>
          <button id="b-payjail" ${p.money < 50 ? 'disabled' : ''}>Pagar $50</button>
          ${p.jailCards.length ? '<button id="b-card">Usar tarjeta</button>' : ''}</div>`;
      } else h += `<div class="btns"><button class="primary" id="b-roll">🎲 Tirar dados</button></div>`;
    } else if (S.phase === 'buy') {
      h += `<div class="info">¿Comprar <b>${esc(sq.name)}</b> por $${sq.price}? Tienes $${p.money}.</div><div class="btns">
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
  $('#players').innerHTML = S.players.map((p, idx) => {
    const owned = Object.entries(S.props).filter(([, st]) => st.owner === p.id).map(([i, st]) => ({ i: +i, st }));
    const chips = owned.map(({ i, st }) => `<span class="chip${st.mortgaged ? ' m' : ''}" style="--c:${chipColor(i)}" title="${esc(BOARD[i].name)}"></span>`).join('');
    const tags = [p.id === me.id && 'tú', p.inJail && 'cárcel', p.jailCards.length && `🔓×${p.jailCards.length}`].filter(Boolean)
      .map((t) => `<span class="tagx">${t}</span>`).join(' ') + (p.connected ? '' : ' <span class="tagx off">desconectado</span>');
    return `<div class="pcard${idx === S.turn && !S.over ? ' turn' : ''}${p.bankrupt ? ' bankrupt' : ''}" style="--c:${p.color}">
      <div class="top"><div class="nm">${p.icon}<span>${esc(p.name)}</span></div><div class="money">${p.bankrupt ? 'quiebra' : '$' + p.money}</div></div>
      <div>${tags}</div><div class="chips">${chips}</div></div>`;
  }).join('');
}
function chipColor(i) { const sq = BOARD[i]; return sq.type === 'prop' ? COLORS[sq.group] : sq.type === 'rail' ? '#444' : '#9aa'; }

function renderTrades() {
  const mineT = S.trades.filter((t) => t.to === me.id || t.from === me.id);
  const pl = (arr) => arr.map((i) => esc(BOARD[i].name)).join(', ');
  $('#trades').innerHTML = mineT.map((t) => {
    const f = player(t.from), to = player(t.to); const incoming = t.to === me.id;
    const give = [t.give.length && pl(t.give), t.giveMoney && '$' + t.giveMoney, t.giveCards && `${t.giveCards} tarjeta(s) de cárcel`].filter(Boolean).join(' + ') || 'nada';
    const get = [t.get.length && pl(t.get), t.getMoney && '$' + t.getMoney].filter(Boolean).join(' + ') || 'nada';
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

// ---------- modales ----------
$('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
function closeModal() { modalKind = null; modalArg = null; $('#modal').classList.add('hidden'); }

function openModal(kind, arg, refresh) {
  const box = $('#modal-box');
  modalKind = kind; modalArg = arg;
  if (kind === 'prop') box.innerHTML = deedHTML(arg) + propButtons(arg) + '<button class="ghost" data-close>Cerrar</button>';
  else if (kind === 'card') box.innerHTML = `<div class="card-pop"><div class="kind">${arg.deck === 'chance' ? '❓ SORPRESA' : '💰 FONDO COMÚN'}</div>
      <div class="muted">${esc(player(arg.player).name)} sacó:</div><div class="txt">${esc(arg.text)}</div><button class="primary" data-close>Entendido</button></div>`;
  else if (kind === 'myprops') box.innerHTML = myPropsHTML();
  else if (kind === 'trade') { if (!refresh) box.innerHTML = tradeHTML(); }
  $('#modal').classList.remove('hidden');
  box.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal));
  box.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act, { pos: +b.dataset.pos })));
  box.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openModal('prop', +b.dataset.open)));
  if (kind === 'trade' && !refresh) wireTrade();
}

function deedHTML(i) {
  const sq = BOARD[i]; const st = S.props[i]; const o = st.owner && player(st.owner);
  const c = sq.type === 'prop' ? COLORS[sq.group] : sq.type === 'rail' ? '#333' : '#5f7d8a';
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
  return `<div class="btn-row">${b.join('')}</div><div class="muted" style="font-size:12px">Tienes $${p.money}. Banco: ${S.housesLeft} casas, ${S.hotelsLeft} hoteles.</div>`;
}

function myPropsHTML() {
  const p = mine();
  const owned = Object.entries(S.props).filter(([, st]) => st.owner === p.id).map(([i]) => +i);
  const list = owned.map((i) => {
    const st = S.props[i];
    const extra = st.mortgaged ? ' · hipotecada' : st.houses === 5 ? ' · 🏨' : st.houses ? ' · ' + '🏠'.repeat(st.houses) : '';
    return `<div class="prop-item" data-open="${i}"><span class="chip" style="--c:${chipColor(i)}"></span><span class="grow">${esc(BOARD[i].name)}${extra}</span><span class="muted">›</span></div>`;
  }).join('');
  return `<h3>Mis propiedades · $${p.money}</h3><div class="muted" style="font-size:13px">Toca una para construir, vender o hipotecar. Puedes construir sin tener el grupo completo; hacen falta 4 casas antes del hotel.</div>
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
