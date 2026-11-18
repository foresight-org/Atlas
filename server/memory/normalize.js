"use strict";

/**
 * Turn a Meld (or Meld-shaped) post into the graph Atlas is willing to keep.
 *
 * The recording stays on the device. A sterilized transcript may be used
 * once to derive a graph, and is not part of what we store.
 */

const AUDIO_KEYS = ["audio", "audioBase64", "recording", "recordingUrl", "wav", "mp3", "m4a"];
const KINDS = new Set(["topic", "problem", "term"]);
const RELATIONS = new Set(["supports", "opposes", "qualifies", "cooccurs"]);
const INSIGHT_TYPES = new Set(["emerging_term", "bridge", "intro"]);

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function slug(value, fallback) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return text || fallback;
}

function labelOf(value, fallback) {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return text || fallback;
}

function blurb(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function readNode(raw, kind) {
  if (!raw || typeof raw !== "object") return null;
  const label = labelOf(raw.label || raw.name || raw.title, "");
  if (!label) return null;
  const given = KINDS.has(raw.kind) ? raw.kind : kind;
  const node = {
    id: slug(raw.id || label, slug(label, "topic")),
    label,
    kind: given,
  };
  const summary = blurb(raw.summary);
  if (summary) node.summary = summary;
  return node;
}

function readEdge(raw) {
  if (!raw || typeof raw !== "object") return null;
  const source = slug(raw.source || raw.from, "");
  const target = slug(raw.target || raw.to, "");
  if (!source || !target || source === target) return null;
  const relation = RELATIONS.has(raw.relation) ? raw.relation : "cooccurs";
  return { source, target, relation };
}

/**
 * @param {Record<string, unknown>} body
 * @param {{ nodes?: unknown[] }} [derived] graph from DeepSeek when the post had text and no nodes
 */
function normalizeBundle(body, derived) {
  if (!body || typeof body !== "object") throw fail(400, "Send a JSON object.");
  for (const key of AUDIO_KEYS) {
    if (body[key]) {
      throw fail(422, "Atlas keeps the graph. The recording stays on the device.");
    }
  }

  const placeId = slug(body.place || body.placeId || body.node, "");
  if (!placeId) throw fail(400, "Name the Node in place.");

  const graph = body.graph && typeof body.graph === "object" ? body.graph : {};
  const nodes = [
    ...asList(graph.nodes || body.nodes || body.themes || derived?.nodes).map((node) => readNode(node, "topic")),
    ...asList(body.problems).map((node) => readNode(node, "problem")),
    ...asList(body.embers || graph.embers).map((node) => readNode(node, "term")),
  ].filter(Boolean);

  const byId = new Map();
  for (const node of nodes) {
    const existing = byId.get(node.id);
    if (!existing || (existing.kind === "topic" && node.kind !== "topic")) byId.set(node.id, node);
  }
  const kept = [...byId.values()].slice(0, 80);
  if (kept.length === 0) {
    throw fail(422, "Send a graph, or sterilized text so Atlas can derive one.");
  }

  const ids = new Set(kept.map((node) => node.id));
  const edges = [];
  const seen = new Set();
  for (const raw of asList(graph.edges || body.edges || body.relations || derived?.edges)) {
    const edge = readEdge(raw);
    if (!edge || !ids.has(edge.source) || !ids.has(edge.target)) continue;
    const key = [edge.source, edge.target].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(edge);
    if (edges.length >= 200) break;
  }

  const insights = asList(body.insights || derived?.insights)
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const type = raw.type === "ember" ? "emerging_term" : raw.type;
      if (!INSIGHT_TYPES.has(type)) return null;
      const title = labelOf(raw.title || raw.label, "");
      if (!title) return null;
      const insight = { type, title, body: "" };
      if (type === "bridge" && raw.toNode) insight.toNode = slug(raw.toNode, "");
      if (type === "intro" && raw.name) {
        insight.recommendation = {
          name: labelOf(raw.name, title),
          role: labelOf(raw.role, ""),
          nodeId: slug(raw.nodeId || raw.node, placeId),
        };
      }
      return insight;
    })
    .filter(Boolean)
    .slice(0, 6);

  const session = body.session && typeof body.session === "object" ? body.session : {};
  const at = String(session.at || body.at || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const sessionId = slug(session.id || body.sessionId, `${placeId}-${at}`);

  return {
    id: `${placeId}:${sessionId}`,
    placeId,
    source: slug(body.source, "meld"),
    session: {
      id: sessionId,
      label: labelOf(session.label || body.label, "Session"),
      at: /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : new Date().toISOString().slice(0, 10),
    },
    nodes: kept,
    edges,
    insights,
  };
}

function sterilizedText(body) {
  const text = body?.sterilizedText || body?.transcript;
  if (typeof text !== "string") return "";
  if (body?.sterilized === false) {
    throw fail(422, "Only a sterilized transcript can leave the device.");
  }
  return text.replace(/\s+/g, " ").trim().slice(0, 20000);
}

module.exports = { normalizeBundle, sterilizedText, fail };
