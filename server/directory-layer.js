"use strict";

/**
 * Two atlases from one roster.
 *
 * A community account is the outer layer: other community profiles, and
 * nothing from the fellow, grantee, nodee, prize, or team network. An inner
 * account keeps today's atlas and does not see community signups mixed in.
 * The split happens before a response is sent. The shared cache stores both
 * views and the handler picks one from the signed-in person.
 */

const { isCommunityPerson, isForesightTeamPerson } = require("./role-types");

/**
 * c — community account, outer atlas only.
 * t — Foresight Team, inner atlas, and may ask to look at the outer one.
 * i — every other inner account. Nodes stay on this side.
 * A community role wins over team, so a signup cannot climb into the inner atlas.
 */
function layerCode(person) {
  if (isCommunityPerson(person)) return "c";
  if (isForesightTeamPerson(person)) return "t";
  return "i";
}

function layerMapFromRecords(records) {
  /** @type {Record<string, "c" | "t" | "i">} */
  const layer = {};
  for (const record of records || []) {
    const person = record?.person || record;
    if (!person?.id) continue;
    layer[person.id] = layerCode(person);
  }
  return layer;
}

function requestedDirectoryLayer(query) {
  return String(query?.layer || "").trim().toLowerCase() === "community" ? "community" : "inner";
}

/**
 * Which prebuilt body this person may receive.
 * Community always gets the outer atlas. Inner accounts always get the inner one.
 * Team receives the inner atlas unless they asked for the community view.
 * @returns {"community" | "inner" | null}
 */
function directoryViewFor(layer, viewerId, requested) {
  const which = layer?.[viewerId];
  if (which === "c") return "community";
  if (which === "t") return requested === "community" ? "community" : "inner";
  if (which === "i") return "inner";
  return null;
}

/**
 * @param {Record<string, unknown>} db
 * @returns {{ inner: string, community: string, layer: Record<string, "c" | "i"> }}
 */
function splitDirectory(db) {
  /** @type {Record<string, "c" | "t" | "i">} */
  const layer = { ...(db?._layer || {}) };
  const people = Array.isArray(db?.people) ? db.people : [];
  for (const person of people) {
    if (!person?.id || layer[person.id]) continue;
    layer[person.id] = layerCode(person);
  }

  const outer = (id) => layer[id] === "c";
  const travel = Array.isArray(db?.travelWindows) ? db.travelWindows : [];
  const rsvps = Array.isArray(db?.rsvps) ? db.rsvps : [];
  const events = Array.isArray(db?.events) ? db.events : [];

  const inner = {
    people: people.filter((person) => person?.id && !outer(person.id)),
    travelWindows: travel.filter((row) => row?.personId && !outer(row.personId)),
    events,
    rsvps: rsvps.filter((row) => !row?.personId || !outer(row.personId)),
    suggestions: Array.isArray(db?.suggestions) ? db.suggestions : [],
    adminUsers: Array.isArray(db?.adminUsers) ? db.adminUsers : [],
  };
  const community = {
    people: people.filter((person) => person?.id && outer(person.id)),
    travelWindows: travel.filter((row) => row?.personId && outer(row.personId)),
    events: [],
    rsvps: [],
    suggestions: [],
    adminUsers: [],
  };

  return {
    inner: JSON.stringify(inner),
    community: JSON.stringify(community),
    layer,
  };
}

async function layeredDirectory(scope) {
  const { readAtlasDatabase } = require("./atlas-read");
  return splitDirectory(await readAtlasDatabase(scope));
}

module.exports = {
  layerMapFromRecords,
  splitDirectory,
  layeredDirectory,
  requestedDirectoryLayer,
  directoryViewFor,
  isCommunityPerson,
};
