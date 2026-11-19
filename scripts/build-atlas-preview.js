#!/usr/bin/env node
/**
 * Build a public, name-free atlas snapshot for the logged-out showcase.
 *
 * Reads RealData (sheet or mock), aggregates people by rounded coordinates,
 * and writes public/data/atlas-preview.json with ONLY:
 *   city, country, lat, lng, total, alumni, byRole
 * Community pins add byFocus. A person in two areas increments both.
 * The team is on both faces. Community accounts stay off Programs.
 * No person ids, names, emails, bios, or contact fields — ever.
 *
 * Run manually whenever you want a fresh snapshot (weekly / monthly is fine):
 *   pnpm preview:atlas
 *
 * Requires the same sheet credentials as other scripts (.env.local).
 */

"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { loadRealDataRecords } = require("../server/realdata-store");
const { isCommunityPerson, parseRoleTypes } = require("../server/role-types");
const { sharesCommunityAtlas } = require("../server/directory-layer");

const FOCUS_AREAS = [
  "Secure AI",
  "Neurotechnology",
  "Longevity Biotechnology",
  "Nanotechnology",
  "Space",
  "Existential Hope",
];

const OUT_PATH = path.resolve(__dirname, "../public/data/atlas-preview.json");
/** ~110m — enough to cluster a city block without exposing an exact address. */
const COORD_DECIMALS = 3;

const ROLE_ORDER = [
  "Fellow",
  "Senior Fellow",
  "Grantee",
  "Prize Winner",
  "Nodee",
  "Foresight Team",
];

function roundCoord(n) {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(Number(n) * f) / f;
}

function isAlumni(person) {
  if (person?.isAlumni) return true;
  const year = new Date().getFullYear();
  if (person?.fellowshipEndYear != null && person.fellowshipEndYear < year) return true;
  if (
    person?.fellowshipCohortYear >= 1900 &&
    person.fellowshipCohortYear < year &&
    person.fellowshipEndYear == null
  ) {
    return true;
  }
  return false;
}

function primaryRole(person) {
  const roles =
    Array.isArray(person.roleTypes) && person.roleTypes.length
      ? person.roleTypes
      : parseRoleTypes(person.roleType);
  const role = String(roles[0] || "Fellow").trim();
  return ROLE_ORDER.includes(role) ? role : "Fellow";
}

function placed(person) {
  const lat = Number(person.currentCoordinates?.lat);
  const lng = Number(person.currentCoordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

function focusLabels(person) {
  const tags = Array.isArray(person.focusTags) ? person.focusTags : [];
  const chosen = tags.map((tag) => String(tag).trim()).filter((tag) => FOCUS_AREAS.includes(tag));
  return chosen.length ? [...new Set(chosen)] : ["No focus area"];
}

async function main() {
  const { records } = await loadRealDataRecords();
  /** @type {Map<string, object>} */
  const programPins = new Map();
  /** @type {Map<string, object>} */
  const communityPins = new Map();
  let programPeople = 0;
  let communityPeople = 0;

  for (const record of records || []) {
    const person = record?.person;
    if (!person?.fullName || person.isPrivate) continue;
    const coords = placed(person);
    if (!coords) continue;

    /*
     * Community accounts stay on the community face. Everyone else, including
     * the team, is on Programs. The team is also on Community, same pins.
     */
    const onCommunity = sharesCommunityAtlas(person);
    const onPrograms = !isCommunityPerson(person);
    if (onCommunity) communityPeople += 1;
    if (onPrograms) programPeople += 1;

    const key = `${coords.lat},${coords.lng}`;
    const ensure = (bucket) => {
      let pin = bucket.get(key);
      if (!pin) {
        pin = {
          city: String(person.currentCity || "").trim() || "Unknown",
          country: String(person.currentCountry || "").trim(),
          lat: coords.lat,
          lng: coords.lng,
          total: 0,
          alumni: 0,
          byRole: Object.fromEntries(ROLE_ORDER.map((role) => [role, 0])),
          byFocus: {},
        };
        bucket.set(key, pin);
      }
      pin.total += 1;
      if (!pin.city || pin.city === "Unknown") {
        const city = String(person.currentCity || "").trim();
        if (city) pin.city = city;
      }
      if (!pin.country) {
        const country = String(person.currentCountry || "").trim();
        if (country) pin.country = country;
      }
      return pin;
    };

    if (onPrograms) {
      const pin = ensure(programPins);
      if (isAlumni(person)) pin.alumni += 1;
      const role = primaryRole(person);
      pin.byRole[role] = (pin.byRole[role] || 0) + 1;
    }
    if (onCommunity) {
      const pin = ensure(communityPins);
      for (const label of focusLabels(person)) {
        pin.byFocus[label] = (pin.byFocus[label] || 0) + 1;
      }
    }
  }

  const pins = [...programPins.values()]
    .map((pin) => {
      const byRole = {};
      for (const role of ROLE_ORDER) {
        if (pin.byRole[role] > 0) byRole[role] = pin.byRole[role];
      }
      return {
        city: pin.city,
        country: pin.country,
        lat: pin.lat,
        lng: pin.lng,
        total: pin.total,
        alumni: pin.alumni,
        byRole,
      };
    })
    .sort((a, b) => b.total - a.total || a.city.localeCompare(b.city));

  const community = [...communityPins.values()]
    .map((pin) => ({
      city: pin.city,
      country: pin.country,
      lat: pin.lat,
      lng: pin.lng,
      total: pin.total,
      byFocus: pin.byFocus,
    }))
    .sort((a, b) => b.total - a.total || a.city.localeCompare(b.city));

  const payload = {
    generatedAt: new Date().toISOString(),
    personCount: programPeople,
    pinCount: pins.length,
    pins,
    community: {
      personCount: communityPeople,
      pinCount: community.length,
      pins: community,
    },
  };

  await fsp.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fsp.writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `Wrote ${pins.length} program pins (${programPeople} people) and ${community.length} community pins (${communityPeople} people) → ${path.relative(process.cwd(), OUT_PATH)}`,
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
