// Lógica de juego de "Magnate". El servidor es la única fuente de verdad.
const crypto = require('crypto');
const { BOARD, CHANCE, CHEST } = require('./board');

const START_MONEY = 1500;
const MAX_START_MONEY = 5000;
const MAX_PLAYERS = 8;
const GO_SALARY = 200;
const JAIL_POS = 10;
const JAIL_FINE = 50;
const COLORS = ['#f76707', '#1c7ed6', '#37b24d', '#ae3ec9', '#e03131', '#0ca678', '#f59f00', '#e64980'];
const TOKENS = ['🚗', '🎩', '🐕', '🚢', '🚀', '🐱', '⚽', '👑'];

const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
const die = () => 1 + crypto.randomInt(6);
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

function createRoom(code) {
  const props = {};
  BOARD.forEach((sq, i) => { if (sq.price) props[i] = { owner: null, houses: 0, mortgaged: false }; });
  return {
    code, hostId: null, started: false, over: false, winner: null,
    players: [], props, turn: 0, phase: 'lobby',
    dice: [0, 0], doublesCount: 0, extraRoll: false,
    debts: [], auction: null, trades: [],
    chanceDeck: shuffle(CHANCE.map((_, i) => i)), chestDeck: shuffle(CHEST.map((_, i) => i)),
    housesLeft: 32, hotelsLeft: 12,
    log: [], chat: [], lastCard: null, seq: 0, rollSeq: 0,
    startMoney: START_MONEY,
    onChange: () => {},
  };
}

function addPlayer(room, name) {
  // Primer color libre (por si alguien salió de la sala de espera).
  const n = COLORS.findIndex((c) => !room.players.some((p) => p.color === c));
  const p = {
    id: rid(4), token: rid(16), name: String(name || 'Jugador').trim().slice(0, 16) || 'Jugador',
    color: COLORS[n], icon: TOKENS[n], money: room.startMoney, pos: 0,
    inJail: false, jailTurns: 0, jailCards: [], bankrupt: false, connected: true,
    move: null,
  };
  room.players.push(p);
  if (!room.hostId) room.hostId = p.id;
  return p;
}

const log = (room, msg) => { room.log.push(msg); if (room.log.length > 150) room.log.shift(); };
const P = (room, id) => room.players.find((p) => p.id === id);
const cur = (room) => room.players[room.turn];
const active = (room) => room.players.filter((p) => !p.bankrupt);

// ---------- alquileres ----------
function ownsGroup(room, ownerId, group) {
  return BOARD.every((sq, i) => sq.group !== group || room.props[i].owner === ownerId);
}
function countType(room, ownerId, type) {
  return BOARD.filter((sq, i) => sq.type === type && room.props[i].owner === ownerId).length;
}
function rentFor(room, pos, diceTotal, mult = 1) {
  const sq = BOARD[pos]; const st = room.props[pos];
  if (!st.owner || st.mortgaged) return 0;
  if (sq.type === 'prop') {
    if (st.houses > 0) return sq.rent[st.houses];
    return sq.rent[0] * (ownsGroup(room, st.owner, sq.group) ? 2 : 1);
  }
  if (sq.type === 'rail') return 25 * 2 ** (countType(room, st.owner, 'rail') - 1) * mult;
  if (sq.type === 'util') {
    if (mult === 10) return diceTotal * 10;
    return diceTotal * (countType(room, st.owner, 'util') === 2 ? 10 : 4);
  }
  return 0;
}

// ---------- dinero y deudas ----------
function charge(room, payer, amount, creditor, reason) {
  if (amount <= 0) return;
  if (payer.money >= amount) {
    payer.money -= amount;
    if (creditor) creditor.money += amount;
  } else {
    room.debts.push({ debtor: payer.id, creditor: creditor ? creditor.id : null, amount, reason });
    log(room, `⚠️ ${payer.name} debe $${amount} (${reason}) y no tiene efectivo suficiente.`);
  }
}

function settle(room) {
  if (room.over) return;
  const p = cur(room);
  if ((room.phase === 'buy' && !p.bankrupt) || room.phase === 'auction') return;
  if (room.debts.length) { room.phase = 'debt'; return; }
  if (!p || p.bankrupt) return nextTurn(room);
  room.phase = room.extraRoll && !p.inJail ? 'roll' : 'end';
}

