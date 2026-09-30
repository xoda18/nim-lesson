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
    { role: "assistant", content: "Close: 5 → 3, 6 → 2, 7 → 0 and 8 → 1." },
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

const V = require("../lib/values");
const { replyProblem } = require("../lib/tools");
const { QA } = require("../lib/lesson");
const chat = (...msgs) => msgs.map((content, i) => ({ role: i % 2 ? "assistant" : "user", content }));

test("values: a table split over two messages counts at once", () => {
  assert.ok(V.valuesCriterionMet(chat("0 1 0 1 2 3 2 0 1", "You have 9 numbers, add one more.", "0")));
});

test("values: the tutor may confirm what the student said, not contradict or reveal it", () => {
  const h = chat("The value of 4 is 2 and 5 is 3");
  assert.strictEqual(replyProblem(EXERCISES.values, "Yes, 4 is 2 and 5 is 3.", h), null);
  assert.match(replyProblem(EXERCISES.values, "Check again: 4 is 1.", h), /wrong values/);
  assert.match(replyProblem(EXERCISES.values, "And 7 is 0.", h), /gives away/);
});

test("values: guessing with the tutor's help does not count", () => {
  const h = chat("is 5 -> 2 and 7 -> 3?", "5 is 3, 7 is 0 and 8 is 1.", "0 1 0 1 2 3 2 0 1 0");
  assert.strictEqual(V.valuesCriterionMet(h), false);
});

test("values: the order-mix-up is flagged as unclear, not wrong", () => {
  const lines = V.stateLines(chat("You can move to 4 2 1 with values 1 0 and 2")).join("\n");
  assert.match(lines, /different order/);
  assert.doesNotMatch(lines, /WRONG/);
});

test("values: number words and Russian count", () => {
  assert.ok(V.fullTableGiven(chat("zero one zero one two three two zero one zero")));
  assert.ok(V.fullTableGiven(chat("ноль один ноль один два три два ноль один ноль")));
});

test("page 3 questions chat: cannot reveal or analyse the 3-4-5 exercise", () => {
  assert.ok(replyProblem(QA.bouton, "Then you get 1, 4, 5, which is balanced.", []));
  assert.ok(replyProblem(QA.bouton, "Take 2 from the row of 3.", []));
  assert.strictEqual(replyProblem(QA.bouton, "Try it on 1, 2, 3 instead.", []), null);
  const run = makeRunner({ blockedPositions: QA.bouton.blockedPositions });
  assert.ok(run("analyze_position", { rows: [5, 3, 4].map((size) => ({ game: "nim", size })) }).error);
  assert.ok(!run("analyze_position", { rows: [1, 2, 3].map((size) => ({ game: "nim", size })) }).error);
});

test("values: labeled answers like v0=0, v(5)=3 keep their sizes", () => {
  const claims = V.studentClaims(chat("v0=0, v1=1, v2=0, v3=1, v4=2, v5=3. And g(6)=2"));
  assert.deepStrictEqual([...claims.entries()].sort((a, b) => a[0] - b[0]), [[0, 0], [1, 1], [2, 0], [3, 1], [4, 2], [5, 3], [6, 2]]);
  assert.doesNotMatch(V.stateLines(chat("my final answers are v3=1, v4=2, v5=3")).join(), /WRONG/);
});

test("values: a wrong value used inside the reasoning is marked wrong", () => {
  const lines = V.stateLines(chat("from 5 I reach 4, 2, 1 with values 0, 1, 2, so 5 is 3")).join("\n");
  assert.match(lines, /5 → 3 \(right\)/);
});

test("answer lists: the tutor cannot hand over 1, 5, 9 or 4, 8, 12 before the student says them", () => {
  const ask = chat("I took 3 sticks, 18 left, good move?");
  assert.ok(replyProblem(EXERCISES.boyard, "Look at the numbers 1, 5, 9, 13, 17.", ask));
  assert.ok(replyProblem(EXERCISES.take123, "Try to leave 4, 8, 12.", chat("no idea")));
  assert.strictEqual(replyProblem(EXERCISES.boyard, "Yes, 1, 5, 9, 13, 17 is it.", chat("I leave 1, 5, 9, 13 or 17")), null);
  assert.strictEqual(replyProblem(EXERCISES.take123, "You have 21 matches.", ask), null);
});

