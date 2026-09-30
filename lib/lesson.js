// The lesson as the tutor sees it. Page texts retell public/index.html; hints here are the
// single source for both the page (served via /api/config) and the prompts.

const PAGES = [
  {
    n: 1,
    title: "The game from Marienbad",
    blurb: "the story of the film and the match game; the student plays 1-3-5-7 and usually loses",
    text: `In a strange old hotel, a man plays a simple game with matches against the other guests. He
wins every time. It is a scene from the French film "Last Year at Marienbad" (1961).

The rules: 16 matches lie in four rows of 1, 3, 5 and 7. Two players take turns. On your turn you take
as many matches as you like (at least one), but only from one row. The player who takes the last
match wins. (In the film the player who takes the last match loses. The page plays the more common
version and says the idea is almost the same.)

The man always lets his opponent start. A board lets the student play 1-3-5-7 against the computer,
with the student moving first.

The game is very old and is called Nim. In 1901 Charles Bouton, a mathematician at Harvard, worked out
a complete winning strategy. In the 1930s Roland Sprague in Germany and Patrick Grundy in England,
working independently, proved something much stronger: every game of this kind is Nim in disguise.
The page promises that by the end the student will know what that means, and why the man in the
hotel never loses.`,
  },
  {
    n: 2,
    title: "One row, small steps",
    blurb: "a warm-up game: one row of 21, take 1, 2 or 3; the student looks for a winning strategy",
    text: `An easier game: one row of 21 matches. On your turn you take 1, 2 or 3 matches. The player
who takes the last match wins. You go first. "Can you find a way to always win? Play a few games, look
for a pattern, and tell your tutor your idea. Tip: start small. Who wins with 1 match? With 4? With 5?"

Below: a board (21 matches, student first, the computer plays perfectly), a Hint button, the chat.

Then a second exercise, "Fort Boyard": on the French TV show Fort Boyard, candidates play a duel with
the Master of Time. 21 sticks, you take 1, 2 or 3, the candidate goes first, but the player who takes
the LAST stick LOSES. The page asks: "What is the winning strategy now? Can the candidate win?" It has
its own board (21 sticks, last stick loses, student first, the computer plays the Master perfectly),
its own Hint button and its own chat.

The two chats on this page are separate conversations.`,
  },
  {
    n: 3,
    title: "Many rows: Bouton's trick",
    blurb: "Bouton's strategy for Nim: split rows into powers of two, balanced vs unbalanced",
    text: `Back to many rows, where you may take any number of matches from one row. The page says that
with several rows the pattern is much harder to guess, and gives Bouton's trick.

Step 1. Split every row into powers of two: 1, 2, 4, 8, ... Every whole number can be written as a sum
of different powers of two in exactly one way: 7 = 4+2+1, 5 = 4+1, 3 = 2+1, 6 = 4+2.

Step 2. Look at all rows together and count how many times each power appears. If every power appears
an even number of times, the position is "balanced". If not, it is "unbalanced".

A table shows 1-3-5-7: 1 = 1, 3 = 2+1, 5 = 4+1, 7 = 4+2+1. Fours: two. Twos: two. Ones: four. All the
counts are even, so 1-3-5-7 is balanced.

Bouton's theorem: if the position is balanced, the player to move loses, as long as the opponent plays
well. If it is unbalanced, the player to move can always make it balanced, and win.

Why, in two facts: (1) any move from a balanced position makes it unbalanced, because you change only
one row, so at least one power changes its count by one and an even count becomes odd; (2) from an
unbalanced position there is always a move that makes it balanced. The end of the game, when no
matches are left, is balanced. So if you always hand your opponent a balanced position, you are the
one who takes the last match.

"This is the secret from Marienbad: 1-3-5-7 is balanced, which is why the man lets his opponent
start."

A note: mathematicians call this counting the "nim-sum", and programmers know it as XOR. The page says
the student won't need either word. Link: https://en.wikipedia.org/wiki/Nim

Then a small chat just for questions about the two facts ("Not sure why the two facts are true? Ask
your tutor about them here.").

Exercise "Balance it": rows of 3, 4 and 5. It is your move. Find the move that makes the position
balanced, then beat the computer. Tell your tutor your move and why it works.

Below: a board (3-4-5, student first), a Hint button, the chat. Fact (2) is stated, not proved.`,
  },
  {
    n: 4,
    title: "Every game is Nim in disguise",
    blurb: "Nim values (smallest missing number) and the Sprague-Grundy theorem; Q&A only",
    text: `The page goes back to the game from page 2 (one row, take 1, 2 or 3). It does not look like
Nim, but every position gets a number, its "Nim value", which tells us which Nim row it behaves like.

The rule: a position with no moves has value 0. For any other position, list the values of all the
positions you can move to. The Nim value is the smallest number (0, 1, 2, ...) that is not on the list.

Worked example for "take 1, 2 or 3": 0 matches: no moves, value 0. 1: can go to 0 (value 0), smallest
missing is 1. 2: can go to 1 or 0, values 1 and 0, so 2. 3: reachable values 2, 1, 0, so 3. 4: can go
to 3, 2 or 1, values 3, 2, 1, 0 is missing, so 0. A table shows sizes 0 to 12:
0 1 2 3 0 1 2 3 0 1 2 3 0. The 0s are at 0, 4, 8 and 12, exactly the losing positions from page 2.

Then the page says what "a game of this kind" means: two players take turns, in every position both
have exactly the same moves (not like chess), the game always ends, and whoever makes the last move
wins. A "position" is the current state. It need not be rows of matches: in Kayles you knock down one
pin or two neighbouring pins from a row, and knocking one out of the middle splits the row in two.

Then, explicitly back to ordinary Nim (take any number): a Nim row of n matches has Nim value n,
because you can move to every smaller row, so 0 to n-1 are on the list and n is the first missing.

The Sprague-Grundy theorem, as the page states it: take any game of this kind and a position with Nim
value v; put it next to other games, then swap it for a Nim row of v matches; the winner of the whole
combination does not change.

The page adds: on its own a Nim row of v is dull (you take everything and win); the theorem matters
for combinations. A row of 6 in "take 1, 2 or 3" behaves like a Nim row of 2 wherever it appears. So
when several games are played side by side, you replace each by its Nim value and use Bouton's trick
on those values.

History: Sprague published this in 1935 and Grundy in 1939, without knowing about each other's work.
Decades later John Conway, Elwyn Berlekamp and Richard Guy built a whole theory of games on top of it
in their book "Winning Ways for your Mathematical Plays" (1982).
Link: https://en.wikipedia.org/wiki/Sprague%E2%80%93Grundy_theorem

The page gives no proof of the theorem. Below: the chat.`,
  },
  {
    n: 5,
    title: "Practice",
    blurb: "two exercises: Nim values of 'take 1, 3 or 4', and a board of three different games",
    text: `Two exercises. Each one has its own tutor chat and Hint button.

A. "A new rule": one row; on your turn you take 1, 3 or 4 matches. Find the Nim values for rows of
0 to 9 matches. Do you see a pattern?

B. "Three games at once": one board with three rows, each with its own rule. Row A is a Nim row of 3
(take any number). Row B has 6 matches and the rule "take 1, 2 or 3". Row C has 5 matches and the rule
"take 1, 3 or 4". On your turn you pick one row and move by its rule. Whoever takes the last match on
the whole board wins. You go first. Beat the computer, and explain your first move using Nim values.

The two chats are separate conversations and cannot see each other.`,
  },
  {
    n: 6,
    title: "Where this shows up",
    blurb: "three short stories: AlphaZero struggles with Nim, the Nimrod computer (1951), Voyager and game-based codes",
    text: `Three short stories, no exercise and no chat.

AlphaZero beat the best players in chess and Go, but has real trouble with Nim. In 2022 Bei Zhou and
Søren Riis trained programs like it on Nim: they play well on small boards but can't keep up as the
boards get bigger. The winning rule depends on whether counts are even or odd (what the student did
with powers of two), and neural networks are bad at learning that. Link: https://arxiv.org/abs/2205.12787

In 1951 the company Ferranti built Nimrod, one of the first computers made to play a game. It only
played Nim. It drew crowds at the Festival of Britain and then at an industry fair in Berlin, where the
West German economics minister Ludwig Erhard played it three times and lost every game.

The last story starts with "Why would anyone outside a game club care?": around 1980 Voyager 1 and 2
sent color pictures of Jupiter and Saturn back to Earth and used the Golay code (from 1949) to repair
damaged bits. In 1986 John Conway and Neil Sloane found that the Golay code and other famous codes can
be built from games: the positions you want to leave your opponent in, for the right game, form the
code.`,
  },
];

