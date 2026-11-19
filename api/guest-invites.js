"use strict";

/**
 * POST /api/guest-invites
 *
 * Foresight Team only. A CSV of event guests becomes community claim emails.
 * dryRun previews the list and writes nothing.
 */

const {
  verifyDirectorySessionToken,
  readDirectoryTokenFromRequest,
} = require("../server/directory-auth");
const { loadRealDataRecords } = require("../server/realdata-store");
const { isForesightTeamPerson } = require("../server/role-types");
const { runGuestInvites } = require("../server/guest-invites");

function publicOrigin(req) {
  const fromEnv = String(process.env.CLAIM_BASE_URL || "").replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host;
  if (host) {
    const proto =
      req.headers?.["x-forwarded-proto"] ||
      (String(host).includes("localhost") ? "http" : "https");
    return `${proto}://${String(host).split(",")[0].trim()}`.replace(/\/+$/, "");
  }
  return "https://atlas.foresight.org";
}

async function requireTeam(req) {
  const session = verifyDirectorySessionToken(readDirectoryTokenFromRequest(req));
  const { records } = await loadRealDataRecords();
  const match = records.find((record) => record.person?.id === session.personId);
  if (!isForesightTeamPerson(match?.person)) {
    const err = new Error("Foresight Team only.");
    err.statusCode = 403;
    throw err;
  }
  return session;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireTeam(req);
  } catch (error) {
    const status =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 401;
    return res.status(status).json({
      error: error instanceof Error ? error.message : "Sign in as Foresight Team.",
    });
  }

  try {
    const result = await runGuestInvites({
      csv: req.body?.csv,
      eventName: req.body?.eventName,
      dryRun: req.body?.dryRun === true,
      offset: req.body?.offset,
      origin: publicOrigin(req),
    });
    return res.status(200).json(result);
  } catch (error) {
    const status =
      error && typeof error === "object" && typeof error.statusCode === "number"
        ? error.statusCode
        : 400;
    return res.status(status).json({
      error: error instanceof Error ? error.message : "Could not send these invites.",
    });
  }
};
