// Nim & Sprague-Grundy lesson. Zero dependencies: node server.js
// Env: ANTHROPIC_API_KEY (required for chat), ANTHROPIC_MODEL (default claude-sonnet-5), PORT (4322).
const http = require("http");
const fs = require("fs");
const path = require("path");

const { EXERCISES, QA } = require("./lib/lesson");
const { staticPrompt, statePrompt } = require("./lib/prompts");
const { toolsFor, makeRunner, verifyEvidence, validateActions, replyProblem } = require("./lib/tools");
const { runTurn } = require("./lib/llm");
const S = require("./lib/sessions");
const V = require("./lib/values");
const { createLimiter } = require("./lib/ratelimit");
const G = require("./public/games");

const PORT = Number(process.env.PORT) || 4322;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_CHARS = 2000;
const MAX_CHAT_TURNS = 40;
const LOG_USAGE = process.env.LOG_USAGE === "1";
const SESSIONS_PER_IP_HOUR = Number(process.env.SESSIONS_PER_IP_HOUR) || 60;
const CHATS_PER_IP_HOUR = Number(process.env.CHATS_PER_IP_HOUR) || 150;
const allowSession = createLimiter(SESSIONS_PER_IP_HOUR);
const allowChat = createLimiter(CHATS_PER_IP_HOUR);

function clientIp(req) {
  return req.socket.remoteAddress || "unknown";
}

