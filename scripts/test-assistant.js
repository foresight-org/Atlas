#!/usr/bin/env node
/**
 * The assistant connector stays members-only.
 *
 *   FORESIGHT_FORCE_MOCK=1 node scripts/test-assistant.js
 *
 * A stranger who only knows the URL gets 401. A directory session cannot call
 * the connector. An assistant token cannot read /api/database. Roster emails
 * never appear in tool output. A password change kills the refresh token.
 */

process.env.FORESIGHT_FORCE_MOCK = "1";
process.env.DIRECTORY_SESSION_SECRET =
  process.env.DIRECTORY_SESSION_SECRET || "test-assistant-secret";
process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || "mock-test-sheet";
delete process.env.GOOGLE_SHEETS_API_KEY;
delete process.env.GOOGLE_API_KEY;
delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const { issueDirectorySession, hashPassword } = require("../server/directory-auth");
const { AUTH_FILE, getLocalAuth } = require("../server/local-storage");
const { isAllowedRedirectUri } = require("../server/assistant/oauth");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function startMockServer() {
  const app = require("../server/index.mock");
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
    server.on("error", reject);
  });
}

async function req(base, method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form !== undefined) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  }
  const response = await fetch(`${base}${path}`, { method, headers, body, redirect: "manual" });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, headers: response.headers, body: parsed, text };
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function main() {
  assert(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"), "claude callback should be allowed");
  assert(!isAllowedRedirectUri("https://evil.example/callback"), "arbitrary redirects must be rejected");
  assert(!isAllowedRedirectUri("https://claude.ai.evil.example/api/mcp/auth_callback"), "lookalike hosts must be rejected");

  const authBefore = JSON.stringify(await getLocalAuth());
  const { server, base } = await startMockServer();
  try {
    const anon = await req(base, "POST", "/api/assistant/mcp", {
      json: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    assert(anon.status === 401, `anonymous MCP should be 401, got ${anon.status}`);
    assert(
      String(anon.headers.get("www-authenticate") || "").includes("resource_metadata="),
      "401 should point at OAuth metadata",
    );
    assert(!JSON.stringify(anon.body).includes("Alice"), "anonymous response must not include members");

    const metadata = await req(base, "GET", "/.well-known/oauth-authorization-server");
    assert(metadata.status === 200, "authorization server metadata should load");
    assert(metadata.body.registration_endpoint.endsWith("/api/assistant/register"), "missing registration endpoint");
    assert(metadata.body.authorization_response_iss_parameter_supported === true, "issuer identification should be on");

    const evil = await req(base, "POST", "/api/assistant/register", {
      json: { redirect_uris: ["https://evil.example/steal"], token_endpoint_auth_method: "none" },
    });
    assert(evil.status === 400, `evil redirect should be rejected, got ${evil.status}`);

    const registered = await req(base, "POST", "/api/assistant/register", {
      json: {
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        token_endpoint_auth_method: "none",
        client_name: "Claude",
      },
    });
    assert(registered.status === 201, `DCR should succeed, got ${registered.status} ${registered.text}`);
    const clientId = registered.body.client_id;

    const { verifier, challenge } = pkce();
    const state = "state-1";
    const authorize = await req(
      base,
      "GET",
      `/api/assistant/authorize?${new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        scope: "atlas:read",
        resource: `${base}/api/assistant/mcp`,
      })}`,
    );
    assert(authorize.status === 302, `authorize should redirect to the Atlas, got ${authorize.status}`);
    const location = authorize.headers.get("location") || "";
    assert(location.startsWith(`${base}/assistant?`), "consent redirect must stay on the Atlas");
    assert(!location.startsWith("https://claude.ai"), "authorize must not send the code yet");

    const stranger = await req(base, "POST", "/api/assistant/consent", {
      json: {
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(stranger.status === 401, "consent without a member session must fail");

    const auth = JSON.parse(authBefore);
    auth["mock-person-alice"] = {
      ...(auth["mock-person-alice"] || {}),
      passwordHash: await hashPassword("atlas-assistant-test"),
      mustChangePassword: false,
    };
    fs.writeFileSync(AUTH_FILE, `${JSON.stringify(auth, null, 2)}\n`);

    const session = issueDirectorySession({
      person: { id: "mock-person-alice", fullName: "Alice Example" },
      auth: { mustChangePassword: false },
    });

    const directoryAsConnector = await req(base, "POST", "/api/assistant/mcp", {
      token: session.token,
      json: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    assert(directoryAsConnector.status === 401, "a website session must not call the connector");

    const consent = await req(base, "POST", "/api/assistant/consent", {
      token: session.token,
      json: {
        action: "allow",
        client_id: clientId,
        redirect_uri: "https://evil.example/steal",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(consent.status === 400, "consent must reject a swapped redirect");

    const allowed = await req(base, "POST", "/api/assistant/consent", {
      token: session.token,
      json: {
        action: "allow",
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(allowed.status === 200, `consent should succeed, got ${allowed.status} ${allowed.text}`);
    const back = new URL(allowed.body.redirectTo);
    assert(back.origin === "https://claude.ai", "code should return to Claude");
    assert(back.searchParams.get("iss") === base, "iss must match the issuer");
    const code = back.searchParams.get("code");
    assert(code, "missing authorization code");

    const badVerifier = await req(base, "POST", "/api/assistant/token", {
      form: {
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        client_id: clientId,
        code_verifier: crypto.randomBytes(32).toString("base64url"),
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(badVerifier.status === 400, "wrong PKCE verifier must fail");

    const token = await req(base, "POST", "/api/assistant/token", {
      form: {
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        client_id: clientId,
        code_verifier: verifier,
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(token.status === 200, `token exchange should succeed, got ${token.status} ${token.text}`);
    const access = token.body.access_token;
    const refresh = token.body.refresh_token;

    const reused = await req(base, "POST", "/api/assistant/token", {
      form: {
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        client_id: clientId,
        code_verifier: verifier,
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(reused.status === 400, "authorization code must be single-use");

    const database = await req(base, "GET", "/api/database", { token: access });
    assert(database.status === 401, "an assistant token must not open the website API");

    const tools = await req(base, "POST", "/api/assistant/mcp", {
      token: access,
      json: { jsonrpc: "2.0", id: 2, method: "tools/list" },
    });
    assert(tools.status === 200, "member should be able to list tools");
    const names = tools.body.result.tools.map((entry) => entry.name);
    assert(names.includes("open_to_meet") && names.includes("people_by_focus"), "expected read-only tools");
    assert(tools.body.result.tools.every((entry) => entry.annotations.readOnlyHint === true), "tools must be marked read-only");

    const people = await req(base, "POST", "/api/assistant/mcp", {
      token: access,
      json: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "people_by_focus", arguments: { focus: "Biosecurity" } },
      },
    });
    assert(people.status === 200, `people_by_focus failed: ${people.text}`);
    const rendered = JSON.stringify(people.body);
    assert(!rendered.includes("alice@example.com"), "roster email leaked into a tool result");
    assert(!rendered.includes('"email"'), "email field leaked into a tool result");
    assert(rendered.includes("Alice Example"), "Alice should be visible to a signed-in member");

    const refreshed = await req(base, "POST", "/api/assistant/token", {
      form: {
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: clientId,
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(refreshed.status === 200, `refresh should succeed, got ${refreshed.status} ${refreshed.text}`);

    auth["mock-person-alice"].passwordHash = await hashPassword("a-different-password");
    fs.writeFileSync(AUTH_FILE, `${JSON.stringify(auth, null, 2)}\n`);
    const revoked = await req(base, "POST", "/api/assistant/token", {
      form: {
        grant_type: "refresh_token",
        refresh_token: refreshed.body.refresh_token,
        client_id: clientId,
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(revoked.status === 401, "changing the password should disconnect the assistant");

    console.log("assistant connector: members-only checks passed");
  } finally {
    fs.writeFileSync(AUTH_FILE, authBefore.endsWith("\n") ? authBefore : `${authBefore}\n`);
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
