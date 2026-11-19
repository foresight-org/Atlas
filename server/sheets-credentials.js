"use strict";

/**
 * One way to read the Google service account.
 *
 * Vercel holds the key in GOOGLE_SERVICE_ACCOUNT_KEY. Locally that same
 * variable is often a pretty-printed JSON file pasted into .env.local, so
 * the private key contains real newlines. JSON.parse rejects those, and a
 * failed parse used to hide a working GOOGLE_APPLICATION_CREDENTIALS file.
 * Reads can still succeed through the API key, which is why the map loads
 * while a profile save says write credentials are missing.
 *
 * A valid one-line key is parsed as-is. A pretty-printed key is repaired.
 * The credentials file is used only when the env value still is not a key.
 * The read-only API key is never returned from here.
 */

const fs = require("fs");
const path = require("path");

function escapeControlsInsideStrings(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }
    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\r";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x20) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }
    out += ch;
  }
  return out;
}

function isServiceAccount(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.type === "service_account" &&
      typeof value.private_key === "string" &&
      value.private_key.includes("PRIVATE KEY") &&
      typeof value.client_email === "string" &&
      value.client_email.includes("@"),
  );
}

function parseServiceAccountJson(raw) {
  if (raw && typeof raw === "object") return isServiceAccount(raw) ? raw : null;
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (isServiceAccount(parsed)) return parsed;
  } catch {
    /* Pretty-printed .env values fail here and are repaired below. */
  }
  try {
    const parsed = JSON.parse(escapeControlsInsideStrings(text));
    return isServiceAccount(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readServiceAccountFile(keyPath) {
  if (!keyPath) return null;
  const resolved = path.resolve(String(keyPath));
  if (!fs.existsSync(resolved)) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS === keyPath) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
    return isServiceAccount(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function loadServiceAccountCredentials() {
  const fromEnv = parseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  if (fromEnv) return fromEnv;
  return readServiceAccountFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

module.exports = {
  loadServiceAccountCredentials,
  parseServiceAccountJson,
};
