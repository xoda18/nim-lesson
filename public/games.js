// Game engine shared by the browser (boards) and the server (tutor tools, replay checks).
// Every number the tutor states about a position comes from here, never from the model.
(function (root) {
  const RULES = {
    nim: { label: "Nim row (take any number)", options: (n) => range(1, n) },
    take_1_2: { label: "take 1 or 2", options: (n) => [1, 2].filter((k) => k <= n) },
    take_1_2_3: { label: "take 1, 2 or 3", options: (n) => [1, 2, 3].filter((k) => k <= n) },
    take_1_3_4: { label: "take 1, 3 or 4", options: (n) => [1, 3, 4].filter((k) => k <= n) },
  };

  // Boards where taking the last stick LOSES. Only single-row boards use this, so the winner is
  // simply decided by the position with the mover to play (no nim-sum across rows).
  const MISERE_GAMES = new Set(["take_1_2_3"]);

  const MAX_SIZE = 60;

  function range(from, to) {
    const out = [];
    for (let k = from; k <= to; k += 1) out.push(k);
    return out;
  }

  function isValidPile(pile) {
    return (
      pile !== null &&
      typeof pile === "object" &&
      Object.prototype.hasOwnProperty.call(RULES, pile.game) &&
      Number.isInteger(pile.size) &&
      pile.size >= 0 &&
      pile.size <= MAX_SIZE
    );
  }

  function takeOptions(game, size) {
    return RULES[game].options(size);
  }

  const valueCache = {};

  // Nim value (Grundy number): the smallest number missing among the values of positions
  // reachable in one move.
  function nimValue(game, size) {
    const key = `${game}:${size}`;
    if (key in valueCache) return valueCache[key];
    const reachable = new Set(takeOptions(game, size).map((k) => nimValue(game, size - k)));
    let v = 0;
    while (reachable.has(v)) v += 1;
    valueCache[key] = v;
    return v;
  }

  function nimSum(values) {
    return values.reduce((acc, v) => acc ^ v, 0);
  }

  function powersOfTwo(n) {
    const parts = [];
    for (let p = 1 << 6; p >= 1; p >>= 1) if (n & p) parts.push(p);
    return parts;
  }

  function applyMove(piles, move) {
    const pile = piles[move.pile];
    if (!pile || !takeOptions(pile.game, pile.size).includes(move.take)) return null;
    return piles.map((p, i) => (i === move.pile ? { ...p, size: p.size - move.take } : p));
  }

  function allMoves(piles) {
    return piles.flatMap((p, i) => takeOptions(p.game, p.size).map((take) => ({ pile: i, take })));
  }

  function positionValue(piles) {
    return nimSum(piles.map((p) => nimValue(p.game, p.size)));
  }

  function winningMoves(piles, misere) {
    if (misere) return allMoves(piles).filter((m) => misereLoses(applyMove(piles, m)));
    return allMoves(piles).filter((m) => positionValue(applyMove(piles, m)) === 0);
  }

  // One-row misère "take 1, 2 or 3": the player to move loses exactly at 1, 5, 9, 13, ...
  // With 0 left the previous player took the last stick and lost, so the mover has won.
  function misereLoses(piles) {
    const n = piles.reduce((a, p) => a + p.size, 0);
    return n % 4 === 1;
  }

  function isOver(piles) {
    return allMoves(piles).length === 0;
  }

  // Deterministic, so the server can replay a game and check every computer move.
  function computerMove(piles, misere) {
    const winning = winningMoves(piles, misere);
    if (winning.length > 0) return winning[0];
    let best = -1;
    piles.forEach((p, i) => {
      if (p.size > 0 && (best === -1 || p.size > piles[best].size)) best = i;
    });
    return { pile: best, take: takeOptions(piles[best].game, piles[best].size)[0] };
  }

  // Replays a game against computerMove. Returns who took the last match, or ok:false if
  // the log is illegal or a "computer" move is not what the computer would play.
  function replayGame(start, moves, studentFirst, misere) {
    let piles = start;
    for (let i = 0; i < moves.length; i += 1) {
      if (isOver(piles)) return { ok: false, reason: "moves after the game ended" };
      const move = moves[i];
      const isStudent = (i % 2 === 0) === studentFirst;
      if (!isStudent) {
        const expected = computerMove(piles, misere);
        if (expected.pile !== move.pile || expected.take !== move.take) {
          return { ok: false, reason: "computer move does not match" };
        }
      }
      const next = applyMove(piles, move);
      if (!next) return { ok: false, reason: "illegal move" };
      piles = next;
    }
    if (!isOver(piles)) return { ok: true, finished: false, winner: null };
    const lastWasStudent = ((moves.length - 1) % 2 === 0) === studentFirst;
    const lastMoverWins = !misere;
    const studentWon = lastWasStudent === lastMoverWins;
    return { ok: true, finished: true, winner: studentWon ? "student" : "computer" };
  }

  const api = {
    RULES,
    MAX_SIZE,
    isValidPile,
    takeOptions,
    nimValue,
    nimSum,
    powersOfTwo,
    applyMove,
    allMoves,
    positionValue,
    winningMoves,
    misereLoses,
    MISERE_GAMES,
    isOver,
    computerMove,
    replayGame,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NimGames = api;
})(typeof window !== "undefined" ? window : globalThis);
