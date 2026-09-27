  // Tool definitions the tutor sees, their implementations, and the server-side checks that turn
// the tutor's claims (evidence, actions) into state changes.
const G = require("../public/games");

const MAX_ROWS = 6;
const MAX_VALUES = 30;
const MIN_QUOTE_CHARS = 12;
const GAME_IDS = Object.keys(G.RULES);

const ROWS_SCHEMA = {
  type: "array",
  maxItems: MAX_ROWS,
  items: {
    type: "object",
    properties: {
      game: { type: "string", enum: GAME_IDS },
      size: { type: "integer", minimum: 0, maximum: G.MAX_SIZE },
    },
    required: ["game", "size"],
  },
};

const ANALYZE_TOOL = {
  name: "analyze_position",
  description:
    "Exact analysis of a position made of one or more rows. Returns each row's Nim value and its split into powers of two, how often each power appears, whether the position is balanced, and all winning moves. Use it before saying anything about a position. The result is for you: do not hand the student a move or value they are asked to find.",
  input_schema: {
    type: "object",
    properties: { rows: ROWS_SCHEMA },
    required: ["rows"],
  },
};

const VALUES_TOOL = {
  name: "nim_values",
  description:
    "Exact Nim values of one row for sizes 0..up_to under one rule. Use it to check a student's table of values.",
  input_schema: {
    type: "object",
    properties: {
      game: { type: "string", enum: GAME_IDS },
      up_to: { type: "integer", minimum: 0, maximum: MAX_VALUES },
    },
    required: ["game", "up_to"],
  },
};

function respondTool(def) {
  const criterionIds = (def.criteria || []).map((c) => c.id);
  const misconceptionIds = (def.likely || []).map((l) => (typeof l === "string" ? null : l.id)).filter(Boolean);
  const actionTypes = ["none"];
  if (def.boardRules) actionTypes.push("set_board");
  if (def.hints && def.hints.length) actionTypes.push("reveal_hint");
  if (def.widgets && def.widgets.length) actionTypes.push("show_widget");

  const properties = {
    reply: {
      type: "string",
      description: "The message the student sees. Short, friendly, B1-B2 English (or the student's language).",
    },
  };
  if (criterionIds.length) {
    properties.evidence = {
      type: "array",
      description: "Criteria the student has met in their own words. Leave empty if none.",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string", enum: criterionIds },
          quote: { type: "string", description: "Exact copy of the student's words." },
        },
        required: ["criterion", "quote"],
      },
    };
  }
  if (misconceptionIds.length) {
    properties.misconceptions = {
      type: "array",
      description: "Ids of likely ideas that came up in the student's latest message.",
      items: { type: "string", enum: misconceptionIds },
    };
  }
  if (actionTypes.length > 1) {
    properties.actions = {
      type: "array",
      maxItems: 2,
      description: "Changes to the page. Usually empty.",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: actionTypes },
          rows: { ...ROWS_SCHEMA, description: "For set_board: the new position." },
          widget: { type: "string", enum: def.widgets && def.widgets.length ? def.widgets : ["none"] },
        },
        required: ["type"],
      },
    };
  }

  return {
    name: "respond",
    description: "Send your reply to the student. Every turn ends with exactly one call to this tool.",
    input_schema: { type: "object", properties, required: ["reply"] },
  };
}

function toolsFor(def) {
  return [ANALYZE_TOOL, VALUES_TOOL, respondTool(def)];
}

function analyze(rows) {
  const piles = rows.map((r) => ({ game: r.game, size: r.size }));
  const perRow = piles.map((p, i) => {
    const value = G.nimValue(p.game, p.size);
    return {
      row: String.fromCharCode(65 + i),
      rule: G.RULES[p.game].label,
      size: p.size,
      nim_value: value,
      powers_of_two: G.powersOfTwo(value),
    };
  });
  const counts = {};
  for (const r of perRow) for (const p of r.powers_of_two) counts[p] = (counts[p] || 0) + 1;
  const balanced = G.positionValue(piles) === 0;
  return {
    rows: perRow,
    power_counts: counts,
    balanced,
    player_to_move: balanced ? "loses against perfect play" : "wins with a balancing move",
    winning_moves: G.winningMoves(piles).map((m) => ({
      row: String.fromCharCode(65 + m.pile),
      take: m.take,
      leaves: piles[m.pile].size - m.take,
    })),
  };
}

