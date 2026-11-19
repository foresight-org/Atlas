"use strict";

/**
 * One reader for GET /api/database, shared by the Vercel handler and Express.
 *
 * scope=map          people + travel, live from the sheet. No Luma.
 * scope=programming  events (sheet merged with live Luma) + RSVPs.
 * anything else      the full payload, kept so the old single request still works.
 *
 * Nothing here is written to a JSON file. A cache miss always re-reads the sheet.
 */

const { getFullDatabaseFromSheet, getMapDatabaseFromSheet } = require("./sheet-database");
const { mergeSheetEventsWithLuma } = require("./luma-merge");
const { enrichRsvpsForApi } = require("./rsvp-enrichment");
const { layerMapFromRecords } = require("./directory-layer");

/** @param {unknown} value */
function atlasScope(value) {
  return value === "map" || value === "programming" ? value : "full";
}

/**
 * @param {"map" | "programming" | "full"} scope
 */
async function readAtlasDatabase(scope) {
  if (scope === "map") {
    return getMapDatabaseFromSheet();
  }

  const database = await getFullDatabaseFromSheet();
  const rosterRecords = database._rosterRecords;
  database._layer = layerMapFromRecords(rosterRecords);
  delete database._rosterRecords;
  database.events = await mergeSheetEventsWithLuma(database.events || []);
  database.rsvps = await enrichRsvpsForApi(database.rsvps, {
    events: database.events,
    records: rosterRecords,
    skipEventMerge: true,
  });

  if (scope === "programming") {
    // People stay on this payload so the community guest list can be cut to
    // the team and community accounts. The layer map is what lets the handler
    // tell a signed-in member from a stranger. Without it, Berlin 401s.
    return {
      people: database.people,
      _layer: database._layer,
      events: database.events,
      rsvps: database.rsvps,
    };
  }

  return database;
}

module.exports = {
  atlasScope,
  readAtlasDatabase,
};
