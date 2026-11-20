"use strict";

/**
 * What an assistant may read from a Node's published graph.
 *
 * The globe's sample graph stays on the globe. This returns only bundles
 * a Node has published. Recordings and transcripts are not in those bundles.
 */

const { assemble } = require("../memory/assemble");
const { bundlesFor } = require("../memory/store");

const PLACES = {
  berlin: "Berlin",
  sf: "San Francisco",
  "cape-town": "Cape Town",
};

const EMPTY =
  "No memory has been published for this place yet. The sample graph on the globe is a prototype and is not available here.";

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function topicCard(topic) {
  const card = {
    label: topic.label,
    kind: topic.kind,
    conversations: topic.weight || 0,
  };
  const summary = clip(topic.summary, 280);
  if (summary) card.summary = summary;
  return card;
}

function insightCard(insight) {
  const card = {
    type: insight.type,
    title: clip(insight.title, 80),
  };
  const body = clip(insight.body, 800);
  if (body) card.body = body;
  if (insight.toNode) card.toNode = insight.toNode;
  if (insight.recommendation?.name) {
    card.person = {
      name: clip(insight.recommendation.name, 80),
      role: clip(insight.recommendation.role, 80),
      node: insight.recommendation.nodeId || "",
    };
  }
  return card;
}

function reading(placeId, bundles) {
  const name = PLACES[placeId];
  if (!bundles.length) {
    return { place: placeId, name, published: false, note: EMPTY };
  }
  const graph = assemble(placeId, bundles);
  const labels = new Map(graph.topics.map((topic) => [topic.id, topic.label]));
  const problems = graph.topics
    .filter((topic) => topic.kind === "problem")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20)
    .map(topicCard);
  const topics = graph.topics
    .filter((topic) => topic.kind !== "problem")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40)
    .map(topicCard);
  return {
    place: placeId,
    name,
    published: true,
    source: bundles[bundles.length - 1]?.source || "meld",
    note: "Published node memory. Recordings and transcripts are not stored.",
    hardProblems: problems,
    topics,
    insights: graph.insights.slice(0, 12).map(insightCard),
    conversations: graph.conversations.slice(-20).map((conversation) => ({
      label: clip(conversation.label, 80),
      at: conversation.at,
    })),
    connections: graph.edges.slice(0, 40).map((edge) => ({
      from: labels.get(edge.source) || edge.source,
      to: labels.get(edge.target) || edge.target,
      conversations: edge.weight,
    })),
  };
}

async function readNodeMemory(placeId) {
  const key = String(placeId || "").trim().toLowerCase();
  if (!PLACES[key]) {
    const error = new Error("Ask for berlin, sf, or cape-town.");
    error.statusCode = 400;
    throw error;
  }
  return reading(key, await bundlesFor(key));
}

module.exports = { readNodeMemory, PLACES };