// `blockedGames`: rules this chat must not compute (their values are an exercise elsewhere).
// "Last stick loses" analysis for a single row of "take 1, 2 or 3".
function analyzeMisere(rows) {
  if (rows.length !== 1 || rows[0].game !== "take_1_2_3") {
    return { error: "in this chat only one row with the rule take 1, 2 or 3 can be analyzed" };
  }
  const piles = [{ game: rows[0].game, size: rows[0].size }];
  const loses = G.misereLoses(piles);
  return {
    rule: "take 1, 2 or 3; the player who takes the LAST stick LOSES",
    size: piles[0].size,
    player_to_move: loses ? "loses against perfect play" : "wins",
    winning_moves: G.winningMoves(piles, true).map((m) => ({ take: m.take, leaves: piles[0].size - m.take })),
  };
}

function makeRunner({ blockedGames = [], misere = false } = {}) {
  return function runTool(name, input) {
    if (name === "analyze_position") {
      const rows = Array.isArray(input.rows) ? input.rows.slice(0, MAX_ROWS) : [];
      if (rows.length === 0 || !rows.every(G.isValidPile)) return { error: "invalid rows" };
      if (rows.some((r) => blockedGames.includes(r.game))) return { error: "rule not available in this chat" };
      return misere ? analyzeMisere(rows) : analyze(rows);
    }
    if (name === "nim_values" && misere) {
      return { error: "Nim values are for games where the last stick wins. Use analyze_position here." };
    }
    if (name === "nim_values") {
      if (!GAME_IDS.includes(input.game)) return { error: "unknown rule" };
      if (blockedGames.includes(input.game)) return { error: "rule not available in this chat" };
      const upTo = Math.max(0, Math.min(MAX_VALUES, Number.parseInt(input.up_to, 10) || 0));
      const values = [];
      for (let n = 0; n <= upTo; n += 1) values.push(G.nimValue(input.game, n));
      return { rule: G.RULES[input.game].label, values };
    }
    return { error: `unknown tool ${name}` };
  };
}

// --- Evidence checks -------------------------------------------------------------------------

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[‘’“”«»"'`]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function integers(text) {
  return (String(text).match(/\d+/g) || []).map(Number);
}

function containsRun(list, run) {
  for (let i = 0; i + run.length <= list.length; i += 1) {
    if (run.every((v, j) => list[i + j] === v)) return true;
  }
  return false;
}

// Pairs like "5 → 3", "5: 3", "5 = 3", "5 has value 3" that a tutor message states.
function statedPairs(text) {
  const pairs = new Set();
  const patterns = [
    /\b(\d)(?:\s*matches)?\s*(?:→|->|:|=|is|gives|has)\s*(?:a\s+)?(?:nim\s+)?(?:value\s+)?(?:of\s+)?(\d)\b/gi,
    /\bvalue\s+(?:of|for)\s+(\d)(?:\s*matches)?\s*(?:is|=|:)\s*(\d)\b/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) pairs.add(`${m[1]}:${m[2]}`);
  }
  return pairs;
}

const LEAK_LIMIT = 2;

// The tutor gave away (confirmed or corrected) more than LEAK_LIMIT correct values of 2..9.
function tutorLeakedValues(tutorTexts) {
  const leaked = new Set();
  for (const t of tutorTexts) {
    for (const p of statedPairs(t)) {
      const [n, v] = p.split(":").map(Number);
      if (n >= 2 && n <= 9 && G.nimValue("take_1_3_4", n) === v) leaked.add(n);
    }
  }
  return leaked.size > LEAK_LIMIT;
}

/**
 * Checks a draft reply for giveaways the prompt alone does not stop. Returns a note for the
 * tutor to rewrite with, or null. Only the "values" exercise has one: any (size, value) pair.
 */
function replyProblem(def, reply) {
  if (def.guard !== "values_take_1_3_4") return null;
  const pairs = [...statedPairs(reply)].filter((p) => Number(p.split(":")[0]) >= 2);
  if (pairs.length === 0) return null;
  return `Your draft reply stated Nim values (${pairs.join(", ")}) for this rule. That gives the exercise away. Rewrite it without writing, confirming or correcting any value for 2 to 9 matches: ask the student to show which positions they can reach and which number is missing.`;
}