function nextTurn(room) {
  if (checkWinner(room)) return;
  let i = room.turn;
  do { i = (i + 1) % room.players.length; } while (room.players[i].bankrupt);
  room.turn = i;
  room.phase = 'roll'; room.doublesCount = 0; room.extraRoll = false;
  log(room, `— Turno de ${room.players[i].name} —`);
}

function checkWinner(room) {
  const a = active(room);
  if (a.length === 1 && room.started) {
    room.over = true; room.winner = a[0].id; room.phase = 'over';
    log(room, `🏆 ¡${a[0].name} gana la partida!`);
    return true;
  }
  return false;
}

function declareBankrupt(room, p, creditorId) {
  const creditor = creditorId ? P(room, creditorId) : null;
  log(room, `💀 ${p.name} se declara en bancarrota${creditor ? ' ante ' + creditor.name : ''}.`);
  for (const [i, st] of Object.entries(room.props)) {
    if (st.owner !== p.id) continue;
    const sq = BOARD[i];
    // Las construcciones vuelven al banco por la mitad de su valor.
    if (st.houses > 0) {
      const value = (st.houses * sq.house) / 2;
      p.money += value;
      if (st.houses === 5) room.hotelsLeft++; else room.housesLeft += st.houses;
      st.houses = 0;
    }
    if (creditor) st.owner = creditor.id;
    else { st.owner = null; st.mortgaged = false; }
  }
  if (creditor) {
    creditor.money += Math.max(0, p.money);
    creditor.jailCards.push(...p.jailCards);
  } else {
    p.jailCards.forEach((c) => (c.deck === 'chance' ? room.chanceDeck : room.chestDeck).push(c.idx));
  }
  p.money = 0; p.jailCards = []; p.bankrupt = true;
  room.debts = room.debts.filter((d) => d.debtor !== p.id);
  room.debts.forEach((d) => { if (d.creditor === p.id) d.creditor = creditorId || null; });
  room.trades = room.trades.filter((t) => t.from !== p.id && t.to !== p.id);
  if (checkWinner(room)) return;
  if (room.auction) {
    room.auction.passed = room.auction.passed.filter((id) => id !== p.id);
    if (room.auction.bidder === p.id) { room.auction.bidder = null; room.auction.high = 0; }
    auctionCheckEnd(room);
    return;
  }
  room.phase = 'resolving';
  settle(room);
}

// ---------- movimiento ----------
// Cada movimiento queda registrado para que los clientes lo animen paso a paso.
function addSeg(room, p, to, mode) {
  if (!p.move || p.move.done) p.move = { seq: ++room.seq, segs: [] };
  p.move.segs.push({ from: p.pos, to, mode });
}
function moveTo(room, p, to, collectGo = true) {
  addSeg(room, p, to, 'walk');
  if (collectGo && to < p.pos) { p.money += GO_SALARY; log(room, `${p.name} pasa por la Salida y cobra $${GO_SALARY}.`); }
  p.pos = to;
}
function moveBack(room, p, n) {
  const to = (p.pos + 40 - n) % 40;
  addSeg(room, p, to, 'back');
  p.pos = to;
}
function goToJail(room, p) {
  addSeg(room, p, JAIL_POS, 'jump');
  p.pos = JAIL_POS; p.inJail = true; p.jailTurns = 0; room.extraRoll = false;
  log(room, `🚔 ${p.name} va a la cárcel.`);
}

function landOn(room, p, opts = {}) {
  const sq = BOARD[p.pos];
  const total = room.dice[0] + room.dice[1];
  log(room, `${p.name} cae en ${sq.name}.`);
  switch (sq.type) {
    case 'prop': case 'rail': case 'util': {
      const st = room.props[p.pos];
      if (!st.owner) { room.phase = 'buy'; return; }
      if (st.owner === p.id) return;
      if (st.mortgaged) { log(room, `${sq.name} está hipotecada: no se cobra alquiler.`); return; }
      let rent;
      if (opts.utilTen) {
        const a = die(), b = die();
        rent = (a + b) * 10;
        log(room, `${p.name} tira ${a}+${b} para el servicio.`);
      } else rent = rentFor(room, p.pos, total, opts.railDouble ? 2 : 1);
      const owner = P(room, st.owner);
      log(room, `💸 ${p.name} paga $${rent} de alquiler a ${owner.name}.`);
      charge(room, p, rent, owner, `alquiler de ${sq.name}`);
      return;
    }
    case 'tax':
      log(room, `${p.name} paga $${sq.amount} de ${sq.name}.`);
      charge(room, p, sq.amount, null, sq.name);
      return;
    case 'gotojail': goToJail(room, p); return;
    case 'chance': return drawCard(room, p, 'chance');
    case 'chest': return drawCard(room, p, 'chest');
    default: return;
  }
}

