const test = require("node:test");
const assert = require("node:assert");
const G = require("../public/games");
const { EXERCISES } = require("../lib/lesson");
const { verifyEvidence, validateActions, makeRunner, analyze } = require("../lib/tools");
const S = require("../lib/sessions");

test("nim values match the lesson's tables", () => {
  const v = (game, n) => Array.from({ length: n + 1 }, (_, i) => G.nimValue(game, i));
  assert.deepStrictEqual(v("take_1_2_3", 12), [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0]);
  assert.deepStrictEqual(v("take_1_3_4", 9), [0, 1, 0, 1, 2, 3, 2, 0, 1, 0]);
  assert.deepStrictEqual(v("nim", 7), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("1-3-5-7 is balanced and 3-4-5 has exactly one winning move", () => {
  const nim = (...sizes) => sizes.map((size) => ({ game: "nim", size }));
  assert.strictEqual(G.positionValue(nim(1, 3, 5, 7)), 0);
  assert.deepStrictEqual(G.winningMoves(nim(3, 4, 5)), [{ pile: 0, take: 2 }]);
});

test("star board: values 3,2,3 and three winning first moves", () => {
  const a = analyze(EXERCISES.star.board.start);
  assert.deepStrictEqual(a.rows.map((r) => r.nim_value), [3, 2, 3]);
  assert.strictEqual(a.balanced, false);
  assert.strictEqual(a.winning_moves.length, 3);
});

test("computer wins from a balanced start; student can win from 21", () => {
  const start = [{ game: "take_1_2_3", size: 21 }];
  let piles = start;
  const moves = [];
  while (!G.isOver(piles)) {
    const m = moves.length % 2 === 0 ? G.winningMoves(piles)[0] || G.computerMove(piles) : G.computerMove(piles);
    moves.push(m);
    piles = G.applyMove(piles, m);
  }
  assert.strictEqual(G.replayGame(start, moves, true).winner, "student");
});

test("replay rejects a forged computer move", () => {
  const start = [{ game: "take_1_2_3", size: 5 }];
  const forged = [{ pile: 0, take: 1 }, { pile: 0, take: 3 }, { pile: 0, take: 1 }];
  assert.strictEqual(G.replayGame(start, forged, true).ok, false);
});

const history = [
  { role: "user", content: "I think you should always leave a multiple of 4 to the other player." },
  { role: "assistant", content: "Nice! Why does that work every time?" },
];

test("evidence: verbatim student quote is accepted", () => {
  const { accepted } = verifyEvidence({
    def: EXERCISES.take123,
    evidence: [{ criterion: "rule", quote: "always leave a multiple of 4" }],
    history,
    alreadyMet: {},
  });
  assert.strictEqual(accepted.length, 1);
});

test("evidence: invented, too short, tutor-copied and unknown quotes are rejected", () => {
  const { accepted, rejected } = verifyEvidence({
    def: EXERCISES.take123,
    evidence: [
      { criterion: "reason", quote: "whatever they take I make it 4 together" },
      { criterion: "rule", quote: "4" },
      { criterion: "reason", quote: "why does that work every time" },
      { criterion: "win", quote: "always leave a multiple of 4" },
    ],
    history: [...history, { role: "user", content: "why does that work every time? no idea" }],
    alreadyMet: {},
  });
  assert.strictEqual(accepted.length, 0);
  assert.strictEqual(rejected.length, 3);
});

test("evidence: wrong values table is rejected even if quoted", () => {
  const h = [{ role: "user", content: "my values: 0, 1, 2, 3, 0, 1, 2, 3, 0, 1" }];
  const bad = verifyEvidence({ def: EXERCISES.values, evidence: [{ criterion: "values", quote: h[0].content }], history: h, alreadyMet: {} });
  assert.strictEqual(bad.accepted.length, 0);
  const g = [{ role: "user", content: "I got 0 1 0 1 2 3 2 0 1 0, it repeats" }];
  const good = verifyEvidence({ def: EXERCISES.values, evidence: [{ criterion: "values", quote: "0 1 0 1 2 3 2 0 1 0" }], history: g, alreadyMet: {} });
  assert.strictEqual(good.accepted.length, 1);
});

test("actions: only allowed games, sizes and widgets pass", () => {
  const out = validateActions(EXERCISES.take123, [
    { type: "set_board", rows: [{ game: "take_1_2_3", size: 5 }] },
    { type: "set_board", rows: [{ game: "nim", size: 5 }] },
  ]);
  assert.deepStrictEqual(out, [{ type: "set_board", piles: [{ game: "take_1_2_3", size: 5 }] }]);
  assert.deepStrictEqual(validateActions(EXERCISES.values, [{ type: "show_widget", widget: "binary_helper" }]), []);
  assert.deepStrictEqual(validateActions(EXERCISES.nim, [{ type: "eval", code: "x" }]), []);
});

test("tool runner blocks the exercise rule in other chats", () => {
  const run = makeRunner({ blockedGames: ["take_1_3_4"] });
  assert.ok(run("nim_values", { game: "take_1_3_4", up_to: 9 }).error);
  assert.ok(run("analyze_position", { rows: [{ game: "nim", size: 999 }] }).error);
  assert.deepStrictEqual(run("nim_values", { game: "take_1_2", up_to: 3 }).values, [0, 1, 2, 0]);
});

test("session: board win marks win criteria; tutor-set boards do not", () => {
  const s = S.create("star");
  const play = () => {
    while (!G.isOver(s.board.piles)) {
      const m = G.winningMoves(s.board.piles)[0] || { pile: s.board.piles.findIndex((p) => p.size > 0), take: 1 };
      S.playMove(s, m);
    }
  };
  S.setBoard(s, [{ game: "nim", size: 1 }], false);
  play();
  assert.strictEqual(s.criteria.win, undefined);
  S.setBoard(s, EXERCISES.star.board.start, true);
  play();
  assert.ok(s.criteria.win);
  assert.strictEqual(s.resolved, false, "explain criterion still missing");
});

test("evidence: copying an opened hint does not count; the same words before opening it do", () => {
  const hint = EXERCISES.take123.hints[2];
  const h = [{ role: "user", content: hint }];
  const ev = [{ criterion: "rule", quote: "always leave your opponent 4, 8, 12, 16 or 20 matches" }];
  assert.strictEqual(verifyEvidence({ def: EXERCISES.take123, evidence: ev, history: h, alreadyMet: {}, hintsShown: 3 }).accepted.length, 0);
  assert.strictEqual(verifyEvidence({ def: EXERCISES.take123, evidence: ev, history: h, alreadyMet: {}, hintsShown: 0 }).accepted.length, 1);
});

test("evidence: values do not count once the tutor has given most of them away", () => {
  const h = [
    { role: "user", content: "is it 5 -> 2, 6 -> 2, 7 -> 3?" },
    { role: "assistant", content: "Close: 5 → 3, 6 → 2 and 7 → 0." },
    { role: "user", content: "ok so 0 1 0 1 2 3 2 0 1 0" },
  ];
  const ev = [{ criterion: "values", quote: "0 1 0 1 2 3 2 0 1 0" }];
  assert.strictEqual(verifyEvidence({ def: EXERCISES.values, evidence: ev, history: h, alreadyMet: {} }).accepted.length, 0);
});

test("evidence: a question is not evidence", () => {
  const h = [{ role: "user", content: "I took 2, now it is 1, 4, 5. Is this balanced?" }];
  const { accepted } = verifyEvidence({
    def: EXERCISES.nim,
    evidence: [{ criterion: "reason", quote: "now it is 1, 4, 5. Is this balanced?" }],
    history: h,
    alreadyMet: {},
  });
  assert.strictEqual(accepted.length, 0);
});

test("fort boyard: misère losing positions are 1, 5, 9, ...; 21 loses for the starter", () => {
  const lose = (n) => G.misereLoses([{ game: "take_1_2_3", size: n }]);
  assert.deepStrictEqual([1, 2, 5, 9, 17, 20, 21].map(lose), [true, false, true, true, true, false, true]);
  assert.deepStrictEqual(G.winningMoves([{ game: "take_1_2_3", size: 20 }], true), [{ pile: 0, take: 3 }]);
});

test("fort boyard: the computer always wins from 21, and the winner is the one who did NOT take the last stick", () => {
  const s = S.create("boyard");
  while (!G.isOver(s.board.piles)) S.playMove(s, { pile: 0, take: 1 });
  assert.strictEqual(s.criteria.verdict, undefined);
  S.setBoard(s, [{ game: "take_1_2_3", size: 6 }], false);
  assert.ok(s.board.misere, "tutor-set boards keep the misère rule");
  const r = S.playMove(s, { pile: 0, take: 1 }); // leaves 5: computer must lose
  let last = r;
  while (!G.isOver(s.board.piles)) {
    const m = G.winningMoves(s.board.piles, true)[0] || { pile: 0, take: 1 };
    last = S.playMove(s, m);
  }
  assert.strictEqual(last.winner, "student");
});
