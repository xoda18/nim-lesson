/* global NimGames */
const G = NimGames;

// --- Page navigation ---------------------------------------------------------------------

const pages = Array.from(document.querySelectorAll("section.page"));
const backBtn = document.getElementById("back-btn");
const nextBtn = document.getElementById("next-btn");
const dotsEl = document.getElementById("page-dots");
let currentPage = 0;

const dots = pages.map((_, i) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.className = "page-dot";
  dot.textContent = String(i + 1);
  dot.setAttribute("aria-label", `Page ${i + 1}`);
  dot.addEventListener("click", () => showPage(i));
  dotsEl.appendChild(dot);
  return dot;
});

function showPage(index) {
  currentPage = Math.max(0, Math.min(pages.length - 1, index));
  pages.forEach((p, i) => p.classList.toggle("hidden", i !== currentPage));
  dots.forEach((d, i) => d.classList.toggle("active", i === currentPage));
  backBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage === pages.length - 1;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

backBtn.addEventListener("click", () => showPage(currentPage - 1));
nextBtn.addEventListener("click", () => showPage(currentPage + 1));
showPage(0);

// --- Helpers -----------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// Renders text into `node`: plain text, with bare http(s) URLs as links. Built with DOM nodes
// only, so no message text is ever parsed as HTML.
function renderMessage(node, text) {
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  let last = 0;
  let match;
  while ((match = urlPattern.exec(text))) {
    let url = match[0];
    while (/[.,;:!?)\]]$/.test(url)) url = url.slice(0, -1);
    node.appendChild(document.createTextNode(text.slice(last, match.index)));
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = url;
    node.appendChild(a);
    last = match.index + url.length;
    urlPattern.lastIndex = last;
  }
  node.appendChild(document.createTextNode(text.slice(last)));
}

// --- Board ------------------------------------------------------------------------------

/**
 * A clickable match board. Clicking the k-th match from the left in a row takes that match and
 * every match to its right. `onMove` returns the new state after the student's move (and the
 * computer's reply).
 */
function createBoard(container, { onMove, onReset, misere = false }) {
  let piles = [];
  let locked = false;

  const badge = el(
    "p",
    `board-badge ${misere ? "lose" : "win"}`,
    misere ? "Taking the last stick LOSES" : "Taking the last match WINS",
  );
  const rowsEl = el("div");
  const note = el("p", "board-note");
  const status = el("p", "board-status");
  const actions = el("div", "board-actions");
  const resetBtn = el("button", "btn-secondary btn-small", "Start again");
  resetBtn.type = "button";
  actions.appendChild(resetBtn);
  container.append(badge, note, rowsEl, status, actions);

  resetBtn.addEventListener("click", async () => {
    if (locked) return;
    locked = true;
    try {
      await onReset();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      locked = false;
    }
  });

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = `board-status${kind ? ` ${kind}` : ""}`;
  }

  function render() {
    rowsEl.innerHTML = "";
    const over = G.isOver(piles);
    piles.forEach((pile, rowIndex) => {
      const row = el("div", "board-row");
      const label = el("div", "board-row-label");
      const name = el("strong", "", `${piles.length > 1 ? `Row ${String.fromCharCode(65 + rowIndex)}: ` : ""}${pile.size}`);
      const rule = G.RULES[pile.game].label.replace("Nim row (take any number)", "take any number");
      label.append(name, el("div", "", rule));
      const matches = el("div", "matches");
      const legal = G.takeOptions(pile.game, pile.size);

      for (let i = 0; i < pile.size; i += 1) {
        const take = pile.size - i;
        const btn = el("button", "match");
        btn.type = "button";
        btn.setAttribute("aria-label", `Take ${take} from this row`);
        btn.title = `Take ${take}`;
        btn.disabled = over || !legal.includes(take);
        btn.addEventListener("mouseenter", () => highlight(matches, i, true));
        btn.addEventListener("mouseleave", () => highlight(matches, i, false));
        btn.addEventListener("click", () => move(rowIndex, take));
        matches.appendChild(btn);
      }
      row.append(label, matches);
      rowsEl.appendChild(row);
    });
  }

  function highlight(matches, from, on) {
    Array.from(matches.children).forEach((m, j) => m.classList.toggle("will-take", on && j >= from));
  }

  async function move(pile, take) {
    if (locked) return;
    locked = true;
    try {
      const result = await onMove({ pile, take });
      update(result.piles, result);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      locked = false;
    }
  }

  function update(newPiles, result = {}) {
    piles = newPiles;
    render();
    const over = G.isOver(piles);
    if (over && result.winner === "student") setStatus(misere ? "The computer had to take the last stick. You win." : "You took the last match. You win.", "win");
    else if (over && result.winner === "computer") setStatus(misere ? "You had to take the last stick. Want to try again?" : "The computer took the last match. Want to try again?", "lose");
    else if (over) setStatus("Game over.");
    else if (result.computer) {
      const where = piles.length > 1 ? ` from row ${String.fromCharCode(65 + result.computer.pile)}` : "";
      setStatus(`The computer took ${result.computer.take}${where}. Your move.`);
    } else setStatus("Your move. Click a match to take it and every match to its right.");
  }

  return {
    update,
    setNote(text) {
      note.textContent = text || "";
    },
    getPiles: () => piles,
  };
}

