"use strict";

/**
 * The only door from the assistant connector into Atlas data.
 *
 * Tools ask this module for a snapshot. It returns community records with
 * the roster email already gone, and it will not list a private profile.
 * Senior Fellows / Prize Winners appear without contact fields. The
 * signed-in member can still read their own profile.
 */

const { passwordVersion } = require("../directory-auth");
const { redactPublicContactFields } = require("../role-types");

const BOOKING_URL = /^https?:\/\/[^\s]+$/i;

function isListed(person) {
  return Boolean(person && person.fullName && person.isPrivate !== true);
}

function clip(value, max) {
  const text = String(value || "")
    .replace(/\u0000/g, "")
    .trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function bookingUrl(value) {
  const url = String(value || "").trim();
  if (!url || url.length > 220 || !BOOKING_URL.test(url)) return null;
  return url;
}

/**
 * Fields a member's assistant is allowed to see. The roster `email` column
 * is never copied, even if a caller forgot to strip it upstream.
 */
function publicCard(person) {
  const safe = redactPublicContactFields(person) || person;
  const roles = Array.isArray(safe.roleTypes) && safe.roleTypes.length
    ? safe.roleTypes
    : [safe.roleType].filter(Boolean);
  const card = {
    name: safe.fullName,
    roles,
    node: safe.primaryNode || "",
    city: safe.currentCity || "",
    country: safe.currentCountry || "",
    focus: Array.isArray(safe.focusTags) ? safe.focusTags : [],
    affiliation: safe.affiliationOrInstitution || "",
    tagline: clip(safe.shortProjectTagline, 240),
    about: clip(safe.expandedProjectDescription, 500),
    lookingFor: clip(safe.currentlyLookingFor, 220),
    contact: safe.contactUrlOrHandle || "",
    calendarEmail: safe.calendarEmail || "",
    bookingUrl: bookingUrl(safe.availabilityUrl) || "",
    profileUrl: safe.profileUrl || "",
  };
  return Object.fromEntries(Object.entries(card).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== "";
  }));
}

async function loadCommunity() {
  if (String(process.env.FORESIGHT_FORCE_MOCK || "") === "1") {
    const { getLocalDatabase, getLocalAuth } = require("../local-storage");
    const db = await getLocalDatabase();
    const auth = await getLocalAuth();
    const people = Array.isArray(db.people) ? db.people : [];
    const byId = {};
    for (const person of people) {
      if (!person?.id) continue;
      byId[person.id] = { person, auth: auth[person.id] || {} };
    }
    return {
      publicPeople: people.filter(isListed),
      events: Array.isArray(db.events) ? db.events : [],
      rsvps: Array.isArray(db.rsvps) ? db.rsvps : [],
      byId,
    };
  }

  const { getFullDatabaseFromSheet } = require("../sheet-database");
  const db = await getFullDatabaseFromSheet();
  const byId = {};
  for (const record of db._rosterRecords || []) {
    if (!record?.person?.id) continue;
    byId[record.person.id] = { person: record.person, auth: record.auth || {} };
  }
  return {
    publicPeople: Array.isArray(db.people) ? db.people.filter(isListed) : [],
    events: Array.isArray(db.events) ? db.events : [],
    rsvps: Array.isArray(db.rsvps) ? db.rsvps : [],
    byId,
  };
}

async function loadAuthRecord(personId) {
  const community = await loadCommunity();
  return community.byId[personId] || null;
}

/**
 * A claimed member whose password still matches the token we issued.
 * Password changes and unclaimed profiles both fail closed.
 */
async function requireLiveMember(payload) {
  const record = await loadAuthRecord(payload.personId);
  const hash = record?.auth?.passwordHash || "";
  if (!record?.person || !hash || record.auth.mustChangePassword) {
    const err = new Error("This assistant connection is no longer valid. Sign in again from the Atlas.");
    err.statusCode = 401;
    err.oauthError = "invalid_grant";
    throw err;
  }
  if (passwordVersion(hash) !== payload.pwv) {
    const err = new Error("Your password changed, so this assistant was disconnected.");
    err.statusCode = 401;
    err.oauthError = "invalid_grant";
    throw err;
  }
  return record;
}

module.exports = {
  publicCard,
  isListed,
  loadCommunity,
  loadAuthRecord,
  requireLiveMember,
  bookingUrl,
};
