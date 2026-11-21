"use strict";

/**
 * Bios, insights, and event descriptions are other people's words.
 * Fence them so a homestead agent can still read the sentence, and has
 * a harder time mistaking it for an order addressed to itself.
 */

const OPEN = "«untrusted»";
const CLOSE = "«/untrusted»";

function fence(value) {
  const text = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/«\/?untrusted»/g, "'")
    .trim();
  if (!text) return "";
  return `${OPEN}\n${text}\n${CLOSE}`;
}

module.exports = { fence, OPEN, CLOSE };