// Saca una tarjeta y guarda su efecto real en el dinero de cada jugador,
// para mostrar en pantalla a quién le sumó o le restó.
function drawCard(room, p, deckName) {
  const before = new Map(room.players.map((x) => [x.id, x.money]));
  const debtsBefore = room.debts.length;
  const card = applyCard(room, p, deckName);
  card.effects = room.players
    .map((x) => ({ id: x.id, delta: x.money - before.get(x.id) }))
    .filter((e) => e.delta !== 0);
  card.debts = room.debts.slice(debtsBefore).map((d) => ({ id: d.debtor, amount: d.amount }));
  card.balance = p.money;
}

function applyCard(room, p, deckName) {
  const deck = deckName === 'chance' ? room.chanceDeck : room.chestDeck;
  const cards = deckName === 'chance' ? CHANCE : CHEST;
  const idx = deck.shift();
  const c = cards[idx];
  const card = room.lastCard = { deck: deckName, text: c.text, player: p.id, seq: ++room.seq, note: null };
  log(room, `🃏 ${p.name} (${deckName === 'chance' ? 'Sorpresa' : 'Fondo Común'}): ${c.text}`);
  if (c.kind === 'jailFree') { p.jailCards.push({ deck: deckName, idx }); return card; }
  deck.push(idx);
  const others = active(room).filter((o) => o.id !== p.id);
  switch (c.kind) {
    case 'money':
      if (c.amount > 0) p.money += c.amount; else charge(room, p, -c.amount, null, 'tarjeta');
      break;
    case 'moveTo': moveTo(room, p, c.to); landOn(room, p); break;
    case 'moveBack': moveBack(room, p, c.n); landOn(room, p); break;
    case 'jail': goToJail(room, p); break;
    case 'payEach': others.forEach((o) => charge(room, p, c.amount, o, 'tarjeta')); break;
    case 'collectEach': others.forEach((o) => charge(room, o, c.amount, p, 'cumpleaños')); break;
    case 'repairs': {
      let cost = 0;
      for (const st of Object.values(room.props)) {
        if (st.owner !== p.id) continue;
        cost += st.houses === 5 ? c.hotel : st.houses * c.house;
      }
      if (cost) { log(room, `${p.name} paga $${cost} en reparaciones.`); charge(room, p, cost, null, 'reparaciones'); }
      else { card.note = 'No tiene construcciones: paga $0.'; log(room, `${p.name} no tiene construcciones: paga $0.`); }
      break;
    }
    case 'nearestRail': {
      let to = p.pos; do { to = (to + 1) % 40; } while (BOARD[to].type !== 'rail');
      moveTo(room, p, to); landOn(room, p, { railDouble: true }); break;
    }
    case 'nearestUtil': {
      let to = p.pos; do { to = (to + 1) % 40; } while (BOARD[to].type !== 'util');
      moveTo(room, p, to); landOn(room, p, { utilTen: true }); break;
    }
  }
  return card;
}

// ---------- subastas ----------
function startAuction(room, pos) {
  room.phase = 'auction';
  room.auction = { pos, high: 0, bidder: null, passed: [], endsAt: Date.now() + 20000 };
  log(room, `🔨 Subasta de ${BOARD[pos].name}.`);
  scheduleAuction(room);
}
function scheduleAuction(room) {
  clearTimeout(room._auctionTimer);
  const ms = Math.max(0, room.auction.endsAt - Date.now());
  room._auctionTimer = setTimeout(() => { if (room.auction) { finishAuction(room); room.onChange(); } }, ms + 50);
}
function finishAuction(room) {
  const a = room.auction; if (!a) return;
  clearTimeout(room._auctionTimer);
  room.auction = null;
  const w = a.bidder && P(room, a.bidder);
  if (w && !w.bankrupt && w.money >= a.high) {
    w.money -= a.high; room.props[a.pos].owner = w.id;
    log(room, `🔨 ${w.name} gana la subasta de ${BOARD[a.pos].name} por $${a.high}.`);
  } else log(room, `🔨 Nadie compró ${BOARD[a.pos].name}.`);
  room.phase = 'resolving';
  settle(room);
}
function auctionCheckEnd(room) {
  const a = room.auction;
  const bidders = active(room).filter((p) => !a.passed.includes(p.id));
  if (bidders.length === 0 || (bidders.length === 1 && a.bidder === bidders[0].id)) finishAuction(room);
}