const EXTRA_CHECKS = {
  values_take_1_3_4(quote) {
    const target = [];
    for (let n = 0; n <= 9; n += 1) target.push(G.nimValue("take_1_3_4", n));
    const pairs = target.flatMap((v, n) => [n, v]);
    const nums = integers(quote);
    return containsRun(nums, target) || containsRun(nums, pairs);
  },
};

/**
 * Keeps only evidence the server can confirm: a known, not-yet-met quote criterion whose quote
 * appears verbatim (after normalizing case, spacing and quote marks) in a student message and
 * was not simply copied from an earlier tutor reply.
 */
function verifyEvidence({ def, evidence, history, alreadyMet, hintsShown = 0 }) {
  const openHints = (def.hints || []).slice(0, hintsShown).map(normalize);
  const studentTexts = history.filter((m) => m.role === "user").map((m) => normalize(m.content));
  const tutorTexts = history.filter((m) => m.role === "assistant").map((m) => normalize(m.content));
  const accepted = [];
  const rejected = [];

  for (const item of Array.isArray(evidence) ? evidence : []) {
    const criterion = (def.criteria || []).find((c) => c.id === item.criterion);
    if (!criterion || alreadyMet[criterion.id]) continue;
    if (criterion.kind === "win") {
      rejected.push({ criterion: criterion.id, why: "only a board win counts" });
      continue;
    }
    const quote = normalize(item.quote || "");
    if (quote.length < MIN_QUOTE_CHARS) {
      rejected.push({ criterion: criterion.id, why: "quote too short" });
      continue;
    }
    if (/\?\s*$/.test(quote)) {
      rejected.push({ criterion: criterion.id, why: "a question is not evidence" });
      continue;
    }
    if (!studentTexts.some((t) => t.includes(quote))) {
      rejected.push({ criterion: criterion.id, why: "quote not found in student messages" });
      continue;
    }
    if (tutorTexts.some((t) => t.includes(quote))) {
      rejected.push({ criterion: criterion.id, why: "quote repeats the tutor's words" });
      continue;
    }
    if (openHints.some((h) => h.includes(quote))) {
      rejected.push({ criterion: criterion.id, why: "quote copies a hint" });
      continue;
    }
    if (criterion.verify === "values_take_1_3_4" && tutorLeakedValues(tutorTexts)) {
      rejected.push({ criterion: criterion.id, why: "the tutor already gave the values away" });
      continue;
    }
    if (criterion.verify && !EXTRA_CHECKS[criterion.verify](item.quote)) {
      rejected.push({ criterion: criterion.id, why: "the stated values are not correct" });
      continue;
    }
    accepted.push({ criterion: criterion.id, quote: item.quote });
  }
  return { accepted, rejected };
}

// --- Page actions ----------------------------------------------------------------------------

function validateBoard(rows, boardRules) {
  if (!boardRules || !Array.isArray(rows)) return null;
  if (rows.length === 0 || rows.length > boardRules.maxPiles) return null;
  const ok = rows.every(
    (r) => G.isValidPile(r) && boardRules.games.includes(r.game) && r.size <= boardRules.maxSize,
  );
  if (!ok || rows.every((r) => r.size === 0)) return null;
  return rows.map((r) => ({ game: r.game, size: r.size }));
}

/** Filters the tutor's requested actions down to what this chat allows. */
function validateActions(def, actions) {
  const out = [];
  for (const a of Array.isArray(actions) ? actions.slice(0, 2) : []) {
    if (!a || typeof a !== "object") continue;
    if (a.type === "set_board") {
      const piles = validateBoard(a.rows, def.boardRules);
      if (piles) out.push({ type: "set_board", piles });
    } else if (a.type === "reveal_hint" && def.hints && def.hints.length) {
      out.push({ type: "reveal_hint" });
    } else if (a.type === "show_widget" && (def.widgets || []).includes(a.widget)) {
      out.push({ type: "show_widget", widget: a.widget });
    }
  }
  return out;
}

module.exports = { toolsFor, makeRunner, verifyEvidence, validateActions, replyProblem, normalize, analyze };
