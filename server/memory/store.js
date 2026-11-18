"use strict";

/**
 * Where a Node's memory sits.
 *
 * Postgres (Supabase HTTP) when the Atlas database is configured, so a
 * serverless instance holds nothing between requests. A JSON file otherwise,
 * so a Node can run this same API on its own machine with the network down.
 */

const fs = require("fs");
const path = require("path");
const { hasRestApi, rest } = require("../db/supabase-rest");

const FILE = path.join(__dirname, "../../mock/node-memory.local.json");

function readFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(parsed.bundles) ? parsed.bundles : [];
  } catch {
    return [];
  }
}

function writeFile(bundles) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ bundles }, null, 2));
  fs.renameSync(tmp, FILE);
}

async function saveBundle(bundle) {
  const row = {
    id: bundle.id,
    place_id: bundle.placeId,
    source: bundle.source,
    session_id: bundle.session.id,
    session_label: bundle.session.label,
    session_at: bundle.session.at,
    payload: bundle,
    updated_at: new Date().toISOString(),
  };

  if (hasRestApi()) {
    try {
      await rest("node_memory_bundles?on_conflict=id", {
        method: "POST",
        body: row,
        prefer: "resolution=merge-duplicates,return=minimal",
      });
      return { where: "postgres" };
    } catch (error) {
      if (error?.code === "PGRST205" || /node_memory_bundles/.test(String(error?.message || ""))) {
        const missing = new Error("The memory table is not there yet. Run pnpm db:migrate.");
        missing.statusCode = 503;
        throw missing;
      }
      throw error;
    }
  }

  const bundles = readFile().filter((entry) => entry.id !== bundle.id);
  bundles.push(bundle);
  writeFile(bundles);
  return { where: "file" };
}

async function bundlesFor(placeId) {
  if (hasRestApi()) {
    try {
      const rows = await rest(
        `node_memory_bundles?place_id=eq.${encodeURIComponent(placeId)}&select=payload&order=updated_at.asc`,
      );
      return (rows || []).map((row) => row.payload).filter(Boolean);
    } catch (error) {
      if (error?.code === "PGRST205") return [];
      throw error;
    }
  }
  return readFile().filter((entry) => entry.placeId === placeId);
}

module.exports = { saveBundle, bundlesFor, FILE };