// ---------- acciones ----------
function startGame(room, byId) {
  if (room.hostId !== byId) return 'Solo el anfitrión puede iniciar.';
  if (room.players.length < 2) return 'Se necesitan al menos 2 jugadores.';
  room.players.forEach((p) => (p.money = room.startMoney));
  room.started = true;
  room.turn = crypto.randomInt(room.players.length);
  room.phase = 'roll';
  log(room, `🎲 Comienza la partida. Empieza ${cur(room).name}.`);
  return null;
}

function setStartMoney(room, byId, amount) {
  if (room.hostId !== byId) return 'Solo el anfitrión puede cambiarlo.';
  if (room.started) return 'La partida ya comenzó.';
  const v = Math.round(Number(amount) / 500) * 500;
  if (!(v >= START_MONEY && v <= MAX_START_MONEY)) return `Elige entre $${START_MONEY} y $${MAX_START_MONEY}.`;
  room.startMoney = v;
  room.players.forEach((p) => (p.money = v));
  return null;
}

function handle(room, pid, a) {
  if (!room.started) return 'La partida no ha comenzado.';
  if (room.over) return 'La partida terminó.';
  const p = P(room, pid);
  if (!p || p.bankrupt) return 'No participas.';
  const myTurn = cur(room).id === pid;
  const st = a.pos != null ? room.props[a.pos] : null;
  const sq = a.pos != null ? BOARD[a.pos] : null;

  switch (a.type) {
    case 'roll': {
      if (!myTurn || room.phase !== 'roll') return 'No puedes tirar ahora.';
      const d1 = die(), d2 = die(); room.dice = [d1, d2];
      room.rollSeq++; room.rollBy = pid;
      p.move = { seq: ++room.seq, segs: [] };
      const dbl = d1 === d2; const total = d1 + d2;
      log(room, `🎲 ${p.name} tira ${d1} + ${d2} = ${total}${dbl ? ' (¡dobles!)' : ''}`);
      room.phase = 'resolving'; room.extraRoll = false;
      if (p.inJail) {
        if (dbl) { p.inJail = false; p.jailTurns = 0; log(room, `${p.name} sale de la cárcel con dobles.`); }
        else {
          p.jailTurns++;
          if (p.jailTurns < 3) { log(room, `${p.name} sigue en la cárcel (${p.jailTurns}/3).`); room.phase = 'end'; return null; }
          log(room, `${p.name} paga $${JAIL_FINE} tras 3 intentos y sale de la cárcel.`);
          p.inJail = false; p.jailTurns = 0;
          charge(room, p, JAIL_FINE, null, 'multa de cárcel');
        }
      } else if (dbl) {
        room.doublesCount++;
        if (room.doublesCount === 3) { log(room, `${p.name} saca dobles 3 veces seguidas.`); goToJail(room, p); settle(room); return null; }
        room.extraRoll = true;
      }
      moveTo(room, p, (p.pos + total) % 40);
      landOn(room, p);
      settle(room);
      return null;
    }
    case 'payJail': {
      if (!myTurn || room.phase !== 'roll' || !p.inJail) return 'No aplica.';
      if (p.money < JAIL_FINE) return 'No tienes suficiente dinero.';
      p.money -= JAIL_FINE; p.inJail = false; p.jailTurns = 0;
      log(room, `${p.name} paga $${JAIL_FINE} y sale de la cárcel.`);
      return null;
    }
    case 'useJailCard': {
      if (!myTurn || room.phase !== 'roll' || !p.inJail || !p.jailCards.length) return 'No aplica.';
      const c = p.jailCards.pop();
      (c.deck === 'chance' ? room.chanceDeck : room.chestDeck).push(c.idx);
      p.inJail = false; p.jailTurns = 0;
      log(room, `${p.name} usa su tarjeta y sale de la cárcel.`);
      return null;
    }
    case 'buy': {
      if (!myTurn || room.phase !== 'buy') return 'No puedes comprar ahora.';
      const s = BOARD[p.pos]; const ps = room.props[p.pos];
      if (p.money < s.price) return 'No tienes suficiente dinero. Puedes hipotecar o subastar.';
      p.money -= s.price; ps.owner = p.id;
      log(room, `🏠 ${p.name} compra ${s.name} por $${s.price}.`);
      room.phase = 'resolving'; settle(room);
      return null;
    }
    case 'decline': {
      if (!myTurn || room.phase !== 'buy') return 'No aplica.';
      startAuction(room, p.pos);
      return null;
    }
    case 'bid': {
      const au = room.auction;
      if (room.phase !== 'auction' || !au) return 'No hay subasta.';
      if (au.passed.includes(pid)) return 'Ya te retiraste de la subasta.';
      const amt = Math.floor(Number(a.amount));
      if (!(amt > au.high)) return `La oferta debe superar $${au.high}.`;
      if (amt > p.money) return 'No tienes tanto dinero.';
      au.high = amt; au.bidder = pid;
      au.endsAt = Math.max(au.endsAt, Date.now() + 8000);
      log(room, `${p.name} ofrece $${amt}.`);
      scheduleAuction(room); auctionCheckEnd(room);
      return null;
    }
    case 'passAuction': {
      const au = room.auction;
      if (room.phase !== 'auction' || !au) return 'No hay subasta.';
      if (au.bidder === pid) return 'Tienes la oferta más alta.';
      if (!au.passed.includes(pid)) { au.passed.push(pid); log(room, `${p.name} se retira de la subasta.`); }
      auctionCheckEnd(room);
      return null;
    }
    case 'endTurn': {
      if (!myTurn || room.phase !== 'end') return 'No puedes terminar el turno ahora.';
      nextTurn(room); return null;
    }
    // ---- construcción: NO se exige el grupo completo ni construir parejo, pero sí casas antes del hotel ----
    case 'build': {
      if (!st || sq.type !== 'prop' || st.owner !== pid) return 'No es tu propiedad.';
      if (st.mortgaged) return 'La propiedad está hipotecada.';
      if (st.houses >= 5) return 'Ya tiene hotel.';
      if (room.phase === 'auction') return 'Espera a que termine la subasta.';
      if (p.money < sq.house) return 'No tienes suficiente dinero.';
      if (st.houses < 4) {
        if (room.housesLeft <= 0) return 'El banco no tiene casas disponibles.';
        room.housesLeft--; st.houses++;
        log(room, `🏠 ${p.name} construye una casa en ${sq.name} (${st.houses}).`);
      } else {
        if (room.hotelsLeft <= 0) return 'El banco no tiene hoteles disponibles.';
        room.hotelsLeft--; room.housesLeft += 4; st.houses = 5;
        log(room, `🏨 ${p.name} construye un hotel en ${sq.name}.`);
      }
      p.money -= sq.house;
      return null;
    }
    case 'sell': {
      if (!st || st.owner !== pid || st.houses === 0) return 'No hay construcciones que vender.';
      if (st.houses === 5) { st.houses = 4; room.hotelsLeft++; room.housesLeft = Math.max(0, room.housesLeft - 4); }
      else { st.houses--; room.housesLeft++; }
      p.money += sq.house / 2;
      log(room, `${p.name} vende una construcción en ${sq.name} por $${sq.house / 2}.`);
      return null;
    }
    case 'mortgage': {
      if (!st || st.owner !== pid || st.mortgaged) return 'No se puede hipotecar.';
      if (st.houses > 0) return 'Primero vende las construcciones.';
      st.mortgaged = true; p.money += sq.price / 2;
      log(room, `${p.name} hipoteca ${sq.name} por $${sq.price / 2}.`);
      return null;
    }
    case 'unmortgage': {
      if (!st || st.owner !== pid || !st.mortgaged) return 'No está hipotecada.';
      const cost = Math.ceil((sq.price / 2) * 1.1);
      if (p.money < cost) return `Necesitas $${cost}.`;
      p.money -= cost; st.mortgaged = false;
      log(room, `${p.name} levanta la hipoteca de ${sq.name} por $${cost}.`);
      return null;
    }
    case 'payDebt': {
      const d = room.debts[0];
      if (!d || d.debtor !== pid) return 'No tienes deudas pendientes ahora.';
      if (p.money < d.amount) return `Te faltan $${d.amount - p.money}. Vende o hipoteca.`;
      p.money -= d.amount;
      const c = d.creditor && P(room, d.creditor); if (c) c.money += d.amount;
      log(room, `${p.name} paga su deuda de $${d.amount}.`);
      room.debts.shift();
      room.phase = 'resolving'; settle(room);
      return null;
    }
    case 'bankrupt': {
      const d = room.debts.find((x) => x.debtor === pid);
      declareBankrupt(room, p, d ? d.creditor : null);
      return null;
    }
    case 'kick': {
      if (room.hostId !== pid) return 'Solo el anfitrión.';
      const t = P(room, a.target);
      if (!t || t.bankrupt || t.connected) return 'Solo puedes retirar a un jugador desconectado.';
      log(room, `${t.name} fue retirado por desconexión.`);
      declareBankrupt(room, t, null);
      return null;
    }
    // ---- intercambios ----
    case 'proposeTrade': {
      const to = P(room, a.to);
      if (!to || to.bankrupt || to.id === pid) return 'Jugador inválido.';
      const give = (a.giveProps || []).map(Number), get = (a.getProps || []).map(Number);
      const gm = Math.max(0, Math.floor(a.giveMoney || 0)), rm = Math.max(0, Math.floor(a.getMoney || 0));
      const gc = Math.min(p.jailCards.length, Math.max(0, Math.floor(a.giveCards || 0)));
      const err = validateTrade(room, p, to, give, get, gm, rm);
      if (err) return err;
      if (!give.length && !get.length && !gm && !rm && !gc) return 'El intercambio está vacío.';
      room.trades.push({ id: rid(4), from: pid, to: to.id, give, get, giveMoney: gm, getMoney: rm, giveCards: gc });
      log(room, `🤝 ${p.name} propone un intercambio a ${to.name}.`);
      return null;
    }
    case 'respondTrade': {
      const t = room.trades.find((x) => x.id === a.id);
      if (!t) return 'Intercambio no encontrado.';
      if (a.accept) {
        if (t.to !== pid) return 'No es para ti.';
        const from = P(room, t.from);
        const err = validateTrade(room, from, p, t.give, t.get, t.giveMoney, t.getMoney);
        room.trades = room.trades.filter((x) => x.id !== t.id);
        if (err) return 'El intercambio ya no es válido: ' + err;
        t.give.forEach((i) => (room.props[i].owner = p.id));
        t.get.forEach((i) => (room.props[i].owner = from.id));
        from.money += t.getMoney - t.giveMoney; p.money += t.giveMoney - t.getMoney;
        for (let k = 0; k < t.giveCards && from.jailCards.length; k++) p.jailCards.push(from.jailCards.pop());
        log(room, `🤝 ${p.name} acepta el intercambio con ${from.name}.`);
      } else {
        if (t.to !== pid && t.from !== pid) return 'No es tuyo.';
        room.trades = room.trades.filter((x) => x.id !== t.id);
        log(room, `🤝 Intercambio ${t.from === pid ? 'cancelado' : 'rechazado'}.`);
      }
      return null;
    }
    default: return 'Acción desconocida.';
  }
}

