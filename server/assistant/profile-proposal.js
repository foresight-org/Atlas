"use strict";

/**
 * An assistant may ask to change the signed-in member's own card.
 * The ask is a short-lived signed proposal. The sheet changes only when
 * that member saves it from their Atlas profile.
 */

const { passwordVersion } = require("../directory-auth");
const { normalizeFocusTags } = require("../focus-areas");
const { signPayload, readPayload } = require("./oauth");
const { requireLiveMember } = require("./directory");

const PROPOSAL_TTL_MS = 20 * 60 * 1000;

const FIELDS = {
  fullName: { sheet: "fullName", label: "Name", max: 120 },
  tagline: { sheet: "shortProjectTagline", label: "Tagline", max: 240 },
  about: { sheet: "expandedProjectDescription", label: "About", max: 2000 },
  lookingFor: { sheet: "currentlyLookingFor", label: "Looking for", max: 220 },
  city: { sheet: "currentCity", label: "City", max: 80 },
  country: { sheet: "currentCountry", label: "Country", max: 80 },
  contact: { sheet: "contactUrlOrHandle", label: "Contact", max: 200 },
  bookingUrl: { sheet: "availabilityUrl", label: "Booking link", max: 220 },
  profileUrl: { sheet: "profileUrl", label: "Profile link", max: 220 },
  primaryNode: { sheet: "primaryNode", label: "Node" },
  isPrivate: { sheet: "isPrivate", label: "Private" },
  focus: { sheet: "focusTags", label: "Focus" },
};

const NODES = new Set(["Berlin Node", "Bay Area Node", "Global"]);

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, max) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function currentValue(person, key) {
  const value = person?.[FIELDS[key].sheet];
  if (key === "focus") return normalizeFocusTags(Array.isArray(value) ? value : []);
  if (key === "isPrivate") return value === true;
  return value == null ? "" : String(value);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizePatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw fail(400, "Send at least one profile field to update.");
  }
  const patch = {};
  for (const key of Object.keys(FIELDS)) {
    if (input[key] === undefined) continue;
    if (key === "isPrivate") {
      if (typeof input[key] !== "boolean") throw fail(400, "Private must be true or false.");
      patch[key] = input[key];
      continue;
    }
    if (key === "focus") {
      if (!Array.isArray(input[key]) || input[key].some((tag) => typeof tag !== "string")) {
        throw fail(400, "Focus must be a list of the Atlas areas.");
      }
      patch[key] = normalizeFocusTags(input[key]);
      continue;
    }
    if (key === "primaryNode") {
      const node = cleanText(input[key], 40);
      if (!NODES.has(node)) throw fail(400, "Node must be Berlin Node, Bay Area Node, or Global.");
      patch[key] = node;
      continue;
    }
    if (key === "bookingUrl" || key === "profileUrl") {
      const url = cleanText(input[key], FIELDS[key].max);
      if (url && !/^https?:\/\/[^\s]+$/i.test(url)) {
        throw fail(400, `${FIELDS[key].label} must be an http or https link.`);
      }
      patch[key] = url;
      continue;
    }
    const text = cleanText(input[key], FIELDS[key].max);
    if (key === "fullName" && !text) throw fail(400, "Name cannot be empty.");
    if (key === "lookingFor" && text.length > 220) {
      throw fail(400, "Looking for must be one sentence, 220 characters or fewer.");
    }
    patch[key] = text;
  }
  if (!Object.keys(patch).length) throw fail(400, "Send at least one profile field to update.");
  return patch;
}

function changedPatch(person, patch) {
  const next = {};
  const before = {};
  for (const [key, value] of Object.entries(patch)) {
    const now = currentValue(person, key);
    if (same(now, value)) continue;
    next[key] = value;
    before[key] = now;
  }
  if (!Object.keys(next).length) {
    throw fail(400, "That already matches the profile.");
  }
  return { patch: next, before };
}

function display(value) {
  if (typeof value === "boolean") return value ? "Hidden from the directory" : "Visible in the directory";
  if (Array.isArray(value)) return value.join(", ");
  return value || "Empty";
}

function changesOf(patch, before) {
  return Object.keys(patch).map((key) => ({
    field: key,
    label: FIELDS[key].label,
    before: display(before[key]),
    after: display(patch[key]),
  }));
}

function proposeProfileChange({ person, passwordHash, patch, origin }) {
  const normalized = normalizePatch(patch);
  const change = changedPatch(person, normalized);
  const exp = new Date(Date.now() + PROPOSAL_TTL_MS).toISOString();
  const token = signPayload({
    purpose: "assistant-profile-proposal",
    personId: person.id,
    pwv: passwordVersion(passwordHash || ""),
    patch: change.patch,
    before: change.before,
    exp,
  });
  const root = String(origin || "").replace(/\/$/, "");
  return {
    saved: false,
    changes: changesOf(change.patch, change.before),
    approveUrl: `${root}/profile?assistant=${encodeURIComponent(token)}`,
    expiresAt: exp,
  };
}

async function loadProposal(token, session) {
  let payload;
  try {
    payload = readPayload(token, "assistant-profile-proposal");
  } catch (error) {
    throw fail(error.statusCode || 400, "This profile link has expired. Ask your assistant for a new one.");
  }
  if (!payload?.personId || payload.personId !== session.personId) {
    throw fail(403, "This change was requested for a different profile.");
  }
  const record = await requireLiveMember(payload);
  const patch = payload.patch;
  const before = payload.before;
  if (!patch || typeof patch !== "object" || !before || typeof before !== "object") {
    throw fail(400, "This profile link is not valid.");
  }
  for (const key of Object.keys(patch)) {
    if (!FIELDS[key] || !same(currentValue(record.person, key), before[key])) {
      throw fail(409, "Your profile changed after this link was made. Ask your assistant for a new one.");
    }
  }
  return { payload, record };
}

async function saveOwnProfile(person, session) {
  if (String(process.env.FORESIGHT_FORCE_MOCK || "") === "1") {
    const { saveLocalProfile } = require("../local-storage");
    return saveLocalProfile(person, session);
  }
  const { saveProfile } = require("../profile-store");
  return saveProfile(person, session);
}

async function reviewProfileProposal({ session, token, action }) {
  if (!session?.personId) throw fail(401, "Sign in to review this profile change.");
  const proposal = String(token || "");
  if (!proposal) throw fail(400, "Missing profile change.");
  const { payload, record } = await loadProposal(proposal, session);
  const changes = changesOf(payload.patch, payload.before);
  if (action !== "apply") return { saved: false, changes };
  const next = { ...record.person, id: record.person.id };
  for (const [key, value] of Object.entries(payload.patch)) {
    next[FIELDS[key].sheet] = value;
  }
  delete next.email;
  delete next.otherEmails;
  delete next.passwordHash;
  const saved = await saveOwnProfile(next, { personId: record.person.id, mustChangePassword: false });
  return { saved: true, changes, person: saved.person, auth: saved.auth };
}

module.exports = {
  proposeProfileChange,
  reviewProfileProposal,
  normalizePatch,
};
