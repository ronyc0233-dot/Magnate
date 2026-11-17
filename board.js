// Tablero de "Magnate": 40 casillas con nombres propios (ciudades latinoamericanas).
// type: go | prop | rail | util | tax | chance | chest | jail | parking | gotojail
const P = (name, group, price, rent, house) => ({ type: 'prop', name, group, price, rent, house });
const R = (name) => ({ type: 'rail', name, price: 200 });
const U = (name) => ({ type: 'util', name, price: 150 });

const BOARD = [
  { type: 'go', name: 'Salida' },
  P('Potosí', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { type: 'chest', name: 'Fondo Común' },
  P('Oruro', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { type: 'tax', name: 'Impuesto a la Renta', amount: 200 },
  R('Terminal de Buses'),
  P('Cuenca', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  { type: 'chance', name: 'Sorpresa' },
  P('Arequipa', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  P('Cusco', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50),
  { type: 'jail', name: 'Cárcel / Visita' },
  P('Valparaíso', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  U('Empresa de Luz'),
  P('Rosario', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  P('Córdoba', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  R('Estación del Tren'),
  P('Medellín', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { type: 'chest', name: 'Fondo Común' },
  P('Cali', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  P('Guadalajara', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { type: 'parking', name: 'Descanso' },
  P('Montevideo', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { type: 'chance', name: 'Sorpresa' },
  P('Quito', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  P('La Paz', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  R('Puerto Marítimo'),
  P('Santiago', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  P('Lima', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  U('Acueducto'),
  P('Bogotá', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { type: 'gotojail', name: 'Ve a la Cárcel' },
  P('Caracas', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  P('Panamá', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { type: 'chest', name: 'Fondo Común' },
  P('Monterrey', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  R('Aeropuerto'),
  { type: 'chance', name: 'Sorpresa' },
  P('Buenos Aires', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { type: 'tax', name: 'Impuesto de Lujo', amount: 100 },
  P('Ciudad de México', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

const GROUP_COLORS = {
  brown: '#8b5a2b', lightblue: '#7fd3f7', pink: '#d63384', orange: '#f28c28',
  red: '#e03131', yellow: '#f5d00f', green: '#2f9e44', darkblue: '#1c4fd1',
};

// Tarjetas propias. kind: money | moveTo | moveBack | jail | jailFree | payEach | collectEach | repairs | nearestRail | nearestUtil
const CHANCE = [
  { text: 'Avanza hasta la Salida y cobra $200.', kind: 'moveTo', to: 0 },
  { text: 'Viaja a La Paz. Si pasas por la Salida cobra $200.', kind: 'moveTo', to: 24 },
  { text: 'Viaja a Valparaíso. Si pasas por la Salida cobra $200.', kind: 'moveTo', to: 11 },
  { text: 'Avanza al transporte más cercano. Si tiene dueño, paga el doble del alquiler.', kind: 'nearestRail' },
  { text: 'Avanza al transporte más cercano. Si tiene dueño, paga el doble del alquiler.', kind: 'nearestRail' },
  { text: 'Avanza al servicio más cercano. Si tiene dueño, paga 10 veces los dados.', kind: 'nearestUtil' },
  { text: 'El banco te paga un dividendo de $50.', kind: 'money', amount: 50 },
  { text: 'Sales libre de la cárcel. Guarda esta tarjeta.', kind: 'jailFree' },
  { text: 'Retrocede 3 casillas.', kind: 'moveBack', n: 3 },
  { text: '¡Ve directo a la cárcel! No pasas por la Salida.', kind: 'jail' },
  { text: 'Reparaciones generales: paga $25 por casa y $100 por hotel.', kind: 'repairs', house: 25, hotel: 100 },
  { text: 'Multa por exceso de velocidad: paga $15.', kind: 'money', amount: -15 },
  { text: 'Toma un vuelo al Aeropuerto. Si pasas por la Salida cobra $200.', kind: 'moveTo', to: 35 },
  { text: 'Viaja a Ciudad de México.', kind: 'moveTo', to: 39 },
  { text: 'Te eligen presidente de la junta: paga $50 a cada jugador.', kind: 'payEach', amount: 50 },
  { text: 'Tu préstamo de construcción vence: cobra $150.', kind: 'money', amount: 150 },
];

const CHEST = [
  { text: 'Avanza hasta la Salida y cobra $200.', kind: 'moveTo', to: 0 },
  { text: 'Error del banco a tu favor: cobra $200.', kind: 'money', amount: 200 },
  { text: 'Consulta médica: paga $50.', kind: 'money', amount: -50 },
  { text: 'Vendes unas acciones: cobra $50.', kind: 'money', amount: 50 },
  { text: 'Sales libre de la cárcel. Guarda esta tarjeta.', kind: 'jailFree' },
  { text: '¡Ve directo a la cárcel! No pasas por la Salida.', kind: 'jail' },
  { text: 'Vence tu fondo de vacaciones: cobra $100.', kind: 'money', amount: 100 },
  { text: 'Devolución de impuestos: cobra $20.', kind: 'money', amount: 20 },
  { text: 'Es tu cumpleaños: cobra $10 de cada jugador.', kind: 'collectEach', amount: 10 },
  { text: 'Vence tu seguro de vida: cobra $100.', kind: 'money', amount: 100 },
  { text: 'Cuenta del hospital: paga $100.', kind: 'money', amount: -100 },
  { text: 'Matrícula del colegio: paga $50.', kind: 'money', amount: -50 },
  { text: 'Cobras $25 por asesoría.', kind: 'money', amount: 25 },
  { text: 'Arreglos de calles: paga $40 por casa y $115 por hotel.', kind: 'repairs', house: 40, hotel: 115 },
  { text: 'Ganas el segundo premio de belleza: cobra $10.', kind: 'money', amount: 10 },
  { text: 'Recibes una herencia: cobra $100.', kind: 'money', amount: 100 },
];

module.exports = { BOARD, GROUP_COLORS, CHANCE, CHEST };
