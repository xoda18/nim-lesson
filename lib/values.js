// Server-side facts for the "values" exercise (Nim values of "take 1, 3 or 4" for 0..9).
// The tutor gets these facts every turn, so it never has to judge a value from memory.
const G = require("../public/games");

const GAME = "take_1_3_4";
const TOP = 9;
const TARGET = Array.from({ length: TOP + 1 }, (_, n) => G.nimValue(GAME, n));
const LEAK_LIMIT = 2;
const LEAKED_ALL = TOP + 1;
const MIN_LIST = 6;

const WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ноль: 0, нуль: 0, один: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6,
  семь: 7, восемь: 8, девять: 9,
};

function digitsFromWords(text) {
  return String(text)
    // "v(5)", "g(5)", "v5", "g_5" mean "the value of 5": keep just the size.
    .replace(/\b[a-z]{1,5}\s*\(\s*(\d)\s*\)/gi, "$1")
    .replace(/\b[vgn]_?(\d)\b/gi, "$1")
    .replace(/[a-zа-яё]+/gi, (w) => (w.toLowerCase() in WORDS ? String(WORDS[w.toLowerCase()]) : w));
}

function numbers(text) {
  return (digitsFromWords(text).match(/\d+/g) || []).map(Number);
}

function containsRun(list, run) {
  for (let i = 0; i + run.length <= list.length; i += 1) {
    if (run.every((v, j) => list[i + j] === v)) return true;
  }
  return false;
}

const LIST = String.raw`\d(?:\s*(?:,|and|и)?\s*\d)*`;

/** (size, value) claims in one text: "5 is 3", "5 -> 3", "value of 5 is 3", "reach 4, 2, 1 ... values 2, 0, 1". */
function pairsIn(text) {
  const t = digitsFromWords(text);
  const pairs = [];
  const single = [
    /\b(\d)(?:\s*(?:matches|спич\S*))?\s*(?:→|->|=>|:|=|is|gives|has|это|равн[оа]?|равен|даёт|дает)\s*(?:a\s+)?(?:nim\s+)?(?:value\s+)?(?:of\s+)?(\d)\b/gi,
    /\bvalue\s+(?:of|for)\s+(\d)(?:\s*matches)?\s*(?:is|=|:)\s*(\d)\b/gi,
  ];
  for (const re of single) {
    let m;
    while ((m = re.exec(t))) pairs.push([Number(m[1]), Number(m[2])]);
  }
  // Asides like "(take 1 or 3)" would break "reach 2, 0 ... values 0, 0" apart.
  const plain = t.replace(/\([^)]*\)/g, " ");
  const zipped = new RegExp(`(${LIST})[^\\d]{0,40}?(?:values?|значени\\S*)\\s*(?:are|is|:|=)?\\s*(${LIST})`, "gi");
  let m;
  while ((m = zipped.exec(plain))) {
    const sizes = numbers(m[1]);
    const vals = numbers(m[2]);
    if (sizes.length > 1 && sizes.length === vals.length) {
      const inRange = sizes.every((n) => n <= TOP);
      const sameSet = inRange && [...vals].sort().join() === sizes.map((n) => TARGET[n]).sort().join();
      sizes.forEach((n, i) => pairs.push([n, vals[i], sameSet]));
    }
  }
  return pairs.filter(([n, v]) => n <= TOP && v <= 9);
}

/** Sizes whose last claim came from a list of values that is right except for the order. */
function reorderedSizes(history) {
  const out = new Set();
  for (const msg of history) {
    if (msg.role !== "user") continue;
    for (const [n, v, sameSet] of pairsIn(msg.content)) {
      if (sameSet && TARGET[n] !== v) out.add(n);
      else out.delete(n);
    }
  }
  return out;
}

/** A plain list like "0 1 0 1 2 3 2" read as the values for sizes 0, 1, 2, ... */
function listIn(text) {
  const nums = numbers(text);
  if (nums.length < MIN_LIST || nums[0] !== 0 || nums.some((v) => v > 9)) return null;
  return nums.slice(0, TOP + 1);
}

/** Latest value the student has stated for each size, from pairs and plain lists. */
function studentClaims(history) {
  const claims = new Map();
  let carried = [];
  for (const msg of history) {
    if (msg.role !== "user") continue;
    const pairs = pairsIn(msg.content);
    const list = pairs.length ? null : listIn(msg.content);
    if (list) carried = list;
    else if (carried.length && carried.length <= TOP && numbers(msg.content).length <= TOP + 1 - carried.length) {
      // "0 1 0 1 2 3 2 0 1" followed by "0": the second message finishes the list.
      carried = [...carried, ...numbers(msg.content)].slice(0, TOP + 1);
    }
    if (!pairs.length) carried.forEach((v, n) => claims.set(n, v));
    for (const [n, v] of pairs) claims.set(n, v);
  }
  return claims;
}

const REASONING = /reach|go to|move|missing|mex|smallest|take|because|since|so |values? (?:are|of)|попад|перейти|ход|нет в списке|потому|значит/i;
const CONFIRM = new RegExp(
  [
    String.raw`^\W*(?:yes|yep|right|correct|exactly)\b`,
    String.raw`^[\s"'«]*(?:верно|да|правильно|точно)(?:$|[\s,.!])`,
    String.raw`\b(?:that|this|it)(?: one)?(?:'s| is)\s+(?:right|correct|spot on)`,
    String.raw`\b\d\s*(?:→|->|is)\s*\d\s+is\s+(?:right|correct)`,
    String.raw`\b\d\s+(?:is|looks)\s+(?:right|correct)`,
    String.raw`(?:^|[\s,.!])(?:это|так|да)[\s,]+(?:верно|правильно)`,
  ].join("|"),
  "i",
);

