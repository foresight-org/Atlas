"use strict";

/**
 * Optional outbound mail via Resend.
 *
 * Default product path needs no mail / DNS: when RESEND_API_KEY is unset,
 * /access shows the magic link on screen after name + email match.
 *
 * Env (only if you later want email delivery):
 *   RESEND_API_KEY, SMTP_FROM, SMTP_REPLY_TO
 *   AUTH_REVEAL_LINKS=false — force hide on-screen links even without mail
 *
 * The default From uses foresightmatchmaker.app. That domain is already
 * verified on the Resend account Library of Things and Matchmaker share,
 * so Atlas can send without a new DNS change on foresight.org.
 * Set SMTP_FROM once a foresight.org subdomain is verified.
 */

const RESEND_API = "https://api.resend.com/emails";
const DEFAULT_FROM = "Foresight Atlas <noreply@foresightmatchmaker.app>";
const SEND_TIMEOUT_MS = 8_000;
const RETRY_WAIT_MS = 400;

function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function revealLinksAllowed() {
  // Explicit opt-out (e.g. staging with Resend half-configured).
  if (process.env.AUTH_REVEAL_LINKS === "false") return false;
  if (process.env.AUTH_REVEAL_LINKS === "true") return true;
  // No mail infra → on-screen links are the product (no DNS required).
  if (!mailConfigured()) return true;
  // Mail is live: don't also show the link (would burn one-time tokens).
  return false;
}

/** @returns {"email" | "on_screen" | "server_log"} */
function magicLinkMode() {
  if (mailConfigured()) return "email";
  if (revealLinksAllowed()) return "on_screen";
  return "server_log";
}

function fromAddress() {
  return process.env.SMTP_FROM?.trim() || DEFAULT_FROM;
}

function replyToAddress() {
  return process.env.SMTP_REPLY_TO?.trim() || undefined;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string, idempotencyKey?: string, scheduledAt?: string }} opts
 * @returns {Promise<{ sent: true, id: string | null } | { sent: false, reason: "no_smtp" | "smtp_error" | "quota" }>}
 */
async function sendMail(opts) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.info("[mail] RESEND_API_KEY unset; skipped a send:", opts.subject);
    return { sent: false, reason: "no_smtp" };
  }

  const payload = JSON.stringify({
    from: fromAddress(),
    to: [opts.to],
    reply_to: replyToAddress(),
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    ...(opts.scheduledAt ? { scheduled_at: opts.scheduledAt } : {}),
  });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "User-Agent": "foresight-atlas/mail",
          ...(opts.idempotencyKey
            ? { "Idempotency-Key": opts.idempotencyKey }
            : {}),
        },
        body: payload,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        return { sent: true, id: typeof body?.id === "string" ? body.id : null };
      }
      const detail = await res.text().catch(() => "");
      console.error("[mail] Resend rejected:", res.status, detail.slice(0, 500));
      if (res.status === 429) return { sent: false, reason: "quota" };
      if (res.status >= 500 && attempt < 2) {
        await sleep(RETRY_WAIT_MS);
        continue;
      }
      return { sent: false, reason: "smtp_error" };
    } catch (error) {
      console.error("[mail] Resend send failed:", error);
      if (attempt < 2) {
        await sleep(RETRY_WAIT_MS);
        continue;
      }
      return { sent: false, reason: "smtp_error" };
    }
  }
  return { sent: false, reason: "smtp_error" };
}

/**
 * The atlas on paper. Same quiet card as the app: white on a cool gray,
 * a blue-to-violet bar, near-black button. Georgia stands in for the
 * heading face, Helvetica for the body — mail clients drop web fonts.
 */
const PAPER = "#f3f5f7";
const INK = "#111827";
const MUTED = "#4b5563";
const FAINT = "#6b7280";
const LINE = "#e5e7eb";
const BUTTON = "#030213";
const SITE = "https://atlas.foresight.org";
const LOGO = `${SITE}/brand/foresight-logo.png`;

function givenName(fullName) {
  const name = String(fullName || "").trim();
  if (!name || name.includes("@")) return "";
  return name.split(/\s+/)[0];
}

/**
 * @param {{ subject: string, preheader: string, title: string, body: string, button: string, href: string, note: string }} copy
 */