// `kind`: "quote" needs a verbatim student quote; "win" needs a server-verified win on the
// exercise board; "quote_or_win" accepts either.
const EXERCISES = {
  take123: {
    page: 2,
    title: "One row, small steps",
    board: { start: [{ game: "take_1_2_3", size: 21 }], studentFirst: true },
    criteria: [
      {
        id: "rule",
        kind: "quote",
        text: "The winning rule: always leave the opponent a multiple of 4 (equivalently: 0, 4, 8, 12, ... are lost for the player to move).",
      },
      {
        id: "reason",
        kind: "quote",
        text: "Why it works, in any informal form. Any of these is enough: \"whatever they take, I take the rest to make 4\"; \"I can do it again every round\"; \"eventually they face 4 and whatever they take, I take the last one\"; \"eventually I leave the computer with 4\" (short, but it is the idea). Anything that shows the student sees the trick repeats until the end counts.",
      },
    ],
    // A reason the server accepts by itself once the rule is known: the idea "it repeats / in the
    // end they face 4". The model judged this inconsistently, so the server decides.
    autoCriterion: {
      id: "reason",
      after: "rule",
      all: [/\b(?:eventually|at some point|in the end|finally|keep|repeat|again|every (?:time|round|turn)|whatever|always|each time|в итоге|в конце|каждый раз|снова|повтор|что бы ни)\b/i, /\b(?:4|four|четыр\S*)\b/i],
    },
    promptExtra: `Never say the reason yourself (taking the rest to make 4, or "you can repeat it") before the
student has said it. If the student has the rule but not the reason, ask once: "Why does that keep
working?" A short, informal reason is a full answer: "eventually the computer has 4 and I win" counts.
Accept it the first time you see it; do not ask for a cleaner version.`,
    solution: `Positions 0, 4, 8, 12, ... are lost for the player to move; all others are won. The
winning move is to leave a multiple of 4. It works because if the opponent takes k (1, 2 or 3), you
take 4 - k, and the pair of moves removes exactly 4. From 21 the first move is to take 1.`,
    notRequired: `the word "multiple", a formula like "n mod 4", an induction proof, the first move from
21, or winning a game on the board.`,
    likely: [
      {
        id: "greedy",
        text: `"Always take 3" or "take as many as you can". Ask what happens from 5 if you take 3.`,
      },
      {
        id: "copy_opponent",
        text: `"Take the same number as the opponent." It keeps the total even, but 2 is a winning position for the player to move. The pair has to make 4, not "the same twice".`,
      },
      {
        id: "who_starts",
        text: `"It depends on who starts." Partly right and worth credit: from a multiple of 4 the first player loses. Ask what that means for 21.`,
      },
      {
        id: "odd_even",
        text: `"Leave an odd / even number." Ask them to test it on 2 and on 6.`,
      },
    ],
    hints: [
      "Think about the end of the game. With 1, 2 or 3 matches on your turn, you take them all and win. What happens if there are 4 matches on your turn?",
      "With 4 matches, whatever you take, your opponent takes the rest. So 4 is a bad number to have on your turn. What about 5, 6 and 7? And 8?",
      "Try to always leave your opponent 4, 8, 12, 16 or 20 matches. After their move, why can you always do it again?",
    ],
    widgets: [],
    boardRules: { games: ["take_1_2_3"], maxPiles: 1, maxSize: 30 },
    answerSequence: [0, 4, 8, 12, 16, 20],
    answerPhrases: [/multiples? of (?:4|four)|divisible by (?:4|four)|кратно\S* (?:4|четыр\S*)|делит\S* на (?:4|четыре)/i],
    successText: "You found the winning strategy.",
  },

  boyard: {
    page: 2,
    title: "Fort Boyard",
    board: { start: [{ game: "take_1_2_3", size: 21 }], studentFirst: true, misere: true },
    criteria: [
      {
        id: "rule",
        kind: "quote",
        text: "The new target: leave the opponent 1, 5, 9, 13 or 17 sticks (one more than a multiple of 4), because now you want the OPPONENT to be forced to take the last stick.",
      },
      {
        id: "verdict",
        kind: "quote",
        text: "With 21 sticks the player who starts loses against perfect play, because 21 is already one of those numbers (the Master can always answer to make 4).",
      },
    ],
    solution: `Now the player who takes the last stick loses, so you want your opponent to face exactly 1
stick. Going back in steps of 4 (each pair of moves can make 4), the numbers to leave are 1, 5, 9, 13,
17, 21: one more than a multiple of 4. With 20 sticks the first player takes 3 and wins. With 21 the
first player already faces 21, one of these numbers, so the Master wins with perfect play. The
student plays first on the board, so the computer will always win here. That is the point.`,
    notRequired: `the full list of numbers, the words "multiple" or "modulo", the 20-stick or 18-stick
versions, winning a game on the board (it cannot be won against perfect play).`,
    likely: [
      {
        id: "same_rule",
        text: `Using the old rule "leave a multiple of 4". Do not explain why it fails. Ask one short question: "What happens if your opponent faces 4 sticks now?" and let them work it out.`,
      },
      {
        id: "cannot_win_angry",
        text: `"I keep losing, the computer cheats." It doesn't. Ask how many sticks the student has on their first move, and whether that number is on their list.`,
      },
      {
        id: "tv_claim",
        text: `"Fan sites say the candidate can win with 21 sticks" (for example by taking 4 first). Before the exercise is done: say taking 4 is not allowed (1, 2 or 3 per turn), and that checking whether the candidate can win is exactly this exercise, so play the Master a few times and see. Do not say who wins. After the exercise is done: say plainly that the fan sites are wrong for 21 sticks; against perfect play the Master always wins.`,
      },
    ],
    hints: [
      "Now you want your opponent to take the last stick. How many sticks should they face on their turn so that they must take it?",
      "If your opponent faces 1 stick, they lose. Which numbers do you want to leave them before that? Think in steps of 4, like before.",
      "Leave 1, 5, 9, 13 or 17 sticks. Now look at 21. Who has the good position at the start?",
    ],
    widgets: [],
    boardRules: { games: ["take_1_2_3"], maxPiles: 1, maxSize: 30 },
    answerSequence: [1, 5, 9, 13, 17, 21],
    answerPhrases: [
      /one more than a multiple of (?:4|four)|multiples? of (?:4|four),? plus (?:1|one)|4k\s*\+\s*1|4n\s*\+\s*1/i,
      /(?:на )?(?:один|одну|единицу) больше(?:,? чем)? кратно\S* (?:4|четыр\S*)|кратно\S* (?:4|четыр\S*),? плюс (?:1|один|одна)|остат\S* 1 при делении на 4/i,
    ],
    successText: "Right. Against a perfect Master, the candidate can't win with 21 sticks.",
  },

  nim: {
    page: 3,
    title: "Many rows: Bouton's trick",
    board: {
      start: [
        { game: "nim", size: 3 },
        { game: "nim", size: 4 },
        { game: "nim", size: 5 },
      ],
      studentFirst: true,
    },
    criteria: [
      {
        id: "move",
        kind: "quote_or_win",
        text: "The winning move: take 2 matches from the row of 3 (leaving 1, 4, 5). A verified win on the board also counts.",
      },
      {
        id: "reason",
        kind: "quote",
        text: "Why: after the move every power of two appears an even number of times (the position is balanced), e.g. 1 = 1, 4 = 4, 5 = 4+1. The same reason said with XOR or the nim-sum (\"xor is 0 after 3->1\", \"1^4^5 = 0\") is a full answer too.",
      },
    ],
    solution: `3 = 2+1, 4 = 4, 5 = 4+1. Fours: two, twos: one, ones: two. Only the 2 is odd, so remove
the 2 from the row of 3: take 2, leaving 1-4-5. Check: 1 = 1, 4 = 4, 5 = 4+1: fours two, ones two,
balanced. It is the only winning move.`,
    promptExtra: `XOR, nim-sum and binary are the same idea as counting powers of two. If the student reasons with
them, that is a full reason: accept it and do not ask them to redo it with powers of two.`,
    notRequired: `the words "nim-sum" or "XOR", binary notation, a proof of fact (2), the full game after
the first move, or checking that other moves fail.`,
    likely: [
      {
        id: "equal_rows",
        text: `"Make rows equal" or "make it symmetric". It works for two equal rows (they are balanced) but is not the general rule. Ask them to count the powers.`,
      },
      {
        id: "biggest_row",
        text: `"Take from the biggest row." Ask them to count the powers after that move.`,
      },
      {
        id: "bad_split",
        text: `Splitting with repeated powers, e.g. 5 = 2+2+1. The split must use different powers; each number has exactly one such split.`,
      },
      {
        id: "why_fact2",
        text: `"Why can you always balance an unbalanced position?" Only if asked: take the biggest power with an odd count, pick a row that contains it; in that row, flip every power whose count is odd (remove it if present, add it if absent). Since you removed the biggest one, the row gets smaller, so it is a legal move.`,
      },
    ],
    hints: [
      "Write each row as powers of two: 3 = 2+1, 4 = 4, 5 = 4+1. Count each power. Which one appears an odd number of times?",
      "Only the 2 appears an odd number of times (just once). Which row has that 2? What if you take away exactly that part?",
      "Take 2 matches from the row of 3. You get 1, 4, 5. Count the powers again.",
    ],
    widgets: ["binary_helper"],
    boardRules: { games: ["nim"], maxPiles: 4, maxSize: 15 },
    successText: "Balanced. You've got Bouton's trick.",
  },

  values: {
    page: 5,
    title: "Practice A: A new rule",
    board: null,
    criteria: [
      {
        id: "values",
        kind: "quote",
        text: "The Nim values for 0 to 9 matches: 0, 1, 0, 1, 2, 3, 2, 0, 1, 0 (in any readable format).",
        verify: "values_take_1_3_4",
      },
    ],
    solution: `Values for 0..9: 0, 1, 0, 1, 2, 3, 2, 0, 1, 0. The pattern repeats with period 7:
0 1 0 1 2 3 2, then again. From 2 you can only take 1 (to 1, value 1), so its value is 0. From 5 you
can reach 4, 2, 1 with values 2, 0, 1, so 3.`,
    notRequired: `the period, an explanation of the pattern, values beyond 9, or showing the work for
each position.`,
    likely: [
      {
        id: "illegal_moves",
        text: `Counting impossible moves, e.g. taking 3 from a row of 2. Only moves that fit are allowed.`,
      },
      {
        id: "max_plus_one",
        text: `Taking "the biggest value plus one" instead of the smallest missing number. Point back to the rule on page 4 and to the value of 4 in the "take 1, 2 or 3" table.`,
      },
      {
        id: "count_moves",
        text: `Thinking the value is the number of possible moves. Ask what the rule on page 4 says.`,
      },
    ],
    hints: [
      "Start small. 0 matches has value 0. From 1 match you can only go to 0, so 1 has value 1. What about 2 matches? There you can only take 1.",
      "The values for 0 to 4 are 0, 1, 0, 1, 2. From 5 matches you can go to 4, 2 or 1. What are their values, and which is the smallest number missing?",
      "The values for 0 to 6 are 0, 1, 0, 1, 2, 3, 2. Keep going with 7, 8 and 9.",
    ],
    widgets: [],
    boardRules: null,
    guard: "values_take_1_3_4",
    promptExtra: `HOW TO CHECK VALUES
- The STUDENT STATE lists, computed by the server, every value the student has stated so far and
  whether it is right. Trust it. Never tell the student a value is wrong when the state says it is
  right. If the student insists, look at the state again; if they are right, say so plainly.
- A full, correct table for 0 to 9 is a complete answer, even without any explanation. Do not ask
  how they got it. The server counts it by itself.
- A single guess with no work ("is 5 equal to 2?") is not something to confirm or correct: ask for
  one step (which sizes you can reach from 5, their values, which number is missing).
- If a value is wrong, point to the size ("have another look at 7") without writing the right value.
  Only call a value wrong if the STUDENT STATE marks it WRONG, and name exactly that size. Never say
  "a couple of those are off" without naming them.
- This includes the values of the sizes they reach along the way: if the student uses a WRONG value
  in their reasoning, point to it, even if their final number happens to be right.
- If the student's message is unclear (for example the order of the values does not match the order
  of the sizes), ask what they meant. Do not call it a mistake.
- If everything the student wrote is right, say so in one sentence. Do not look for a "small slip".`,
    successText: "All ten Nim values are right.",
  },

  star: {
    page: 5,
    title: "Practice B: Three games at once",
    board: {
      start: [
        { game: "nim", size: 3 },
        { game: "take_1_2_3", size: 6 },
        { game: "take_1_3_4", size: 5 },
      ],
      studentFirst: true,
    },
    criteria: [
      { id: "win", kind: "win", text: "A verified win against the computer on this board." },
      {
        id: "explain",
        kind: "quote",
        text: "An explanation of the first move with Nim values: the rows have values 3, 2, 3 (or equivalent reasoning) and the move makes the values balanced.",
      },
    ],
    solution: `Nim values: row A (Nim, 3) = 3; row B (take 1-2-3, 6) = 2; row C (take 1-3-4, 5) = 3.
3 = 2+1, 2 = 2, 3 = 2+1: twos three times (odd), ones twice. Unbalanced, so the first player wins.
Winning first moves (any one is fine): take 2 from row A (value 1 left, 1, 2, 3 is balanced); take 2
from row B (size 4, value 0, then 3, 0, 3 is balanced); take 4 from row C (size 1, value 1, then
3, 2, 1 is balanced). After that, keep making the values balanced on every move.`,
    notRequired: `all the winning first moves, the words "nim-sum" or "XOR", a proof of the
Sprague-Grundy theorem, or an explanation of every later move.`,
    likely: [
      {
        id: "sizes_not_values",
        text: `Using the row sizes 3, 6, 5 in Bouton's trick instead of the Nim values. Say this is the key idea of page 4: rows B and C behave like Nim rows of their values, not their sizes.`,
      },
      {
        id: "move_with_values",
        text: `The student names a move and the values after it ("take 2 from B, values become 3, 0, 3" or in binary "11 0 11"). Check the position after the move with analyze_position. If it is right, accept it; do not ask them to justify a value they already gave.`,
      },
      {
        id: "win_each_game",
        text: `Trying to win each row separately. Only the last match of the whole board counts.`,
      },
    ],
    hints: [
      "First find the Nim value of each row. Row A is a Nim row of 3. For row B, use the table on page 4. For row C, use your values from exercise A.",
      "The values are 3, 2 and 3. Use Bouton's trick on these three numbers. Which power of two appears an odd number of times?",
      "You need to change one of the values so that the position becomes balanced. For example, which size of row B has Nim value 0?",
    ],
    widgets: ["binary_helper"],
    boardRules: null,
    successText: "You beat the computer at three games at once.",
  },
};

