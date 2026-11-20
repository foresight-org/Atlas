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
const { AUTH_FILE, DATABASE_FILE, getLocalAuth } = require("../server/local-storage");
const { callTool } = require("../server/assistant/mcp");
const { normalizeBundle } = require("../server/memory/normalize");
const { saveBundle, FILE: MEMORY_FILE } = require("../server/memory/store");
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
  const verifier = `~.${crypto.randomBytes(48).toString("base64url")}`.slice(0, 128);
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function main() {
  assert(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"), "claude callback should be allowed");
  assert(isAllowedRedirectUri("http://127.0.0.1:8787/callback"), "Hermes loopback callback should be allowed");
  assert(!isAllowedRedirectUri("https://evil.example/callback"), "arbitrary redirects must be rejected");
  assert(!isAllowedRedirectUri("https://claude.ai.evil.example/api/mcp/auth_callback"), "lookalike hosts must be rejected");

  const authBefore = JSON.stringify(await getLocalAuth());
  const databaseBefore = fs.readFileSync(DATABASE_FILE, "utf8");
  const memoryBefore = fs.existsSync(MEMORY_FILE) ? fs.readFileSync(MEMORY_FILE, "utf8") : null;
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

    const hermesClient = "https://nousresearch.github.io/hermes-agent/docs/oauth/client-metadata.json";
    const hermesPkce = pkce();
    const hermesQuery = new URLSearchParams({
      response_type: "code",
      client_id: hermesClient,
      redirect_uri: "http://127.0.0.1:54321/callback",
      code_challenge: hermesPkce.challenge,
      code_challenge_method: "S256",
      state: "hermes-desktop-port",
      scope: "atlas:read",
      resource: `${base}/api/assistant/mcp`,
    });
    const hermesAuth = await req(base, "GET", `/api/assistant/authorize?${hermesQuery}`);
    assert(
      hermesAuth.status === 302,
      `Hermes may listen on a free loopback port, got ${hermesAuth.status} ${hermesAuth.text}`,
    );
    const unknownQuery = new URLSearchParams(hermesQuery);
    unknownQuery.set("client_id", "https://evil.example/oauth/client.json");
    const unknownClient = await req(base, "GET", `/api/assistant/authorize?${unknownQuery}`);
    assert(unknownClient.status === 400, "an unknown client document must be refused");

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
    assert(names.includes("open_to_meet") && names.includes("people_by_focus") && names.includes("node_memory"), "expected directory tools");
    assert(names.includes("update_my_profile"), "a member should be able to update their own profile");
    const updateTool = tools.body.result.tools.find((entry) => entry.name === "update_my_profile");
    assert(updateTool.annotations.readOnlyHint === false, "profile update is a write");
    assert(
      tools.body.result.tools.filter((entry) => entry.name !== "update_my_profile").every((entry) => entry.annotations.readOnlyHint === true),
      "the other tools stay read-only",
    );

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

    const updated = await req(base, "POST", "/api/assistant/mcp", {
      token: access,
      json: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "update_my_profile", arguments: { lookingFor: "A quiet test sentence." } },
      },
    });
    assert(updated.status === 200, `profile update failed: ${updated.text}`);
    const updatedText = JSON.stringify(updated.body);
    assert(updatedText.includes("A quiet test sentence."), "the new sentence should come back");
    assert(!updatedText.includes("alice@example.com"), "a profile update must not return the roster email");
    assert(!updatedText.includes("\"Community\""), "a fellow profile update must not change their role");

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

    auth["mock-person-bob"] = {
      ...(auth["mock-person-bob"] || {}),
      passwordHash: "",
      claimedAt: "2026-01-01T00:00:00.000Z",
      mustChangePassword: false,
    };
    fs.writeFileSync(AUTH_FILE, `${JSON.stringify(auth, null, 2)}\n`);
    const bob = issueDirectorySession({
      person: { id: "mock-person-bob", fullName: "Bob Example" },
      auth: { mustChangePassword: false },
    });
    const bobConsent = await req(base, "POST", "/api/assistant/consent", {
      token: bob.token,
      json: {
        action: "allow",
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "bob-state",
        resource: `${base}/api/assistant/mcp`,
      },
    });
    assert(bobConsent.status === 200, `a claimed account without a password should connect, got ${bobConsent.status} ${bobConsent.text}`);

    const layerPeople = [
      { id: "fellow", fullName: "Fellow Example", roleType: "Fellow", focusTags: ["Biosecurity"], isPrivate: false },
      { id: "team", fullName: "Team Example", roleType: "Foresight Team", focusTags: ["Biosecurity"], isPrivate: false, availabilityUrl: "https://cal.example/team" },
      { id: "community", fullName: "Community Example", roleType: "Community", focusTags: ["Biosecurity"], isPrivate: false, availabilityUrl: "https://cal.example/community" },
    ];
    const fellowView = JSON.stringify(await callTool("people_by_focus", { focus: "Bio" }, { person: { id: "fellow", roleType: "Fellow" } }, { publicPeople: layerPeople, events: [], rsvps: [] }));
    const communityView = JSON.stringify(await callTool("open_to_meet", {}, { person: { id: "community", roleType: "Community" } }, { publicPeople: layerPeople, events: [], rsvps: [] }));
    assert(fellowView.includes("Fellow Example") && fellowView.includes("Team Example") && !fellowView.includes("Community Example"), "a fellow sees the program layer");
    assert(communityView.includes("Community Example") && communityView.includes("Team Example") && !communityView.includes("Fellow Example"), "a community account sees who is open to meet on their layer");

    const bundle = normalizeBundle({
      place: "berlin",
      source: "meld",
      session: { id: "assistant-test", label: "Thursday room", at: "2026-11-01" },
      problems: [{ label: "Local compute", summary: "People are trying to keep models on the node." }],
      insights: [{ type: "emerging_term", title: "Node compute", body: "The room kept returning to machines that stay in the building." }],
    });
    const stored = await saveBundle(bundle);
    assert(stored.where === "file", "the assistant test must not write node memory to Postgres");
    const fellowMemory = JSON.stringify(await callTool("node_memory", { place: "berlin" }, { person: { id: "fellow", roleType: "Fellow" } }, { publicPeople: [], events: [], rsvps: [] }));
    assert(fellowMemory.includes("Local compute") && fellowMemory.includes("machines that stay in the building"), "a fellow reads published node memory");
    assert(!fellowMemory.includes("Prototype"), "the sample graph is not served to an assistant");
    const communityMemory = await callTool("node_memory", { place: "berlin" }, { person: { id: "community", roleType: "Community" } }, { publicPeople: [], events: [], rsvps: [] });
    assert(communityMemory.isError && !JSON.stringify(communityMemory).includes("Local compute"), "a community account does not read node memory");

    console.log("assistant connector: members-only checks passed");
  } finally {
    fs.writeFileSync(AUTH_FILE, authBefore.endsWith("\n") ? authBefore : `${authBefore}\n`);
    fs.writeFileSync(DATABASE_FILE, databaseBefore.endsWith("\n") ? databaseBefore : `${databaseBefore}\n`);
    if (memoryBefore == null) fs.rmSync(MEMORY_FILE, { force: true });
    else fs.writeFileSync(MEMORY_FILE, memoryBefore);
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