function renderAtlasEmail(copy) {
  const href = escapeAttr(copy.href);
  const text = [
    copy.title,
    "",
    copy.body,
    "",
    copy.button,
    copy.href,
    "",
    copy.note,
    "",
    "Foresight Institute · Foresight Atlas",
    SITE,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:520px;background:#ffffff;border:1px solid ${LINE};border-radius:20px;overflow:hidden;">
          <tr>
            <td style="height:6px;line-height:6px;font-size:0;background-color:#c4b5fd;background-image:linear-gradient(90deg,#bfdbfe 0%,#c4b5fd 100%);">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <img src="${LOGO}" alt="Foresight Institute" width="148" style="display:block;width:148px;height:auto;border:0;" />
              <p style="margin:22px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${FAINT};">Foresight Atlas</p>
              <h1 style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:normal;letter-spacing:-0.02em;color:${INK};">${escapeHtml(copy.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:${MUTED};">${escapeHtml(copy.body)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${BUTTON};border-radius:10px;">
                    <a href="${href}" style="display:inline-block;padding:12px 20px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.01em;text-decoration:none;color:#ffffff;">${escapeHtml(copy.button)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${FAINT};">${escapeHtml(copy.note)}</p>
              <p style="margin:10px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${FAINT};word-break:break-all;">
                <a href="${href}" style="color:#0369a1;">${href}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 26px 32px;">
              <p style="margin:0;padding-top:18px;border-top:1px solid ${LINE};font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${FAINT};">Foresight Institute · Foresight Atlas</p>
              <p style="margin:4px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;">
                <a href="${SITE}" style="color:#0369a1;">atlas.foresight.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: copy.subject, text, html };
}

/**
 * @param {"claim" | "reset"} kind
 * @param {string} link
 * @param {string} [fullName]
 */
function withName(fullName, sentence) {
  const name = givenName(fullName);
  return name ? `Hi ${name}, ${sentence}` : sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function renderAccessEmail(kind, link, fullName) {
  if (kind === "reset") {
    return renderAtlasEmail({
      subject: "Reset your Foresight Atlas password",
      preheader: "This link expires in 24 hours.",
      title: "New password",
      body: withName(fullName, "this link sets a new password for your atlas."),
      button: "Set a new password",
      href: link,
      note: "It expires in 24 hours. If you did not ask for it, you can ignore it.",
    });
  }
  return renderAtlasEmail({
    subject: "Your Foresight Atlas link",
    preheader: "Set the password for your atlas account.",
    title: "Set your password",
    body: withName(fullName, "this link sets the password for your atlas account."),
    button: "Set password",
    href: link,
    note: "If you did not ask for it, you can ignore it.",
  });
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

/**
 * @param {string} email
 * @param {string} link
 * @param {"claim" | "reset"} kind
 * @param {string} [fullName]
 */
function renderSignInEmail(link, fullName) {
  return renderAtlasEmail({
    subject: "Sign in to Foresight Atlas",
    preheader: "This link expires in 24 hours.",
    title: "Sign in",
    body: withName(fullName, "this link opens your atlas."),
    button: "Sign in",
    href: link,
    note: "It expires in 24 hours. If you did not ask for it, you can ignore it.",
  });
}

/**
 * Sign-in mail. Never log the address or the link.
 */
async function sendSignInLink(email, link, fullName, idempotencyKey) {
  if (!mailConfigured()) {
    return { sent: false, reason: "no_smtp" };
  }
  const { subject, text, html } = renderSignInEmail(link, fullName);
  return sendMail({
    to: email,
    subject,
    text,
    html,
    idempotencyKey,
  });
}

async function sendAccessMagicLink(email, link, kind, fullName) {
  if (!mailConfigured()) {
    console.info(`[auth] magic link (${kind}) for ${email}: ${link}`);
    return { sent: false, reason: "no_smtp" };
  }
  const { subject, text, html } = renderAccessEmail(kind, link, fullName);
  const result = await sendMail({
    to: email,
    subject,
    text,
    html,
    idempotencyKey: `atlas-${kind}-${email}-${Date.now()}`,
  });
  if (!result.sent) {
    console.info(`[auth] magic link (${kind}) for ${email} (send failed): ${link}`);
  }
  return result;
}

module.exports = {
  mailConfigured,
  revealLinksAllowed,
  magicLinkMode,
  sendMail,
  fromAddress,
  sendAccessMagicLink,
  sendSignInLink,
  renderAccessEmail,
  renderAtlasEmail,
};
