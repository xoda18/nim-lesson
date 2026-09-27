// Thin Messages API client plus the per-turn tool loop: the model may call the math tools a
// few times, and must finish by calling `respond`.

const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOOL_ROUNDS = 4;
const MAX_TOKENS = 900;

const RETRY_DELAY_MS = 800;

function isRetryable(err) {
  return !err.status || err.status === 429 || err.status >= 500;
}

async function callApi(args) {
  try {
    return await callApiOnce(args);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return callApiOnce(args);
  }
}

async function callApiOnce({ apiKey, body }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Anthropic API error ${res.status}`);
    err.status = res.status;
    err.detail = text.slice(0, 500);
    throw err;
  }
  return res.json();
}

/**
 * Runs one tutor turn.
 * @param {object} o
 * @param {string} o.apiKey
 * @param {string} o.model
 * @param {string} o.staticSystem  cached part of the system prompt
 * @param {string} o.stateSystem   per-turn student state
 * @param {{role: string, content: string}[]} o.history  plain-text chat history, last is user
 * @param {object[]} o.tools       tool definitions; one must be named "respond"
 * @param {(name: string, input: object) => object} o.runTool  executes math tools
 * @returns {Promise<{respond: object, usage: object[], toolCalls: object[]}>}
 */
async function runTurn({ apiKey, model, staticSystem, stateSystem, history, tools, runTool }) {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const usage = [];
  const toolCalls = [];

  const cachedTools = tools.map((t, i) =>
    i === tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t,
  );

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const lastRound = round === MAX_TOOL_ROUNDS - 1;
    const data = await callApi({
      apiKey,
      body: {
        model,
        max_tokens: MAX_TOKENS,
        // Forced tool_choice cannot be combined with extended thinking.
        thinking: { type: "disabled" },
        system: [
          { type: "text", text: staticSystem, cache_control: { type: "ephemeral" } },
          { type: "text", text: stateSystem },
        ],
        tools: cachedTools,
        tool_choice: lastRound
          ? { type: "tool", name: "respond", disable_parallel_tool_use: true }
          : { type: "any", disable_parallel_tool_use: true },
        messages,
      },
    });
    usage.push(data.usage);

    const call = (data.content || []).find((b) => b.type === "tool_use");
    if (!call) throw new Error(`Model returned no tool call (stop_reason: ${data.stop_reason})`);

    if (call.name === "respond") {
      return { respond: call.input || {}, usage, toolCalls };
    }

    let result;
    try {
      result = runTool(call.name, call.input || {});
    } catch (err) {
      result = { error: err.message };
    }
    toolCalls.push({ name: call.name, input: call.input, result });

    messages.push({ role: "assistant", content: data.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result),
          ...(result && result.error ? { is_error: true } : {}),
        },
      ],
    });
  }
  throw new Error("Tool loop ended without a respond call");
}

module.exports = { runTurn };
