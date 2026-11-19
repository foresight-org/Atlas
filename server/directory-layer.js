"use strict";

/**
 * Two atlases from one roster.
 *
 * A community account sees other community profiles and the team.
 * Fellows, grantees, prize winners, and nodees stay on the inner atlas.
 * Events and RSVPs for the people on this view come too.
 * Node memory stays on the inner atlas. Inner accounts do not see community
 * signups mixed into the fellow map.
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

/**
 * Who may appear on the wider community atlas. Private profiles never do.
 * The community view is the team and community accounts. An inner member
 * does not cross over by opting in.
 */
function sharesCommunityAtlas(person) {
  if (!person?.id || person.isPrivate === true) return false;
  return isCommunityPerson(person) || isForesightTeamPerson(person);
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

  const communityPeople = people.filter((person) => sharesCommunityAtlas(person));
  const communityIds = new Set(communityPeople.map((person) => person.id));
  const travel = Array.isArray(db?.travelWindows) ? db.travelWindows : [];
  const rsvps = Array.isArray(db?.rsvps) ? db.rsvps : [];
  const events = Array.isArray(db?.events) ? db.events : [];

  const inner = {
    people: people.filter((person) => person?.id && !isCommunityPerson(person)),
    travelWindows: travel.filter((row) => row?.personId && layer[row.personId] !== "c"),
    events,
    rsvps,
    suggestions: Array.isArray(db?.suggestions) ? db.suggestions : [],
    adminUsers: Array.isArray(db?.adminUsers) ? db.adminUsers : [],
  };
  const community = {
    people: communityPeople,
    travelWindows: travel.filter((row) => row?.personId && communityIds.has(row.personId)),
    events,
    rsvps: rsvps.filter((row) => row?.personId && communityIds.has(row.personId)),
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
  sharesCommunityAtlas,
  isCommunityPerson,
};