/** "is 6 -> 2?" with no work shown: a guess the tutor must not confirm. */
function bareGuess(text) {
  return /\?/.test(text) && pairsIn(text).length > 0 && !REASONING.test(text);
}

function fullTableGiven(history) {
  const nums = history.filter((m) => m.role === "user").flatMap((m) => numbers(m.content));
  if (containsRun(nums, TARGET) || containsRun(nums, TARGET.flatMap((v, n) => [n, v]))) return true;
  const claims = studentClaims(history);
  return TARGET.every((v, n) => claims.get(n) === v);
}

/**
 * How many correct values for 2..9 the tutor stated before the student did. A tutor reply that
 * contains the whole table before the student gave it counts as leaking everything.
 */
function leakCount(history) {
  const leaked = new Set();
  const before = [];
  for (const msg of history) {
    if (msg.role === "user") {
      before.push(msg);
      continue;
    }
    const last = before[before.length - 1];
    if (last && bareGuess(last.content) && CONFIRM.test(msg.content)) {
      for (const [n, v] of pairsIn(last.content)) if (n >= 2 && TARGET[n] === v) leaked.add(n);
    }
    const claimed = studentClaims(before);
    for (const [n, v] of pairsIn(msg.content)) {
      if (n >= 2 && TARGET[n] === v && claimed.get(n) !== v) leaked.add(n);
    }
    if (containsRun(numbers(msg.content), TARGET.slice(0, MIN_LIST + 1)) && !fullTableGiven(before)) return LEAKED_ALL;
  }
  return leaked.size;
}

function valuesCriterionMet(history) {
  return fullTableGiven(history) && leakCount(history) <= LEAK_LIMIT;
}

/** A draft reply that gives values away or states a wrong value. Returns a rewrite note or null. */
function replyProblem(reply, history) {
  const claimed = studentClaims(history);
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (lastUser && bareGuess(lastUser.content) && CONFIRM.test(reply)) {
    return "The student only guessed a value without any work. Do not confirm or correct it. Ask for one step: which sizes they can reach from it, the values of those, and which number is missing.";
  }
  const wrong = [];
  const leaks = [];
  for (const [n, v] of pairsIn(reply)) {
    if (TARGET[n] !== v) wrong.push(`${n} → ${v} (the correct value is ${TARGET[n]})`);
    else if (n >= 2 && claimed.get(n) !== v) leaks.push(`${n} → ${v}`);
  }
  const text = digitsFromWords(reply);
  const disputed = new Set();
  const praised = new Set();
  const disputeRes = [
    /(?:another look at|look at|check|recheck|double[- ]check)\s+(?:again\s+)?(?:at\s+)?(?:size\s+|position\s+|reaching\s+|the value (?:of|for)\s+)?(\d)\b/gi,
    /\b(\d)(?:'s value)?\s+(?:isn'?t|is not|looks wrong|looks off|is off|is wrong|is not right)/gi,
  ];
  for (const re of disputeRes) {
    let m;
    while ((m = re.exec(text))) disputed.add(Number(m[1]));
  }
  const praiseRe = /\b(\d)\s+(?:looks|is|seems)\s+(?:right|correct|fine|good)/gi;
  let pm;
  while ((pm = praiseRe.exec(text))) praised.add(Number(pm[1]));
  const falseDisputes = [...disputed].filter((n) => n <= TOP && claimed.get(n) === TARGET[n]);
  const falsePraise = [...praised].filter((n) => n <= TOP && claimed.has(n) && claimed.get(n) !== TARGET[n]);
  if (falseDisputes.length) {
    return `Your draft questions the student's value for ${falseDisputes.join(", ")}, but the STUDENT STATE shows it is right. Rewrite: say it is right.`;
  }
  if (falsePraise.length) {
    return `Your draft says the value for ${falsePraise.join(", ")} is right, but the STUDENT STATE marks it WRONG. Rewrite: point to that size without giving the value.`;
  }
  if (wrong.length) {
    return `Your draft states wrong values: ${wrong.join(", ")}. Check the STUDENT STATE and rewrite. If the student was right, say so.`;
  }
  if (leaks.length) {
    return `Your draft gives away values the student has not stated yet: ${leaks.join(", ")}. Rewrite it without them. You may confirm values the student has already given.`;
  }
  return null;
}

function stateLines(history) {
  const claims = studentClaims(history);
  const reordered = reorderedSizes(history);
  const verdict = (n, v) => {
    if (TARGET[n] === v) return "right";
    if (reordered.has(n)) return "the right values but maybe listed in a different order; ask which goes with which";
    return "WRONG";
  };
  const stated = [...claims.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, v]) => `${n} → ${v} (${verdict(n, v)})`);
  const moves = TARGET.map((_, n) => `${n}: ${G.takeOptions(GAME, n).map((k) => n - k).join(", ") || "none"}`);
  return [
    `- legal moves "take 1, 3 or 4", size: sizes you can reach (use this, do not work it out): ${moves.join(" | ")}`,
    `- correct values (private, never write them first): ${TARGET.join(", ")}`,
    `- values the student has stated: ${stated.length ? stated.join("; ") : "none yet"}`,
    `- full correct table given by the student: ${fullTableGiven(history) ? "yes" : "no"}`,
  ];
}

module.exports = { bareGuess, TARGET, pairsIn, studentClaims, fullTableGiven, leakCount, valuesCriterionMet, replyProblem, stateLines };
