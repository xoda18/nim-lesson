// In-memory chat sessions. All state the tutor relies on (history, criteria, board, hints)
// lives here, so a client cannot forge an earlier tutor message or a win.
const crypto = require("crypto");
const G = require("../public/games");
const { EXERCISES, QA } = require("./lesson");

const MAX_SESSIONS = 2000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const RECENT_MOVES = 4;

const sessions = new Map();

const own = (obj, key) => (Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null);

function definition(chat) {
  return own(EXERCISES, chat) || own(QA, chat);
}

function freshBoard(start, misere = false) {
  return { start, piles: start, misere, moves: [], recent: [], lastMover: null, isExercise: true };
}

function create(chat) {
  const def = definition(chat);
  if (!def) return null;
  prune();
  const id = crypto.randomUUID();
  const session = {
    id,
    chat,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    history: [],
    criteria: {},
    resolved: false,
    hintsShown: 0,
    turnsWithoutProgress: 0,
    misconceptions: new Set(),
    widgets: new Set(),
    wins: 0,
    busy: false,
    chatCount: 0,
    board: def.board ? freshBoard(def.board.start, Boolean(def.board.misere)) : null,
  };
  sessions.set(id, session);
  return session;
}

// Re-inserting keeps the Map in least-recently-used order, so prune() evicts idle sessions first.
function get(id) {
  const s = typeof id === "string" ? sessions.get(id) : undefined;
  if (!s) return null;
  s.lastUsed = Date.now();
  sessions.delete(id);
  sessions.set(id, s);
  return s;
}

function prune() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.lastUsed > SESSION_TTL_MS) sessions.delete(id);
  while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
}

function rowName(i) {
  return `row ${String.fromCharCode(65 + i)}`;
}

function markCriterion(session, id, how) {
  if (session.criteria[id]) return false;
  session.criteria[id] = { how };
  return true;
}

function updateResolved(session) {
  const def = own(EXERCISES, session.chat);
  if (!def || session.resolved) return false;
  if (def.criteria.every((c) => session.criteria[c.id])) {
    session.resolved = true;
    return true;
  }
  return false;
}

/** Student move; the computer answers at once. Returns what the page needs to redraw. */
function playMove(session, move) {
  const b = session.board;
  if (!b) return { error: "no board in this chat" };
  if (G.isOver(b.piles)) return { error: "the game is over" };
  const pile = Number(move && move.pile);
  const take = Number(move && move.take);
  const next = G.applyMove(b.piles, { pile, take });
  if (!next) return { error: "illegal move" };

  b.piles = next;
  b.moves.push({ pile, take });
  b.lastMover = "student";
  const log = [`student took ${take} from ${rowName(pile)}`];

  let computer = null;
  if (!G.isOver(b.piles)) {
    computer = G.computerMove(b.piles, b.misere);
    b.piles = G.applyMove(b.piles, computer);
    b.moves.push(computer);
    b.lastMover = "computer";
    log.push(`computer took ${computer.take} from ${rowName(computer.pile)}`);
  }
  b.recent = [...b.recent, ...log].slice(-RECENT_MOVES);

  const over = G.isOver(b.piles);
  // Normal play: whoever took the last stick wins. Misère: whoever took it loses.
  const otherSide = b.lastMover === "student" ? "computer" : "student";
  const winner = over ? (b.misere ? otherSide : b.lastMover) : null;
  let newlyResolved = false;

  if (over && winner === "student" && b.isExercise) {
    const replay = G.replayGame(b.start, b.moves, true, b.misere);
    if (replay.ok && replay.winner === "student") {
      session.wins += 1;
      const def = own(EXERCISES, session.chat);
      let progressed = false;
      for (const c of def ? def.criteria : []) {
        if (c.kind === "win" || c.kind === "quote_or_win") {
          progressed = markCriterion(session, c.id, "won a game on the board") || progressed;
        }
      }
      if (progressed) session.turnsWithoutProgress = 0;
      newlyResolved = updateResolved(session);
    }
  }
  return { piles: b.piles, computer, over, winner, newlyResolved };
}

function setBoard(session, piles, isExercise) {
  const misere = Boolean(session.board && session.board.misere);
  session.board = { ...freshBoard(piles, misere), isExercise };
  return session.board;
}

module.exports = { own, create, get, definition, playMove, setBoard, markCriterion, updateResolved };
