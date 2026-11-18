/**
 * Memory a Node publishes, and the graph members read back.
 *
 * POST /api/memory     Meld (or a Node running the same pipeline)
 *                      Authorization: Bearer $MEMORY_INGEST_TOKEN
 * GET  /api/memory?place=berlin
 *                      a signed-in member
 *
 * The recording never arrives here. A sterilized transcript, if one is
 * sent, is used once to derive a graph and then dropped.
 */

const crypto = require("crypto");
const { normalizeBundle, sterilizedText } = require("../server/memory/normalize");
const { assemble } = require("../server/memory/assemble");
const { saveBundle, bundlesFor } = require("../server/memory/store");
const { deriveGraph, enabled } = require("../server/memory/llm");

function ingestAllowed(req) {
  const expected = process.env.MEMORY_INGEST_TOKEN || "";
  const header = String(req.headers.authorization || "");
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected) {
    /* A Node running this process on its own machine can post while it
     * is still setting the token up. Production will not. */
    return !process.env.VERCEL;
  }
  if (!given || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function memberSession(req) {
  const { readDirectoryTokenFromRequest, verifyDirectorySessionToken } = require("../server/directory-auth");
  return verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      try {
        memberSession(req);
      } catch {
        return res.status(401).json({ error: "Sign in to view a Node's memory." });
      }
      const place = String(req.query?.place || "").trim().toLowerCase();
      if (!place) return res.status(400).json({ error: "Pass ?place=." });
      const bundles = await bundlesFor(place);
      return res.status(200).json({
        place,
        source: bundles[0]?.source || null,
        graph: bundles.length ? assemble(place, bundles) : null,
      });
    }

    if (req.method === "POST") {
      if (!ingestAllowed(req)) {
        const message = process.env.MEMORY_INGEST_TOKEN
          ? "The ingest token doesn't match."
          : "Set MEMORY_INGEST_TOKEN before posting memory.";
        return res.status(401).json({ error: message });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const text = sterilizedText(body);
      const hasNodes =
        (body.graph && Array.isArray(body.graph.nodes) && body.graph.nodes.length > 0) ||
        (Array.isArray(body.nodes) && body.nodes.length > 0) ||
        (Array.isArray(body.problems) && body.problems.length > 0) ||
        (Array.isArray(body.embers) && body.embers.length > 0);
      const derived = !hasNodes && text ? await deriveGraph(text) : null;
      if (!hasNodes && text && !derived) {
        return res.status(503).json({
          error: enabled()
            ? "The Berlin cluster didn't return a graph. Send the graph directly."
            : "Set LLM_API_KEY (YCluster) to derive a graph from sterilized text, or send the graph.",
        });
      }
      const bundle = normalizeBundle(body, derived);
      const stored = await saveBundle(bundle);
      return res.status(200).json({
        ok: true,
        id: bundle.id,
        place: bundle.placeId,
        nodes: bundle.nodes.length,
        edges: bundle.edges.length,
        stored: stored.where,
        derived: Boolean(derived),
      });
    }

    return res.status(405).json({ error: "GET or POST." });
  } catch (error) {
    const status = error?.statusCode || 500;
    if (status >= 500) console.error("Memory API:", error?.message || error);
    return res.status(status).json({ error: error?.message || "Memory API failed." });
  }
};