// --- Page 1: a local board, no tutor --------------------------------------------------------

(function introBoard() {
  const container = document.querySelector('.board[data-board="intro"]');
  const START = [1, 3, 5, 7].map((size) => ({ game: "nim", size }));
  let piles = START;
  const board = createBoard(container, {
    async onMove(move) {
      piles = G.applyMove(piles, move);
      if (G.isOver(piles)) return { piles, winner: "student" };
      const computer = G.computerMove(piles);
      piles = G.applyMove(piles, computer);
      return { piles, computer, winner: G.isOver(piles) ? "computer" : null };
    },
    async onReset() {
      piles = START;
      board.update(piles);
    },
  });
  board.update(piles);
})();

// --- Page 4: static value table -----------------------------------------------------------

function fillValueTable(table, game, upTo) {
  table.innerHTML = "";
  const head = el("tr");
  const body = el("tr");
  head.appendChild(el("th", "", "matches"));
  body.appendChild(el("th", "", "Nim value"));
  for (let n = 0; n <= upTo; n += 1) {
    const v = G.nimValue(game, n);
    head.appendChild(el("th", "", String(n)));
    body.appendChild(el("td", v === 0 ? "zero" : "", String(v)));
  }
  table.append(head, body);
}

fillValueTable(document.getElementById("table-take123"), "take_1_2_3", 12);

// --- Widgets the tutor can open --------------------------------------------------------------

const WIDGETS = {
  binary_helper(container, chat) {
    container.innerHTML = "";
    container.appendChild(el("h3", "", "Powers of two helper"));
    const out = el("div", "widget-output");
    container.appendChild(out);
    const draw = () => {
      const piles = chat.board ? chat.board.getPiles() : [];
      const rows = piles.map((p) => {
        const v = G.nimValue(p.game, p.size);
        const split = G.powersOfTwo(v);
        const note = p.game === "nim" ? "" : ` (Nim value ${v})`;
        return `${p.size}${note} = ${split.length ? split.join(" + ") : "0"}`;
      });
      const counts = {};
      piles.forEach((p) => G.powersOfTwo(G.nimValue(p.game, p.size)).forEach((x) => (counts[x] = (counts[x] || 0) + 1)));
      const countText = Object.keys(counts)
        .map(Number)
        .sort((a, b) => b - a)
        .map((k) => `${k}: ${counts[k]} time${counts[k] === 1 ? "" : "s"}`)
        .join(", ");
      out.textContent = "";
      rows.forEach((r) => out.appendChild(el("div", "", r)));
      out.appendChild(el("div", "", countText ? `Count: ${countText}` : "No matches left."));
    };
    draw();
    return { refresh: draw };
  },

  value_table(container) {
    container.innerHTML = "";
    container.appendChild(el("h3", "", "Nim value explorer"));
    const select = el("select");
    [
      ["nim", "take any number (Nim)"],
      ["take_1_2", "take 1 or 2"],
      ["take_1_2_3", "take 1, 2 or 3"],
    ].forEach(([value, label]) => {
      const option = el("option", "", label);
      option.value = value;
      select.appendChild(option);
    });
    const wrap = el("div", "value-table-wrap");
    const table = el("table", "value-table");
    wrap.appendChild(table);
    container.append(select, wrap);
    const draw = () => fillValueTable(table, select.value, 15);
    select.addEventListener("change", draw);
    draw();
    return { refresh: draw };
  },
};

// --- Tutor chats ---------------------------------------------------------------------------

