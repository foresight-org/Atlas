"use strict";

/**
 * Email a sign-in link. The public answer is the same whether or not the
 * address is on the roster, so the form cannot be used to list accounts.
 * Unknown addresses do not create a row. Atlas stays invite-only.
 */

const crypto = require("crypto");
const { rateLimit } = require("./rate-limit");
const { issueSignInToken, redeemSignInLink } = require("./directory-auth");
const { findRecordsByEmail, normalizeEmail } = require("./account-emails");
const { mailConfigured, sendSignInLink } = require("./mail");
const { isLocalMockMode, getLocalDatabase, getLocalAuth } = require("./local-storage");

const SENT =
  "If that email is on an atlas account, we sent a sign-in link. It expires in 24 hours.";

function publicOrigin(req) {
  const fromEnv = (process.env.CLAIM_BASE_URL || "").replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host;
  if (host) {
    const proto =
      req.headers?.["x-forwarded-proto"] ||
      (String(host).includes("localhost") ? "http" : "https");
    return `${proto}://${host}`.replace(/\/+$/, "");
  }
  return "https://atlas.foresight.org";
}

function emailKey(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 16);
}

async function loadRecords() {
  if (isLocalMockMode()) {
    const [db, auth] = await Promise.all([getLocalDatabase(), getLocalAuth()]);
    return (db.people || []).map((person) => ({
      person,
      auth: auth[person.id] || { passwordHash: "", claimedAt: "" },
    }));
  }
  const { loadRealDataRecords } = require("./realdata-store");
  const loaded = await loadRealDataRecords({ write: false });
  return loaded.records || [];
}

async function requestLoginLink(req, body) {
  const email = normalizeEmail(body?.email);
  if (!email || !email.includes("@") || email.length > 120) {
    const err = new Error("Enter the email on your atlas account.");
    err.statusCode = 400;
    throw err;
  }

  const ip =
    String(req.headers?.["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.socket?.remoteAddress ||
    "local";
  const limited = rateLimit(`login-link:${ip}:${emailKey(email)}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    const err = new Error("Too many sign-in requests. Try again in a few minutes.");
    err.statusCode = 429;
    err.retryAfterSec = limited.retryAfterSec;
    throw err;
  }

  try {
    const records = await loadRecords();
    const matches = findRecordsByEmail(records, email);
    if (matches.length === 1 && mailConfigured()) {
      const person = matches[0].person;
      const token = issueSignInToken(person.id);
      const link = `${publicOrigin(req)}/claim?token=${encodeURIComponent(token)}`;
      const bucket = Math.floor(Date.now() / 120000);
      await sendSignInLink(email, link, person.fullName, `atlas-signin/${emailKey(email)}/${bucket}`);
    }
  } catch (error) {
    console.error("[login-link] could not send:", error?.message || error);
  }

  return { ok: true, message: SENT };
}

async function redeemLoginLink(token) {
  if (isLocalMockMode()) {
    const { redeemLocalSignIn } = require("./local-storage");
    return redeemLocalSignIn(token);
  }
  return redeemSignInLink(token);
}

module.exports = {
  requestLoginLink,
  redeemLoginLink,
};
