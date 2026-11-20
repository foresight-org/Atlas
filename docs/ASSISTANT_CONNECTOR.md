# Assistant connector

A separate, read-only connector so a **member** can ask Claude or ChatGPT who is open to meet and what is coming up. The code lives in `server/assistant/` and can be removed or switched off without touching the map, login, or the sheet. See `server/assistant/README.md` for the removal list.

## Who can use it

Installing the connector does **not** grant access.

Claude and ChatGPT only learn where to send the person. The Atlas then requires the same sign-in as the website. A community account and a fellow account both sign in here, and each assistant sees only that account’s layer: community accounts never receive fellows, grantees, or nodees, and fellow accounts do not receive the community signup list. Every later request checks that the password is still the one the token was issued for. Changing the password on the profile disconnects every assistant.

The tools are the signed-in member's own layer: their profile, their RSVPs, their own JSON-LD graph (`my_subgraph`), upcoming events, people on that layer who published a booking link, and people on that layer in a focus area. `update_my_profile` is the one write, and it can change only that member's own card. Roles, email, and the password stay put. There is no tool that dumps the roster. Roster emails are never included. Private profiles stay off shared lists. Senior Fellows and Prize Winners appear without contact fields. The only public intent is the one-sentence “currently looking for” field.

Agents can discover this at `https://atlas.foresight.org/llms.txt` and the playbook at `https://atlas.foresight.org/agents/foresight-atlas/SKILL.md`.

## Address

On your profile, under **Claude and ChatGPT**, copy:

```text
https://atlas.foresight.org/api/assistant/mcp
```

Locally that host is whatever origin you have open (the dev server proxies `/api`).

Add it in Claude or ChatGPT as a custom connector and choose sign-in. You will land on `/assistant`, sign in, and press Allow. Until it is submitted to Anthropic’s and OpenAI’s directories, members add it by that address. A directory listing is a later step on those accounts; it does not change who can sign in.

## Turn it off

```bash
ASSISTANT_CONNECTOR_ENABLED=false
```

Every connector route then returns 404. No new secret is required. Tokens are signed with **DIRECTORY_SESSION_SECRET**, the same secret as member sessions, using a different prefix so the two kinds of token are not interchangeable.

Optional: **ASSISTANT_PUBLIC_ORIGIN** (`https://atlas.foresight.org`, no trailing slash) if a proxy rewrites the host and the issuer must stay stable.
