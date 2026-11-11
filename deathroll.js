require('dotenv').config();

const tmi = require('tmi.js');
const { randomInt } = require('crypto');

// ⚙️ CONFIG
// Lee un número del .env; si no existe o es inválido, usa el valor por defecto
function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.warn(`⚠️ ${name}="${raw}" no es válido, usando ${fallback}`);
    return fallback;
  }
  return n;
}

const CONFIG = {
  DEFAULT_VALUE: envInt('DEFAULT_VALUE', 1000),
  MIN_VALUE: envInt('MIN_VALUE', 100),
  MAX_VALUE: envInt('MAX_VALUE', 1_000_000),
  TURN_TIME: envInt('TURN_TIME', 25) * 1000, // en segundos
  JOIN_TIME: envInt('JOIN_TIME', 35) * 1000, // en segundos
  JOIN_REMINDER: envInt('JOIN_REMINDER', 20) * 1000 // en segundos
};

// Coherencia entre valores
if (CONFIG.MIN_VALUE > CONFIG.MAX_VALUE) {
  console.error('MIN_VALUE no puede ser mayor que MAX_VALUE');
  process.exit(1);
}
if (CONFIG.DEFAULT_VALUE < CONFIG.MIN_VALUE || CONFIG.DEFAULT_VALUE > CONFIG.MAX_VALUE) {
  console.error('DEFAULT_VALUE debe estar entre MIN_VALUE y MAX_VALUE');
  process.exit(1);
}
if (CONFIG.JOIN_REMINDER >= CONFIG.JOIN_TIME) {
  console.error('JOIN_REMINDER debe ser menor que JOIN_TIME');
  process.exit(1);
}

const { BOT_USERNAME, TWITCH_OAUTH, CHANNEL_NAME } = process.env;
if (!BOT_USERNAME || !TWITCH_OAUTH || !CHANNEL_NAME) {
  console.error('Faltan variables de entorno: BOT_USERNAME, TWITCH_OAUTH, CHANNEL_NAME');
  process.exit(1);
}

const client = new tmi.Client({
  options: { debug: false }, // pon true solo mientras desarrollas
  connection: { reconnect: true, secure: true },
  identity: { username: BOT_USERNAME, password: TWITCH_OAUTH },
  channels: [CHANNEL_NAME]
});

client.on('connected', (addr, port) => console.log(`Conectado a ${addr}:${port}`));
client.on('disconnected', reason => console.log('Desconectado:', reason));
client.on('reconnect', () => console.log('Reconectando...'));

client.connect().catch(err => console.error('Error al conectar:', err));

// 🎲 ESTADO
const createGame = () => ({
  active: false,
  channel: null,
  p1: null,
  p2: null,
  turn: null,
  value: CONFIG.DEFAULT_VALUE
});

let game = createGame();

// Todos los timers en un solo lugar (así ninguno queda "huérfano")
const timers = { turn: null, join: null, reminder: null };

function clearTimers() {
  for (const key of Object.keys(timers)) {
    clearTimeout(timers[key]);
    timers[key] = null;
  }
}

function resetGame() {
  clearTimers();
  game = createGame();
}

const say = msg => client.say(game.channel ?? `#${CHANNEL_NAME}`, msg);

// ⏱️ TIMER DE TURNO
function startTurnTimer() {
  clearTimeout(timers.turn);

  timers.turn = setTimeout(() => {
    if (!game.active) return;

    const loser = game.turn;
    const winner = loser === game.p1 ? game.p2 : game.p1;

    say(`💀 ${loser} no usó !roll a tiempo... PERDIÓ. 🏆 Gana ${winner}`);
    resetGame();
  }, CONFIG.TURN_TIME);
}

function nextTurnMessage() {
  say(`➡️ Turno de ${game.turn} (1-${game.value}) — usa !roll 🎲`);
  startTurnTimer();
}