function validateTrade(room, from, to, give, get, gm, rm) {
  for (const i of give) { const s = room.props[i]; if (!s || s.owner !== from.id) return 'Ofreces una propiedad que no es tuya.'; if (s.houses) return 'Vende las construcciones antes de intercambiar.'; }
  for (const i of get) { const s = room.props[i]; if (!s || s.owner !== to.id) return 'Pides una propiedad que no es suya.'; if (s.houses) return 'Esa propiedad tiene construcciones.'; }
  if (gm > from.money) return `${from.name} no tiene $${gm}.`;
  if (rm > to.money) return `${to.name} no tiene $${rm}.`;
  return null;
}

// Estado visible para los clientes (sin tokens secretos).
function publicState(room) {
  return {
    code: room.code, hostId: room.hostId, started: room.started, over: room.over, winner: room.winner,
    players: room.players.map(({ token, socketId, ...rest }) => rest),
    props: room.props, turn: room.turn, phase: room.phase, dice: room.dice,
    rollSeq: room.rollSeq, rollBy: room.rollBy || null, startMoney: room.startMoney, maxPlayers: MAX_PLAYERS,
    debts: room.debts, auction: room.auction, trades: room.trades,
    housesLeft: room.housesLeft, hotelsLeft: room.hotelsLeft,
    log: room.log.slice(-60), chat: room.chat.slice(-60), lastCard: room.lastCard, now: Date.now(),
  };
}

module.exports = { createRoom, addPlayer, startGame, setStartMoney, handle, publicState, rentFor, BOARD, MAX_PLAYERS };