function createChat(chatId, config) {
  const chatEl = document.querySelector(`.chat[data-chat="${chatId}"]`);
  const boardEl = document.querySelector(`.board[data-chat="${chatId}"]`);
  const hintsEl = document.querySelector(`.hints[data-chat="${chatId}"]`);
  const widgetEls = Array.from(document.querySelectorAll(`.widget[data-chat="${chatId}"]`));

  const log = el("div", "chat-log");
  log.setAttribute("aria-live", "polite");
  const form = el("form", "chat-form");
  const input = el("textarea", "chat-input");
  input.rows = 1;
  input.placeholder = chatEl.dataset.placeholder || "Write here…";
  const sendBtn = el("button", "btn-primary", "Send");
  sendBtn.type = "submit";
  form.append(input, sendBtn);
  chatEl.append(log, form);

  const state = { sessionId: null, resolved: false, board: null, widgets: {}, hintsShown: 0 };
  let sessionPromise = null;

  function ensureSession() {
    if (!sessionPromise) {
      sessionPromise = api("/api/session", { chat: chatId }).then((data) => {
        state.sessionId = data.sessionId;
        return data;
      });
    }
    return sessionPromise;
  }

  function append(role, text, extra) {
    const msg = el("div", `msg ${role}${extra ? ` ${extra}` : ""}`);
    renderMessage(msg, text);
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  function showSuccess() {
    if (state.resolved) return;
    state.resolved = true;
    const banner = el("div", "success-banner", config.successText || "Well done.");
    log.appendChild(banner);
    log.scrollTop = log.scrollHeight;
  }

  // Hints: the server counts them, so the tutor always knows what the student has seen.
  const hintList = hintsEl ? hintsEl.querySelector(".hint-list") : null;
  const hintBtn = hintsEl ? hintsEl.querySelector(".hint-btn") : null;

  function renderHints(shown) {
    if (!hintList) return;
    while (state.hintsShown < shown && state.hintsShown < config.hints.length) {
      hintList.appendChild(el("li", "", config.hints[state.hintsShown]));
      state.hintsShown += 1;
    }
    const done = state.hintsShown >= config.hints.length;
    hintBtn.disabled = done;
    hintBtn.textContent = done ? "No more hints" : state.hintsShown ? "Show another hint" : "Show a hint";
  }

  if (hintBtn) {
    hintBtn.addEventListener("click", async () => {
      hintBtn.disabled = true;
      try {
        await ensureSession();
        const data = await api("/api/hint", { sessionId: state.sessionId });
        renderHints(data.hintsShown);
      } catch (err) {
        append("assistant", `Error: ${err.message}`, "error");
        hintBtn.disabled = false;
      }
    });
    renderHints(0);
  }

  if (boardEl && config.board) {
    state.board = createBoard(boardEl, {
      misere: Boolean(config.board.misere),
      async onMove(move) {
        await ensureSession();
        const data = await api("/api/move", { sessionId: state.sessionId, move });
        if (data.resolved) showSuccess();
        refreshWidgets();
        return { ...data.move, piles: data.move.piles };
      },
      async onReset() {
        await ensureSession();
        const data = await api("/api/reset", { sessionId: state.sessionId });
        state.board.setNote("");
        state.board.update(data.board.piles);
        refreshWidgets();
      },
    });
    state.board.update(config.board.start);
  }

  function refreshWidgets() {
    Object.values(state.widgets).forEach((w) => w.refresh());
  }

  function applyActions(actions) {
    for (const a of actions || []) {
      if (a.type === "set_board" && state.board) {
        state.board.update(a.piles);
        state.board.setNote("Your tutor set up this position. Press \"Start again\" to go back to the exercise.");
        refreshWidgets();
      }
      if (a.type === "show_widget") {
        const container = widgetEls.find((w) => w.dataset.widget === a.widget);
        if (container && WIDGETS[a.widget] && !state.widgets[a.widget]) {
          state.widgets[a.widget] = WIDGETS[a.widget](container, state);
          container.hidden = false;
        }
      }
    }
  }

  function autoResize() {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }
  input.addEventListener("input", autoResize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    append("user", text);
    input.value = "";
    autoResize();
    input.disabled = true;
    sendBtn.disabled = true;
    const pending = append("assistant", "Thinking…", "pending");
    try {
      await ensureSession();
      const data = await api("/api/chat", { sessionId: state.sessionId, message: text });
      pending.remove();
      append("assistant", data.reply);
      renderHints(data.hintsShown);
      applyActions(data.actions);
      if (data.resolved) showSuccess();
    } catch (err) {
      pending.remove();
      append("assistant", `Error: ${err.message}`, "error");
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  });
}

fetch("/api/config")
  .then((r) => r.json())
  .then((config) => {
    document.querySelectorAll(".chat[data-chat]").forEach((node) => {
      createChat(node.dataset.chat, config[node.dataset.chat] || { hints: [] });
    });
  })
  .catch((err) => {
    document.querySelectorAll(".chat[data-chat]").forEach((node) => {
      node.textContent = `Could not load the tutor: ${err.message}`;
    });
  });
