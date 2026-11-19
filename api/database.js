/**
 * Vercel serverless: GET /api/database
 *
 * scope=map reads people and travel live from the sheet (no Luma).
 * scope=programming reads events, merges Luma live, and returns RSVPs.
 * No scope returns the full payload. Nothing is written to a JSON file.
 * The built JSON is shared across instances; see server/atlas-response-cache.js.
 *
 * Env: GOOGLE_SHEETS_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY, SPREADSHEET_ID; optional LUMA_API_KEY for events.
 */

// If GOOGLE_APPLICATION_CREDENTIALS points to a missing file (e.g. local path on Vercel), clear it
// before loading any Google client so we avoid ENOENT / lstat from the auth library.
const path = require("path");
const fs = require("fs");
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath && !fs.existsSync(path.resolve(credPath))) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const { atlasScope } = require("../server/atlas-read");
const { layeredDirectory, requestedDirectoryLayer } = require("../server/directory-layer");
const { sendCachedDirectory } = require("../server/atlas-response-cache");
const {
  verifyDirectorySessionToken,
  readDirectoryTokenFromRequest,
} = require("../server/directory-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Member data is private — never let a CDN or shared cache hold it.
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // The atlas is an internal tool: a valid member session is required.
  let session;
  try {
    session = verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
  } catch {
    return res.status(401).json({ error: "Sign in to view the directory." });
  }

  try {
    const scope = atlasScope(req.query?.scope);
    await sendCachedDirectory(
      res,
      scope,
      () => layeredDirectory(scope),
      session.personId,
      requestedDirectoryLayer(req.query),
    );
    return;
  } catch (error) {
    console.error("GET /api/database", error?.message || error);
    const msg = error?.message || "Failed to read database from sheet";
    const hint =
      process.env.NODE_ENV === "development" || process.env.VERCEL
        ? " Set GOOGLE_SHEETS_API_KEY (or GOOGLE_SERVICE_ACCOUNT_KEY) and SPREADSHEET_ID in env. Share sheet 'Anyone with the link can view'. See docs/SHEETS_SYNC.md."
        : "";
    return res.status(503).json({
      error: msg + hint,
      detail: process.env.NODE_ENV === "development" ? (error?.message || String(error)) : undefined,
    });
  }
};
