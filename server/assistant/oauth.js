"use strict";

/**
 * OAuth 2.1 for the assistant connector.
 *
 * Claude and ChatGPT register themselves (CIMD or dynamic client registration)
 * and send the member to the Atlas to sign in. Tokens are HMAC-signed with
 * the same secret as directory sessions, but a different prefix, so an
 * assistant token cannot be replayed against /api/database and a directory
 * session cannot call the connector.
 *
 * Nothing here is stored. A password change moves the password fingerprint
 * and every outstanding token stops verifying.
 */

const crypto = require("crypto");
const { passwordVersion } = require("../directory-auth");

const DOMAIN = "atlas-assistant.v1";
const SCOPE = "atlas:read";
const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CLAUDE_CALLBACKS = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]);
const CHATGPT_STABLE = "https://chatgpt.com/connector_platform_oauth_redirect";
const CIMD_HOSTS = new Set([
  "claude.ai",
  "www.claude.ai",
  "claude.com",
  "www.claude.com",
  "chatgpt.com",
  "www.chatgpt.com",
  "nousresearch.github.io",
]);

const redeemedCodes = new Map();
const cimdCache = new Map();

function secret() {
  return (
    process.env.DIRECTORY_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    "foresightatlas-directory-session-secret"
  );
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signPayload(payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret()).update(`${DOMAIN}.${body}`).digest("base64url");
  return `${body}.${sig}`;
}

function readPayload(token, purpose) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    const err = new Error("Missing assistant credential.");
    err.statusCode = 401;
    err.oauthError = "invalid_token";
    throw err;
  }
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(`${DOMAIN}.${body}`).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig || "");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const err = new Error("Invalid assistant credential.");
    err.statusCode = 401;
    err.oauthError = "invalid_token";
    throw err;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    const err = new Error("Invalid assistant credential.");
    err.statusCode = 401;
    err.oauthError = "invalid_token";
    throw err;
  }
  if (!payload || payload.purpose !== purpose) {
    const err = new Error("Invalid assistant credential.");
    err.statusCode = 401;
    err.oauthError = "invalid_token";
    throw err;
  }
  if (!payload.exp || new Date(payload.exp).getTime() <= Date.now()) {
    const err = new Error("This assistant connection expired. Sign in again.");
    err.statusCode = 401;
    err.oauthError = "invalid_grant";
    throw err;
  }
  return payload;
}

function oauthError(statusCode, oauthError, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.oauthError = oauthError;
  return err;
}

function mcpResource(origin) {
  return `${origin}/api/assistant/mcp`;
}

function isAllowedRedirectUri(uri) {
  let url;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  if (CLAUDE_CALLBACKS.has(uri) || uri === CHATGPT_STABLE) return true;
  if (
    url.protocol === "https:" &&
    url.hostname === "chatgpt.com" &&
    /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(url.pathname) &&
    !url.search
  ) {
    return true;
  }
  if (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
    url.pathname === "/callback"
  ) {
    return true;
  }
  return false;
}

