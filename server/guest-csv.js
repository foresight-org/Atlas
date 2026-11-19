"use strict";

/**
 * Event guest lists.
 *
 * A Luma export, or a sheet saved as CSV, with a first name, a last name,
 * and an email. Header names vary. The parser accepts the usual ones and
 * ignores every other column.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

/** Split one CSV line, including quoted commas. */
function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function headerKind(cell) {
  const key = String(cell || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (key === "email" || key === "emailaddress" || key === "guestemail") return "email";
  if (key === "firstname" || key === "first" || key === "givenname") return "first";
  if (key === "lastname" || key === "last" || key === "surname" || key === "familyname") return "last";
  if (key === "name" || key === "fullname") return "full";
  return "";
}

/**
 * @param {string} text
 * @returns {{ guests: { firstName: string, lastName: string, fullName: string, email: string, line: number }[], errors: { line: number, message: string }[] }}
 */
function parseGuestCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length === 0) {
    return { guests: [], errors: [{ line: 1, message: "The file is empty." }] };
  }

  const header = splitCsvLine(lines[0]).map(headerKind);
  const hasHeader = header.includes("email");
  const start = hasHeader ? 1 : 0;
  const index = {
    email: hasHeader ? header.indexOf("email") : 2,
    first: hasHeader ? header.indexOf("first") : 0,
    last: hasHeader ? header.indexOf("last") : 1,
    full: hasHeader ? header.indexOf("full") : -1,
  };
  if (!hasHeader && lines.length && !EMAIL.test(normalizeEmail(splitCsvLine(lines[0])[2] || ""))) {
    return {
      guests: [],
      errors: [{ line: 1, message: "Add a header row with first name, last name, and email." }],
    };
  }

  /** @type {Map<string, { firstName: string, lastName: string, fullName: string, email: string, line: number }>} */
  const byEmail = new Map();
  /** @type {{ line: number, message: string }[]} */
  const errors = [];

  for (let i = start; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const line = i + 1;
    const email = normalizeEmail(cells[index.email] || "");
    const firstName = String(index.first >= 0 ? cells[index.first] || "" : "").trim();
    const lastName = String(index.last >= 0 ? cells[index.last] || "" : "").trim();
    const fullFromColumn = String(index.full >= 0 ? cells[index.full] || "" : "").trim();
    const fullName = fullFromColumn || [firstName, lastName].filter(Boolean).join(" ");
    if (!email && !fullName) continue;
    if (!EMAIL.test(email) || email.length > 120) {
      errors.push({ line, message: "That row needs a valid email." });
      continue;
    }
    if (!fullName || fullName.length > 120) {
      errors.push({ line, message: "That row needs a first and last name." });
      continue;
    }
    if (byEmail.has(email)) continue;
    byEmail.set(email, { firstName: firstName || fullName.split(" ")[0], lastName, fullName, email, line });
  }

  return { guests: [...byEmail.values()], errors };
}

module.exports = { parseGuestCsv, normalizeEmail };