// 🎮 COMANDOS
const commands = {
  deathroll(user, args, channel) {
    if (game.active) {
      return client.say(channel, '⚠️ Ya hay un Deathroll en curso');
    }

    let startValue = CONFIG.DEFAULT_VALUE;

    if (args[0] !== undefined) {
      // /^\d+$/ evita casos como "100abc" que parseInt aceptaría
      if (!/^\d+$/.test(args[0])) {
        return client.say(channel, '❌ Usa un número válido. Ej: !deathroll 500');
      }

      startValue = Number(args[0]);

      if (startValue < CONFIG.MIN_VALUE || startValue > CONFIG.MAX_VALUE) {
        return client.say(
          channel,
          `❌ El número debe estar entre ${CONFIG.MIN_VALUE} y ${CONFIG.MAX_VALUE}`
        );
      }
    }

    game = {
      active: true,
      channel,
      p1: user,
      p2: null,
      turn: user,
      value: startValue
    };

    const joinSecs = CONFIG.JOIN_TIME / 1000;
    const remaining = Math.round((CONFIG.JOIN_TIME - CONFIG.JOIN_REMINDER) / 1000);

    say(`🎲 ${user} inició Death Roll (${startValue}). Únete con !join (${joinSecs}s)`);

    timers.reminder = setTimeout(() => {
      if (game.active && !game.p2) {
        say(`⏳ Últimos ${remaining}s para unirse al Deathroll`);
      }
    }, CONFIG.JOIN_REMINDER);

    timers.join = setTimeout(() => {
      if (game.active && !game.p2) {
        say('❌ Deathroll cancelado por falta de jugadores');
        resetGame();
      }
    }, CONFIG.JOIN_TIME);
  },

  join(user, _args, channel) {
    if (!game.active) {
      return client.say(channel, '❌ No hay partida activa');
    }
    if (user === game.p1) {
      return client.say(channel, '❌ No puedes jugar contra ti mismo');
    }
    if (game.p2) {
      return client.say(channel, '⚠️ Ya hay dos jugadores');
    }

    game.p2 = user;

    // Ya no se necesitan los timers de espera
    clearTimeout(timers.join);
    clearTimeout(timers.reminder);
    timers.join = timers.reminder = null;

    // Un solo mensaje en lugar de dos (menos riesgo de rate limit)
    say(`⚔️ ${user} vs ${game.p1} | Turno de ${game.turn} (1-${game.value}) — usa !roll 🎲`);
    startTurnTimer();
  },

  roll(user, _args, channel) {
    // Sin partida: se ignora en silencio para no hacer spam en el chat
    if (!game.active) return;

    if (!game.p2) {
      return client.say(channel, '⏳ Esperando a otro jugador... usa !join');
    }

    // Solo los jugadores reciben respuesta; el resto del chat se ignora
    if (user !== game.p1 && user !== game.p2) return;

    if (user !== game.turn) {
      return client.say(channel, `⏳ ${user}, no es tu turno (${game.turn})`);
    }

    clearTimeout(timers.turn);

    // crypto.randomInt: aleatorio uniforme y no predecible
    const roll = randomInt(1, game.value + 1);

    if (roll === 1) {
      const winner = user === game.p1 ? game.p2 : game.p1;
      say(`🎲 ${user} tiró → 1 | 💀 ${user} PERDIÓ. 🏆 Gana ${winner}`);
      resetGame();
      return;
    }

    game.value = roll;
    game.turn = user === game.p1 ? game.p2 : game.p1;

    say(`🎲 ${user} tiró → ${roll} | ➡️ Turno de ${game.turn} (1-${game.value}) — usa !roll`);
    startTurnTimer();
  },

  // Solo mods o broadcaster
  cancel(_user, _args, channel, tags) {
    if (!game.active) return;

    const isMod = tags.mod || tags.badges?.broadcaster === '1';
    if (!isMod) return;

    client.say(channel, '🛑 Deathroll cancelado por un moderador');
    resetGame();
  }
};

// 💬 MENSAJES
client.on('message', (channel, tags, message, self) => {
  if (self || !message.startsWith('!')) return; // descarta rápido lo que no es comando

  const [cmd, ...args] = message.trim().toLowerCase().split(/\s+/);
  const handler = commands[cmd.slice(1)];

  if (handler) handler(tags.username, args, channel, tags);
});
