"use strict";

/**
 * Turn an event guest list into community accounts.
 *
 * Each new person gets a RealData row with no password, then a sign-in link.
 * People who already set a password are left alone. A name that already
 * belongs to a different email is not duplicated: the team can mail the
 * address already on file, or connect the new address to that same row.
 *
 * The reminder is scheduled with Resend for 14 days later. That is inside
 * Resend's 30-day scheduling window, so no second cron is required.
 * Idempotency keys are per email per day, so a retry does not send twice.
 */

const crypto = require("crypto");
const { parseGuestCsv, normalizeEmail } = require("./guest-csv");
const { issueSignInToken, SIGNIN_INVITE_TTL_MS } = require("./directory-auth");
const { addOtherEmail, findRecordsByEmail, accountEmails, maskEmail } = require("./account-emails");
const { isCommunityPerson, isForesightTeamPerson } = require("./role-types");
const { mailConfigured, sendMail, fromAddress } = require("./mail");
const { normalizeName } = require("./realdata-store");

const SLICE = 4;
const REMINDER_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_GUESTS = 400;

function emailKey(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 20);
}

function dayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function signInUrl(origin, personId) {
  const token = issueSignInToken(personId, SIGNIN_INVITE_TTL_MS);
  return `${origin}/claim?token=${encodeURIComponent(token)}`;
}

function eventPhrase(eventName) {
  const name = String(eventName || "").trim();
  return name ? name : "a Foresight event";
}

