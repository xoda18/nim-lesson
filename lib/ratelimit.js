// Fixed-window per-IP counters. Enough for a single-process lesson server.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_KEYS = 10000;

function createLimiter(limit) {
  const hits = new Map();
  return function allow(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > WINDOW_MS) {
      if (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value);
      hits.set(key, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

module.exports = { createLimiter };