// Rules whose values are the point of an exercise elsewhere: those chats may not compute them.
const BLOCKED_GAMES = Object.freeze({ __proto__: null, grundy: ["take_1_3_4"], bouton: ["take_1_3_4"], take123: ["take_1_3_4"], boyard: ["take_1_3_4"], nim: ["take_1_3_4"] });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let tooLarge = false;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) tooLarge = true;
      if (!tooLarge) chunks.push(c);
    });
    req.on("end", () => {
      if (tooLarge) return reject(Object.assign(new Error("body too large"), { status: 413 }));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function publicState(session, extra = {}) {
  const def = S.definition(session.chat);
  return {
    sessionId: session.id,
    resolved: session.resolved,
    criteria: Object.keys(session.criteria),
    hintsShown: session.hintsShown,
    board: session.board ? { piles: session.board.piles, over: G.isOver(session.board.piles) } : null,
    successText: def.successText || null,
    ...extra,
  };
}

// --- Handlers -----------------------------------------------------------------------------

function handleConfig(res) {
  const out = {};
  for (const [id, ex] of Object.entries(EXERCISES)) {
    out[id] = { hints: ex.hints, board: ex.board, successText: ex.successText };
  }
  for (const id of Object.keys(QA)) out[id] = { hints: [], board: null };
  send(res, 200, out);
}

function handleSession(body, res, req) {
  if (!allowSession(clientIp(req))) return send(res, 429, { error: "too many new chats, try again later" });
  const session = S.create(String(body.chat || ""));
  if (!session) return send(res, 400, { error: "unknown chat" });
  send(res, 200, publicState(session));
}

function requireSession(body, res) {
  const session = S.get(body.sessionId);
  if (!session) {
    send(res, 404, { error: "session expired, reload the page" });
    return null;
  }
  return session;
}

function handleMove(body, res) {
  const session = requireSession(body, res);
  if (!session) return;
  const result = S.playMove(session, body.move);
  if (result.error) return send(res, 400, { error: result.error });
  send(res, 200, { ...publicState(session), move: result });
}

function handleReset(body, res) {
  const session = requireSession(body, res);
  if (!session) return;
  const def = S.definition(session.chat);
  if (!def.board) return send(res, 400, { error: "no board in this chat" });
  S.setBoard(session, def.board.start, true);
  send(res, 200, publicState(session));
}

function handleHint(body, res) {
  const session = requireSession(body, res);
  if (!session) return;
  const def = S.definition(session.chat);
  const total = (def.hints || []).length;
  if (session.hintsShown < total) session.hintsShown += 1;
  send(res, 200, publicState(session));
}

async function handleChat(body, res, req) {
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 500, { error: "ANTHROPIC_API_KEY is not set" });
  const session = requireSession(body, res);
  if (!session) return;
  if (!allowChat(clientIp(req))) return send(res, 429, { error: "too many messages, try again later" });

  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) return send(res, 400, { error: "empty message" });
  if (text.length > MAX_MESSAGE_CHARS) return send(res, 400, { error: "message too long" });
  if (session.chatCount >= MAX_CHAT_TURNS) return send(res, 429, { error: "this chat is full, reload the page to start again" });
  if (session.busy) return send(res, 409, { error: "wait for the previous reply" });

  session.busy = true;
  session.chatCount += 1;
  const def = S.definition(session.chat);
  const history = [...session.history, { role: "user", content: text }];

  try {
    const turn = (note) =>
      runTurn({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: MODEL,
        staticSystem: staticPrompt(session.chat),
        stateSystem: statePrompt(session.chat, session, history) + (note ? `\n\nCORRECTION: ${note}` : ""),
        history,
        tools: toolsFor(def),
        runTool: makeRunner({
          blockedGames: BLOCKED_GAMES[session.chat] || [],
          blockedPositions: def.blockedPositions || [],
          misere: Boolean(def.board && def.board.misere),
        }),
      });
    // Checked before the tutor answers, so a correct table is never met with "how did you get it?".
    let progressedBefore = false;
    if (def.guard === "values_take_1_3_4" && V.valuesCriterionMet(history)) {
      progressedBefore = S.markCriterion(session, "values", "the student gave the full correct table");
      S.updateResolved(session);
    }

    const auto = def.autoCriterion;
    if (auto && session.criteria[auto.after] && !session.criteria[auto.id] && auto.all.every((re) => re.test(text))) {
      progressedBefore = S.markCriterion(session, auto.id, `student wrote: "${text.slice(0, 120)}"`) || progressedBefore;
      S.updateResolved(session);
    }

    let { respond, usage, toolCalls } = await turn();
    const problem = replyProblem(def, String(respond.reply || ""), history, session.criteria);
    if (problem) {
      ({ respond, usage, toolCalls } = await turn(problem));
      if (replyProblem(def, String(respond.reply || ""), history, session.criteria)) {
        const guessed = def.guard === "values_take_1_3_4" && V.bareGuess(text);
        respond = {
          ...respond,
          reply: guessed
            ? "Show me how you got it. From that size, which sizes can you reach, what are their values, and which number is missing?"
            : "Let me make sure I follow. Which size are you working on right now, and what do you get for it?",
        };
      }
    }
    if (LOG_USAGE) console.log(JSON.stringify({ chat: session.chat, usage, toolCalls: toolCalls.map((t) => t.name) }));

    const raw = typeof respond.reply === "string" && respond.reply.trim() ? respond.reply.trim() : "Sorry, could you say that again?";
    const reply = raw
      .replace(/\s*[—–]\s*/g, ", ")
      .replace(/\s+--\s+/g, ", ")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/^, /, "")
      .replace(/^(?:good|great|excellent)\s+(?:question|catch|point|thing|idea)(?:\s+to\s+\w+)?[!.,]\s+/i, "")
      .replace(/""(\s*)$/, '"$1')
      .replace(/^./, (c) => c.toUpperCase());
    session.history = [...history, { role: "assistant", content: reply }];

    const { accepted, rejected } = verifyEvidence({
      def,
      evidence: respond.evidence,
      history,
      alreadyMet: session.criteria,
      hintsShown: session.hintsShown,
    });
    let progressed = progressedBefore;
    for (const a of accepted) progressed = S.markCriterion(session, a.criterion, `student wrote: "${a.quote}"`) || progressed;
    session.turnsWithoutProgress = progressed ? 0 : session.turnsWithoutProgress + 1;
    const newlyResolved = S.updateResolved(session) || (progressedBefore && session.resolved);

    const known = new Set((def.likely || []).map((l) => l.id).filter(Boolean));
    for (const m of Array.isArray(respond.misconceptions) ? respond.misconceptions : []) {
      if (known.has(m)) session.misconceptions.add(m);
    }

    const actions = validateActions(def, respond.actions);
    for (const a of actions) {
      if (a.type === "set_board") S.setBoard(session, a.piles, false);
      if (a.type === "reveal_hint" && session.hintsShown < def.hints.length) session.hintsShown += 1;
      if (a.type === "show_widget") session.widgets.add(a.widget);
    }

    send(res, 200, {
      ...publicState(session),
      reply,
      newlyResolved,
      actions,
      debug: process.env.DEBUG_EVIDENCE === "1" ? { accepted, rejected, toolCalls } : undefined,
    });
  } catch (err) {
    session.chatCount -= 1;
    console.error("chat error:", err.message, err.detail || "");
    send(res, 502, { error: "The tutor is not available right now. Please try again." });
  } finally {
    session.busy = false;
  }
}

// --- Static files -----------------------------------------------------------------------

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
}

const ROUTES = {
  "/api/session": handleSession,
  "/api/move": handleMove,
  "/api/reset": handleReset,
  "/api/hint": handleHint,
  "/api/chat": handleChat,
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/config") return handleConfig(res);
    const route = ROUTES[req.url];
    if (req.method === "POST" && route) {
      const body = await readJson(req);
      return await route(body, res, req);
    }
    if (req.method === "GET") return serveStatic(req, res);
    res.writeHead(405);
    res.end();
  } catch (err) {
    send(res, err.status || 500, { error: err.status ? err.message : "server error" });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Nim lesson running at http://localhost:${PORT} (model: ${MODEL})`);
    if (!process.env.ANTHROPIC_API_KEY) console.warn("Warning: ANTHROPIC_API_KEY is not set, the chat will not work.");
  });
}

module.exports = { server };