test("values: the tutor may not dispute a right value or praise a wrong one", () => {
  const h = chat("From 4 I can reach 3, 1, 0. Their values are v3=1, v1=1, v0=0. Final answer: v(4)=2.");
  assert.match(replyProblem(EXERCISES.values, "Have another look at 1. Its value isn't 1.", h), /is right/);
  const w = chat("4 has value 0, 2 has value 1, 1 has value 2 so 5 is 3");
  assert.match(replyProblem(EXERCISES.values, "Value for 4 looks right, but check 2 and 1.", w), /WRONG/);
  assert.strictEqual(replyProblem(EXERCISES.values, "Have another look at 4.", w), null);
});

test("values: a table built from scattered pairs over several turns counts, even after the tutor recaps it", () => {
  const h = chat(
    "v4=2, v7=0, v1=1",
    "Those three are right. What about the rest?",
    "v0=0, v2=0, v3=1, v5=3, v6=2, v8=1, v9=0",
    "So your full table is: 0, 1, 0, 1, 2, 3, 2, 0, 1, 0.",
    "so I'm done?",
  );
  assert.ok(V.valuesCriterionMet(h));
});

test("answer phrases: the rule in words is blocked until the student says it or the rule is met", () => {
  const ask = chat("Я взял 3 палочки, осталось 18. Хороший ход?");
  assert.ok(replyProblem(EXERCISES.boyard, "Это число на один больше кратного 4?", ask));
  assert.ok(replyProblem(EXERCISES.boyard, "Leave one more than a multiple of 4.", ask));
  assert.strictEqual(replyProblem(EXERCISES.boyard, "Leave one more than a multiple of 4.", ask, { rule: {} }), null);
  assert.ok(replyProblem(EXERCISES.take123, "Leave a multiple of 4.", chat("help")));
  assert.strictEqual(replyProblem(EXERCISES.take123, "Yes, a multiple of 4.", chat("I leave a multiple of 4")), null);
});

test("answer phrases: naming the rule after the student listed the numbers is fine", () => {
  assert.strictEqual(replyProblem(EXERCISES.take123, "Yes, multiples of 4.", chat("I leave 4, 8, 12")), null);
});

test("values: a bare guess is not confirmed, and confirmed guesses do not count", () => {
  assert.ok(replyProblem(EXERCISES.values, "Yes, 6 gives value 2. Nice!", chat("is 6 -> 2?")));
  assert.strictEqual(replyProblem(EXERCISES.values, "Yes, that's right.", chat("from 6 I reach 5, 3, 2 with values 3, 1, 0, so 6 is 2?")), null);
  const h = chat("is 6 -> 2?", "Yes!", "is 7 -> 0?", "Yes!", "is 5 -> 3?", "Right.", "0 1 0 1 2 3 2 0 1 0");
  assert.strictEqual(V.valuesCriterionMet(h), false);
});

test("values: other ways of confirming a bare guess are caught too", () => {
  for (const r of ["That one's right, but show the work.", "6 → 2 is correct.", "Это верно."]) {
    assert.ok(replyProblem(EXERCISES.values, r, chat("is 6 -> 2?")), r);
  }
});

test("values: Russian guesses are recognised", () => {
  const h = chat("6 это 2?");
  assert.ok(replyProblem(EXERCISES.values, "Верно! Молодец", h));
  assert.strictEqual(replyProblem(EXERCISES.values, "Давай проверим: куда можно попасть из 6?", h), null);
  assert.ok(V.fullTableGiven(chat("значение 0 равно 0, 1 равно 1, 2 равно 0, 3 равно 1, 4 равно 2, 5 равно 3, 6 равно 2, 7 равно 0, 8 равно 1, 9 равно 0")));
});