// Pure Q&A chats: nothing to resolve.
const QA = {
  bouton: {
    page: 3,
    title: "Many rows: Bouton's trick (questions about the two facts)",
    likely: [
      `Fact 1, "why does any move break the balance?" You change one row. Its split into powers of two changes, so at least one power appears one time more or one time less in that row. Every count was even, so that count becomes odd.`,
      `Fact 2, "why can you always make it balanced again?" Sketch, only if asked: find the biggest power with an odd count, and pick a row that contains it. In that row, flip every power whose count is odd: remove it if the row has it, add it if not. All counts become even. The row gets smaller, because you removed its biggest changed power and anything you add is smaller than it, so it is a legal move.`,
      `"Why is having no matches balanced?" Every power appears zero times, and zero is even.`,
      `"Why does the balanced player lose?" They always hand back an unbalanced position (fact 1), the other player rebalances (fact 2), and the end, which is balanced, can only be reached by the rebalancing player.`,
      `"Why powers of two and not something else?" Because every number splits into different powers of two in exactly one way (its binary form), and a move changes only one row. Tens and units would not work: 5 + 5 is not "even" in a useful way.`,
    ],
    doNotGive: `Do not say the winning move for rows 3, 4, 5 or that the answer leaves 1, 4, 5: that is the
exercise below. Do not analyse 3, 4, 5 at all; use other positions (for example 2, 3, 5 or 1, 2, 3)
as examples.`,
    widgets: [],
    // The exercise position and everything one move away from it (1-4-5 is the answer).
    blockedPositions: (() => {
      const start = [3, 4, 5];
      const out = new Set([start.join()]);
      start.forEach((size, i) => {
        for (let left = 0; left < size; left += 1) {
          const next = start.map((x, j) => (j === i ? left : x)).filter((x) => x > 0);
          out.add(next.sort((x, y) => x - y).join());
        }
      });
      return [...out];
    })(),
    forbidden: [/\b1\s*[-,/]\s*4\s*[-,/]\s*5\b/, /\btake\s+(?:two|2)\b[^.?!]{0,30}\b(?:row\s+of\s+)?(?:three|3)\b/i],
  },

  grundy: {
    page: 4,
    title: "Every game is Nim in disguise",
    likely: [
      `"What counts as a game like this?" Two players, both have the same moves in every position, the game always ends, and whoever makes the last move wins. A "position" is the current state. It need not be rows of matches: Kayles (knock down one pin or two neighbouring pins from a row, which can split the row in two) or a counter moved along arrows on a map both qualify.`,
      `"A Nim row of v is trivial, you just take everything. How can it capture a complicated game?" Alone it is trivial, and so is the game it stands for: if the value is not 0 you win. The theorem matters when games are played side by side. Then "behaves like a Nim row of v" means: you can swap the game for a Nim row of v and the winner of the whole combination does not change.`,
      `"Why the smallest missing number?" Intuition: from a position of value v you can reach every value 0 .. v-1, just like from a Nim row of v, and you can never reach v itself. Moves to bigger values do not help: the opponent can always move back down to v.`,
      `"Why can you add games with Bouton's trick?" High level only: each game acts like its Nim row, and several Nim rows side by side are just Nim. The proof is in the Wikipedia article.`,
      `The film's version (last match loses, "misère"). For Nim the strategy is almost the same: play normally until your move would leave only rows of size 1, then leave an odd number of them. https://en.wikipedia.org/wiki/Nim#Mis%C3%A8re_game`,
      `"Does this work for chess?" No: the theorem is for games where both players have the same moves (impartial games) and the game always ends. In chess the players have different pieces. Conway's theory of such "partizan" games leads to surreal numbers: https://en.wikipedia.org/wiki/Surreal_number`,
    ],
    doNotGive: `Do not compute Nim values for the "take 1, 3 or 4" rule and do not analyse the three-row
board from page 5: those are the exercises. Use other rules (for example "take 1 or 2") as examples.`,
    widgets: ["value_table"],
  },
};

module.exports = { PAGES, EXERCISES, QA };
