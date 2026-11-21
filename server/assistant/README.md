# Assistant connector

A read-only MCP server so a **signed-in member** can use Claude or ChatGPT to ask who is open to meet and what’s coming up. It is deliberately isolated from the rest of the Atlas.

Installing the connector does not grant access. Every tool call needs an OAuth token issued only after the person signs in with their Atlas name and password. Someone who is not on the roster cannot finish that sign-in, so they never receive a token and never see the directory.

Roster emails are never included. Private profiles stay off shared lists. Senior Fellows and Prize Winners appear without contact fields. Bios and notes are returned as quotes. A profile change is a signed link the member saves on their own profile page; the assistant cannot write the sheet itself. Changing a password invalidates every assistant token for that member, because each token is bound to a fingerprint of the current password hash. There is no separate token database — same stateless approach as claim links.

Turn the whole connector off without deleting it:

```bash
ASSISTANT_CONNECTOR_ENABLED=false
```

## Remove it

1. Delete `server/assistant/`, `api/assistant.js`, `src/pages/AssistantConnectPage.tsx`, and `src/components/assistant/`.
2. Remove `mountAssistant(app)` from `server/index.js` and `server/index.mock.js`.
3. Remove the `/api/assistant/*`, `/.well-known/oauth-*`, and `/assistant` rewrites in `vercel.json`.
4. Remove the `/assistant` branch in `src/App.tsx` and `<AssistantConnectCard />` in `src/pages/ProfilePage.tsx`.
5. Remove `docs/ASSISTANT_CONNECTOR.md` and the mentions in `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/VERCEL_ENV.md`, `docs/SELF_HOSTING.md`, `AGENTS.md`, and `README.md`.

Member login, the sheet, and the map do not depend on this folder.