function pkceOk(value) {
  // RFC 7636 unreserved set. The MCP client Hermes uses draws the verifier
  // from this whole alphabet, including "." and "~".
  return typeof value === "string" && /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

function parseScope(scope) {
  const parts = String(scope || SCOPE).split(/[\s+]+/).filter(Boolean);
  const allowed = new Set([SCOPE, "offline_access"]);
  if (parts.length === 0) return SCOPE;
  if (parts.some((part) => !allowed.has(part))) return null;
  if (!parts.includes(SCOPE)) parts.unshift(SCOPE);
  return parts.join(" ");
}

function pruneRedeemed(now) {
  for (const [jti, exp] of redeemedCodes) {
    if (exp <= now) redeemedCodes.delete(jti);
  }
}

function claimCodeJti(jti, expMs) {
  const now = Date.now();
  pruneRedeemed(now);
  if (redeemedCodes.has(jti)) return false;
  redeemedCodes.set(jti, expMs);
  if (redeemedCodes.size > 5000) pruneRedeemed(now);
  return true;
}

function signClient(redirectUris) {
  return signPayload({
    purpose: "assistant-client",
    r: redirectUris,
    iat: Date.now(),
    exp: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

function clientFromDcr(clientId) {
  try {
    const payload = readPayload(clientId, "assistant-client");
    const redirectUris = Array.isArray(payload.r) ? payload.r.filter(isAllowedRedirectUri) : [];
    if (!redirectUris.length) return null;
    return { redirectUris, name: "Assistant" };
  } catch {
    return null;
  }
}

async function clientFromCimd(clientId) {
  let url;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !CIMD_HOSTS.has(url.hostname) || url.username || url.password) {
    return null;
  }
  const cached = cimdCache.get(clientId);
  if (cached && cached.exp > Date.now()) return cached.doc;
  const response = await fetch(clientId, {
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw oauthError(400, "invalid_client", "Could not read that assistant's client metadata.");
  const text = await response.text();
  if (text.length > 16000) throw oauthError(400, "invalid_client", "That assistant's client metadata is too large.");
  const doc = JSON.parse(text);
  if (doc.client_id && doc.client_id !== clientId) {
    throw oauthError(400, "invalid_client", "That assistant's client metadata does not match its URL.");
  }
  const redirectUris = (Array.isArray(doc.redirect_uris) ? doc.redirect_uris : []).filter(isAllowedRedirectUri);
  if (!redirectUris.length) throw oauthError(400, "invalid_client", "That assistant is not an allowed connector.");
  const parsed = {
    redirectUris,
    name: String(doc.client_name || "Assistant").slice(0, 80),
  };
  cimdCache.set(clientId, { exp: Date.now() + 10 * 60 * 1000, doc: parsed });
  return parsed;
}

async function resolveClient(clientId) {
  if (typeof clientId !== "string" || clientId.length < 8 || clientId.length > 2048) return null;
  if (clientId.startsWith("https://")) return clientFromCimd(clientId);
  return clientFromDcr(clientId);
}

function loopbackCallback(uri) {
  let url;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
    url.pathname === "/callback" &&
    !url.search
  );
}

async function assertClientRedirect(clientId, redirectUri) {
  if (!isAllowedRedirectUri(redirectUri)) {
    throw oauthError(400, "invalid_request", "That assistant is not allowed to receive a sign-in code.");
  }
  const client = await resolveClient(clientId);
  // Hermes Desktop keeps the public client document and then listens on
  // whichever loopback port is free. The code is still bound by PKCE.
  const sameLoopback =
    String(clientId).startsWith("https://") &&
    loopbackCallback(redirectUri) &&
    client?.redirectUris.some(loopbackCallback);
  if (!client || (!client.redirectUris.includes(redirectUri) && !sameLoopback)) {
    throw oauthError(400, "invalid_client", "That assistant is not registered for this connection.");
  }
  return client;
}

function sameResource(value, origin) {
  if (!value) return true;
  return String(value).replace(/\/$/, "") === mcpResource(origin);
}

async function beginAuthorization(query, origin) {
  const responseType = String(query.response_type || "");
  const clientId = String(query.client_id || "");
  const redirectUri = String(query.redirect_uri || "");
  const challenge = String(query.code_challenge || "");
  const method = String(query.code_challenge_method || "");
  const state = String(query.state || "");
  const resource = String(query.resource || "");
  if (responseType !== "code") throw oauthError(400, "unsupported_response_type", "Only authorization code sign-in is supported.");
  if (method !== "S256" || !pkceOk(challenge)) {
    throw oauthError(400, "invalid_request", "This connection must use PKCE S256.");
  }
  if (!state || state.length > 512 || /[\r\n]/.test(state)) {
    throw oauthError(400, "invalid_request", "Missing sign-in state.");
  }
  const scope = parseScope(query.scope);
  if (!scope) throw oauthError(400, "invalid_scope", "This connector is read-only.");
  if (!sameResource(resource, origin)) {
    throw oauthError(400, "invalid_target", "That connection asked for a different resource.");
  }
  await assertClientRedirect(clientId, redirectUri);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope,
    resource: resource || mcpResource(origin),
  });
  return { location: `${origin}/assistant?${params.toString()}` };
}

function registerClient(body) {
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!redirectUris.length || redirectUris.length > 8) {
    throw oauthError(400, "invalid_client_metadata", "Provide the assistant's redirect URL.");
  }
  if (redirectUris.some((uri) => !isAllowedRedirectUri(uri))) {
    throw oauthError(400, "invalid_redirect_uri", "That assistant is not allowed to connect to the Atlas.");
  }
  const method = body?.token_endpoint_auth_method || "none";
  if (method !== "none") {
    throw oauthError(400, "invalid_client_metadata", "This connector only accepts public clients.");
  }
  const unique = Array.from(new Set(redirectUris));
  return {
    client_id: signClient(unique),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: unique,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_name: String(body?.client_name || "Foresight Atlas").replace(/[\r\n]/g, " ").slice(0, 80),
  };
}

async function completeConsent({ personId, fullName, passwordHash, body, origin }) {
  const clientId = String(body?.client_id || "");
  const redirectUri = String(body?.redirect_uri || "");
  const challenge = String(body?.code_challenge || "");
  const method = String(body?.code_challenge_method || "");
  const state = String(body?.state || "");
  const resource = String(body?.resource || mcpResource(origin));
  if (method !== "S256" || !pkceOk(challenge)) {
    throw oauthError(400, "invalid_request", "This connection must use PKCE S256.");
  }
  if (!state || state.length > 512) throw oauthError(400, "invalid_request", "Missing sign-in state.");
  if (!sameResource(resource, origin)) {
    throw oauthError(400, "invalid_target", "That connection asked for a different resource.");
  }
  await assertClientRedirect(clientId, redirectUri);
  const deny = String(body?.action || "allow") === "deny";
  const back = new URL(redirectUri);
  back.searchParams.set("iss", origin);
  back.searchParams.set("state", state);
  if (deny) {
    back.searchParams.set("error", "access_denied");
    return { redirectTo: back.toString() };
  }
  const exp = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const code = signPayload({
    purpose: "assistant-code",
    personId,
    fullName,
    pwv: passwordVersion(passwordHash),
    clientId,
    redirectUri,
    challenge,
    aud: mcpResource(origin),
    jti: crypto.randomBytes(16).toString("base64url"),
    exp,
  });
  back.searchParams.set("code", code);
  return { redirectTo: back.toString() };
}

function issueTokens({ personId, fullName, pwv, clientId, aud }) {
  const accessExp = new Date(Date.now() + ACCESS_TTL_MS).toISOString();
  const refreshExp = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  return {
    access_token: signPayload({
      purpose: "assistant",
      personId,
      fullName,
      pwv,
      clientId,
      aud,
      scope: SCOPE,
      exp: accessExp,
    }),
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: signPayload({
      purpose: "assistant-refresh",
      personId,
      fullName,
      pwv,
      clientId,
      aud,
      exp: refreshExp,
    }),
    scope: SCOPE,
  };
}

async function exchangeToken(body, origin) {
  const { requireLiveMember } = require("./directory");
  const grant = String(body?.grant_type || "");
  const clientId = String(body?.client_id || "");
  const resource = String(body?.resource || "");
  if (!sameResource(resource, origin)) {
    throw oauthError(400, "invalid_target", "That connection asked for a different resource.");
  }
  if (grant === "authorization_code") {
    const code = readPayload(String(body?.code || ""), "assistant-code");
    if (code.clientId !== clientId) throw oauthError(400, "invalid_grant", "This sign-in code belongs to a different assistant.");
    if (code.redirectUri !== String(body?.redirect_uri || "")) {
      throw oauthError(400, "invalid_grant", "The redirect URL does not match.");
    }
    if (code.aud !== mcpResource(origin)) throw oauthError(400, "invalid_grant", "This sign-in code is for a different server.");
    const verifier = String(body?.code_verifier || "");
    if (!pkceOk(verifier)) {
      throw oauthError(
        400,
        "invalid_grant",
        verifier ? "PKCE verifier was rejected." : "Missing PKCE verifier.",
      );
    }
    const hashed = crypto.createHash("sha256").update(verifier).digest("base64url");
    const left = Buffer.from(hashed);
    const right = Buffer.from(code.challenge || "");
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw oauthError(400, "invalid_grant", "PKCE verification failed.");
    }
    if (!claimCodeJti(code.jti, new Date(code.exp).getTime())) {
      throw oauthError(400, "invalid_grant", "This sign-in code was already used.");
    }
    await requireLiveMember(code);
    return issueTokens(code);
  }
  if (grant === "refresh_token") {
    const refresh = readPayload(String(body?.refresh_token || ""), "assistant-refresh");
    if (refresh.clientId !== clientId) throw oauthError(400, "invalid_grant", "This refresh token belongs to a different assistant.");
    if (refresh.aud !== mcpResource(origin)) throw oauthError(400, "invalid_grant", "This refresh token is for a different server.");
    const record = await requireLiveMember(refresh);
    return issueTokens({
      personId: refresh.personId,
      fullName: record.person.fullName || refresh.fullName,
      pwv: passwordVersion(record.auth.passwordHash),
      clientId: refresh.clientId,
      aud: refresh.aud,
    });
  }
  throw oauthError(400, "unsupported_grant_type", "Unsupported sign-in grant.");
}

function verifyAccessToken(token) {
  const payload = readPayload(token, "assistant");
  if (!payload.personId || !payload.pwv || !payload.aud) {
    throw oauthError(401, "invalid_token", "Invalid assistant credential.");
  }
  return payload;
}

function protectedResourceMetadata(origin) {
  return {
    resource: mcpResource(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Foresight Atlas",
  };
}

function authorizationServerMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/assistant/authorize`,
    token_endpoint: `${origin}/api/assistant/token`,
    registration_endpoint: `${origin}/api/assistant/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    scopes_supported: [SCOPE, "offline_access"],
    authorization_response_iss_parameter_supported: true,
  };
}

module.exports = {
  isAllowedRedirectUri,
  beginAuthorization,
  registerClient,
  completeConsent,
  exchangeToken,
  verifyAccessToken,
  protectedResourceMetadata,
  authorizationServerMetadata,
  mcpResource,
  signPayload,
  readPayload,
};
