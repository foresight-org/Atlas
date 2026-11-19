"use strict";

/**
 * One person, one roster row, possibly more than one inbox.
 * `email` is the address we already had. `otherEmails` holds later ones
 * (a second event registration) so we never open a duplicate account.
 */

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function otherEmailList(person) {
  return String(person?.otherEmails || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

function accountEmails(person) {
  const primary = normalizeEmail(person?.email);
  const extras = otherEmailList(person).filter((email) => email !== primary);
  return primary ? [primary, ...extras] : extras;
}

function personHasEmail(person, email) {
  const want = normalizeEmail(email);
  if (!want) return false;
  return accountEmails(person).includes(want);
}

function findRecordsByEmail(records, email) {
  const want = normalizeEmail(email);
  if (!want) return [];
  return (records || []).filter((record) => personHasEmail(record.person, want));
}

/**
 * Attach an address that is not already on this person.
 * Returns false when it was already there.
 */
function addOtherEmail(person, email) {
  const want = normalizeEmail(email);
  if (!want || !want.includes("@")) {
    const err = new Error("Enter a valid email address.");
    err.statusCode = 400;
    throw err;
  }
  if (personHasEmail(person, want)) return false;
  const extras = otherEmailList(person);
  extras.push(want);
  person.otherEmails = extras.join(",");
  return true;
}

function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return "";
  const name = normalized.slice(0, at);
  const domain = normalized.slice(at);
  const visible = name.slice(0, 1);
  return `${visible}•••${domain}`;
}

module.exports = {
  normalizeEmail,
  accountEmails,
  personHasEmail,
  findRecordsByEmail,
  addOtherEmail,
  maskEmail,
};
