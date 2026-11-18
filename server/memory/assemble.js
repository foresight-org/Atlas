"use strict";

/**
 * Many sessions, one graph. The panel already knows how to window this shape.
 */

function assemble(placeId, bundles) {
  const topics = new Map();
  const edges = new Map();
  const conversations = [];
  const events = [];
  const insights = [];
  const seenInsight = new Set();

  const ordered = [...bundles].sort((a, b) => String(a.session.at).localeCompare(String(b.session.at)));
  for (const bundle of ordered) {
    const conversationId = bundle.session.id;
    conversations.push({
      id: conversationId,
      eventId: conversationId,
      label: bundle.session.label,
      at: bundle.session.at,
    });
    events.push({
      id: conversationId,
      label: bundle.session.label,
      start: bundle.session.at,
      end: bundle.session.at,
    });
    for (const node of bundle.nodes) {
      const topic = topics.get(node.id) || {
        id: node.id,
        label: node.label,
        kind: node.kind,
        weight: 0,
        sharedWith: [],
        firstSeen: bundle.session.at,
        mentions: [],
      };
      if (topic.kind === "topic" && node.kind !== "topic") topic.kind = node.kind;
      if (node.summary) topic.summary = node.summary;
      topic.mentions.push({ conversationId, at: bundle.session.at });
      topic.weight = topic.mentions.length;
      topics.set(node.id, topic);
    }
    for (const edge of bundle.edges) {
      const key = [edge.source, edge.target].sort().join("|");
      const current = edges.get(key) || {
        source: edge.source,
        target: edge.target,
        weight: 0,
      };
      current.weight += 1;
      edges.set(key, current);
    }
  }

  for (const bundle of [...ordered].reverse()) {
    for (const insight of bundle.insights) {
      if (seenInsight.has(insight.type)) continue;
      seenInsight.add(insight.type);
      insights.push(insight);
    }
  }

  return {
    placeId,
    topics: [...topics.values()],
    edges: [...edges.values()],
    insights,
    events,
    conversations,
  };
}

module.exports = { assemble };
