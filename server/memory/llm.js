"use strict";

/**
 * YCluster, the same OpenAI-compatible gateway the matchmaker uses.
 * DeepSeek first, then whatever else on the Berlin cluster is healthy.
 * Unreachable from a laptop that isn't configured: the caller keeps going
 * without a derived graph.
 */

const DEFAULT_BASE = "https://dev1.ycluster.net/v1";
const DEFAULT_FALLBACKS = "glm-5.3-flash,nemotron-3-nano-omni";

function enabled() {
  return Boolean(process.env.LLM_API_KEY);
}

function baseUrl() {
  return (process.env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

function models() {
  const primary = (process.env.LLM_MODEL || "deepseek-v4-flash").trim();
  const extras = (process.env.LLM_MODEL_FALLBACKS || DEFAULT_FALLBACKS)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(["deepseek-v4-flash", primary, ...extras])];
}

/**
 * Ask the cluster for a graph. Returns null when the cluster is quiet.
 * The text is not logged.
 */
async function deriveGraph(text) {
  if (!enabled() || !text) return null;
  const messages = [
    {
      role: "system",
      content:
        "You turn a sterilized conversation into a small graph. Reply with JSON only: " +
        '{"nodes":[{"id":"","label":"","kind":"topic|problem|term","summary":""}],"edges":[{"source":"","target":"","relation":"supports|opposes|qualifies"}],"insights":[{"type":"emerging_term|bridge|intro","title":""}]}. ' +
        "No person names. At most 12 nodes. Problems are what the room is stuck on, and each problem summary is one sentence about what was said. Terms are new phrases.",
    },
    { role: "user", content: text },
  ];

  for (const model of models()) {
    try {
      const res = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.LLM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== "string") continue;
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (end <= start) continue;
      return JSON.parse(content.slice(start, end + 1));
    } catch {
      /* next model */
    }
  }
  return null;
}

module.exports = { enabled, deriveGraph };
