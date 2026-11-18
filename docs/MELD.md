# Meld → Atlas

[Meld](https://www.komma.systems/en/meld) (KOMMA) records a conversation on the device. Consent is an NFC tap. Transcription, diarization, and sterilization stay on the device. Raw audio never leaves the room.

What Atlas accepts is the structure that comes after: themes, hard problems, embers (new terms), relations, and a few insights. That graph is what a Node shows on the globe.

A Node can run this same API on its own machine. With `SUPABASE_URL` set, the bundle is stored in Postgres. Without it, the bundle is stored in `mock/node-memory.local.json`. Either way the panel reads `GET /api/memory`.

## Post a graph

```bash
curl -X POST http://localhost:3001/api/memory \
  -H "Authorization: Bearer $MEMORY_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "place": "berlin",
    "source": "meld",
    "session": { "id": "salon-12", "label": "Thursday salon", "at": "2026-11-18" },
    "problems": [{ "id": "confidential-inference", "label": "Confidential inference", "summary": "The room is stuck on running a model without the prompt leaving it." }],
    "embers": [{ "id": "room-key", "label": "Room key" }],
    "graph": {
      "nodes": [{ "id": "local-models", "label": "Local models" }],
      "edges": [{ "source": "local-models", "target": "confidential-inference", "relation": "supports" }]
    },
    "insights": [
      { "type": "emerging_term", "title": "Room key" },
      { "type": "intro", "title": "Talk to a cryptographer", "name": "Leah Okonkwo", "role": "Cryptographer", "nodeId": "sf" }
    ]
  }'
```

Production refuses the post until `MEMORY_INGEST_TOKEN` is set. A laptop running the API without that variable accepts the post, so a Node can try the endpoint while it is being set up.

Sending the same `place` and `session.id` again replaces the row.

## Sterilized text, when there is no graph yet

If the body has `sterilizedText` and no nodes, Atlas asks the Berlin YCluster (the same gateway the matchmaker uses) to draft a graph. The text is not stored and is not returned by the read.

```
LLM_BASE_URL=https://dev1.ycluster.net/v1
LLM_API_KEY=        # minted at the cluster, never committed
LLM_MODEL=deepseek-v4-flash
```

A body that includes `audio`, `recording`, or `sterilized: false` is rejected. The recording stays on the device.

## Read it back

`GET /api/memory?place=berlin` requires a signed-in member. The response is one graph assembled from every session at that Node. The panel uses it in place of the sample constellation, and says “From Meld” when it does.

Relations Atlas understands, from the BRAID side of Meld: `supports`, `opposes`, `qualifies`. Anything else is kept as co-occurrence. The constellation draws the edge either way.