function renderInvite(guest, link, eventName) {
  const hello = guest.firstName || "there";
  const where = eventPhrase(eventName);
  const subject = "Your invite to the Foresight community";
  const text = [
    `Hi ${hello},`,
    "",
    `You were at ${where}. This is your personal link to a Foresight Atlas community account, so you can meet other people who have been to our events.`,
    link,
    "",
    "After you sign in, you can also connect an assistant: https://atlas.foresight.org/assistant",
    "",
    "The link signs you in. It works for 30 days. If you were not expecting this, you can ignore it.",
    "",
    "— Foresight Atlas",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(hello)},</p>
<p>You were at ${escapeHtml(where)}. This is your personal link to a Foresight Atlas community account, so you can meet other people who have been to our events.</p>
<p><a href="${escapeAttr(link)}">Sign in</a></p>
<p>After you sign in, you can also <a href="https://atlas.foresight.org/assistant">connect an assistant</a>.</p>
<p style="color:#666;font-size:14px">The link signs you in. It works for 30 days. If you were not expecting this, you can ignore it.</p>
<p>— Foresight Atlas</p>`;
  return { subject, text, html };
}

function renderReminder(guest, link) {
  const hello = guest.firstName || "there";
  const subject = "Still want to join the Foresight community?";
  const text = [
    `Hi ${hello},`,
    "",
    "If you already claimed your Foresight Atlas account, sign in at https://atlas.foresight.org and ignore the link below.",
    "",
    "If you still want to join, your invite is here:",
    link,
    "",
    "It is a way to meet other people who have been to Foresight events.",
    "",
    "— Foresight Atlas",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(hello)},</p>
<p>If you already claimed your Foresight Atlas account, <a href="https://atlas.foresight.org">sign in</a> and ignore the link below.</p>
<p>If you still want to join, <a href="${escapeAttr(link)}">your invite is here</a>. It is a way to meet other people who have been to Foresight events.</p>
<p>— Foresight Atlas</p>`;
  return { subject, text, html };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function classify(guest, records) {
  const matches = findRecordsByEmail(records, guest.email);
  if (matches.length > 0) {
    const byEmail = matches[0];
    if (byEmail.auth?.passwordHash || byEmail.auth?.claimedAt) {
      return { kind: "already_member", record: byEmail };
    }
    return { kind: "unclaimed", record: byEmail };
  }
  const sameName = records.find(
    (record) => normalizeName(record.person?.fullName) === normalizeName(guest.fullName),
  );
  if (sameName) return { kind: "name_taken", record: sameName };
  return { kind: "new" };
}

function resolutionFor(guest, resolutions) {
  const want = normalizeEmail(guest.email);
  const row = (resolutions || []).find((entry) => normalizeEmail(entry?.email) === want);
  const action = String(row?.action || "").trim();
  if (action === "link" || action === "connect" || action === "skip") return action;
  return "skip";
}

/**
 * @param {{ csv: string, eventName?: string, dryRun?: boolean, offset?: number, origin: string, resolutions?: Array<{ email: string, action: string }> }} input
 */
function renderExistingSignIn(fullName, link) {
  const hello = fullName || "there";
  const subject = "Sign in to your Foresight Atlas account";
  const text = [
    `Hi ${hello},`,
    "",
    "A guest list had your name with a different email. We kept that on the account you already have, instead of making a second one.",
    "",
    "This link signs you in:",
    link,
    "",
    "It works for 30 days. If this was not you, you can ignore it.",
    "",
    "— Foresight Atlas",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(hello)},</p>
<p>A guest list had your name with a different email. We kept that on the account you already have, instead of making a second one.</p>
<p><a href="${escapeAttr(link)}">Sign in</a></p>
<p style="color:#666;font-size:14px">It works for 30 days. If this was not you, you can ignore it.</p>`;
  return { subject, text, html };
}

async function resolveNameTaken(guest, record, action, loaded, records, origin, eventName) {
  if (action !== "link" && action !== "connect") return { status: "name_taken" };
  const { cloneRecord, upsertRealDataRecord } = require("./realdata-store");
  if (action === "connect") {
    const elsewhere = findRecordsByEmail(records, guest.email).some(
      (entry) => entry.person?.id !== record.person.id,
    );
    if (elsewhere) return { status: "email_taken" };
    const updated = cloneRecord(record);
    addOtherEmail(updated.person, guest.email);
    await upsertRealDataRecord(loaded.sheets, loaded.sheetName, updated);
    record.person.otherEmails = updated.person.otherEmails;
    const link = signInUrl(origin, record.person.id);
    const sent = await sendMail({
      to: guest.email,
      ...renderInvite(guest, link, eventName),
      idempotencyKey: `atlas-guest-connect/${emailKey(guest.email)}/${dayStamp()}`,
    });
    if (!sent.sent) return { status: sent.reason === "quota" ? "quota" : "mail_failed" };
    return { status: "connected" };
  }
  const existing = accountEmails(record.person)[0];
  if (!existing) return { status: "no_email" };
  const link = signInUrl(origin, record.person.id);
  const sent = await sendMail({
    to: existing,
    ...renderExistingSignIn(record.person.fullName, link),
    idempotencyKey: `atlas-guest-existing/${emailKey(existing)}/${dayStamp()}`,
  });
  if (!sent.sent) return { status: sent.reason === "quota" ? "quota" : "mail_failed" };
  return { status: "signin_sent" };
}

async function runGuestInvites(input) {
  const parsed = parseGuestCsv(input.csv);
  if (parsed.errors.length && parsed.guests.length === 0) {
    const err = new Error(parsed.errors[0].message);
    err.statusCode = 400;
    throw err;
  }
  if (parsed.guests.length > MAX_GUESTS) {
    const err = new Error(`A guest list can be up to ${MAX_GUESTS} people at a time.`);
    err.statusCode = 400;
    throw err;
  }

  const dryRun = input.dryRun === true;
  const offset = Math.max(0, Number(input.offset) || 0);
  const { loadRealDataRecords } = require("./realdata-store");
  const loaded = await loadRealDataRecords({ write: !dryRun });
  const records = loaded.records || [];

  if (dryRun) {
    const counts = { invite: 0, alreadyMember: 0, nameTaken: 0, invalid: parsed.errors.length };
    const preview = [];
    for (const guest of parsed.guests) {
      const row = classify(guest, records);
      if (row.kind === "already_member") counts.alreadyMember += 1;
      else if (row.kind === "name_taken") counts.nameTaken += 1;
      else counts.invite += 1;
      const role = row.record
        ? isForesightTeamPerson(row.record.person)
          ? "Foresight Team"
          : isCommunityPerson(row.record.person)
            ? "Community"
            : row.record.person.roleType || "Member"
        : "Community";
      const existing = row.kind === "name_taken" ? accountEmails(row.record.person)[0] : "";
      preview.push({
        line: guest.line,
        firstName: guest.firstName,
        email: guest.email,
        action: row.kind === "new" || row.kind === "unclaimed" ? "invite" : row.kind,
        role,
        ...(existing ? { maskedEmail: maskEmail(existing) } : {}),
      });
    }
    return {
      dryRun: true,
      mailConfigured: mailConfigured(),
      from: fromAddress(),
      reminderInDays: 14,
      counts,
      errors: parsed.errors,
      preview,
    };
  }

  if (!mailConfigured()) {
    const err = new Error(
      "Resend is not configured on this deploy yet. Add RESEND_API_KEY, then send the list.",
    );
    err.statusCode = 503;
    throw err;
  }

  const slice = parsed.guests.slice(offset, offset + SLICE);
  const results = [];
  for (const guest of slice) {
    const row = classify(guest, records);
    if (row.kind === "already_member") {
      results.push({ email: guest.email, firstName: guest.firstName, status: "already_member" });
      continue;
    }
    if (row.kind === "name_taken") {
      const action = resolutionFor(guest, input.resolutions);
      const handled = await resolveNameTaken(
        guest,
        row.record,
        action,
        loaded,
        records,
        input.origin,
        input.eventName,
      );
      results.push({ email: guest.email, firstName: guest.firstName, ...handled });
      if (handled.status === "quota") break;
      continue;
    }

    let personId = row.record?.person?.id;
    if (row.kind === "new") {
      try {
        const { createUnclaimedCommunityProfile } = require("./profile-store");
        const inserted = await createUnclaimedCommunityProfile(guest, loaded);
        personId = inserted.person.id;
        records.push(inserted);
      } catch (error) {
        results.push({
          email: guest.email,
          firstName: guest.firstName,
          status: "failed",
          error: error instanceof Error ? error.message : "Could not add this person.",
        });
        continue;
      }
    }

    const link = signInUrl(input.origin, personId);
    const key = emailKey(guest.email);
    const day = dayStamp();
    const invite = renderInvite(guest, link, input.eventName);
    const sent = await sendMail({
      to: guest.email,
      ...invite,
      idempotencyKey: `atlas-guest-invite/${key}/${day}`,
    });
    if (!sent.sent) {
      results.push({
        email: guest.email,
        firstName: guest.firstName,
        status: sent.reason === "quota" ? "quota" : "mail_failed",
      });
      if (sent.reason === "quota") break;
      continue;
    }

    const reminder = renderReminder(guest, link);
    const later = new Date(Date.now() + REMINDER_MS).toISOString();
    const scheduled = await sendMail({
      to: guest.email,
      ...reminder,
      scheduledAt: later,
      idempotencyKey: `atlas-guest-reminder/${key}/${day}`,
    });
    results.push({
      email: guest.email,
      firstName: guest.firstName,
      status: scheduled.sent ? "invited" : "invited_reminder_failed",
    });
  }

  const nextOffset = offset + slice.length;
  return {
    dryRun: false,
    from: fromAddress(),
    processed: results.length,
    nextOffset,
    done: nextOffset >= parsed.guests.length,
    total: parsed.guests.length,
    results,
  };
}

module.exports = { runGuestInvites };
