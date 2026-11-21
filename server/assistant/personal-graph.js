"use strict";

/**
 * The signed-in member's own graph. Nothing about anyone else.
 * No roster email. Suitable to hand to their agent or knowledge graph.
 */

const { fence } = require("./quotes");

function clip(value, max) {
  const text = String(value || "").replace(/\u0000/g, "").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function personalGraph(person, rsvps, eventsById) {
  const focus = Array.isArray(person.focusTags) ? person.focusTags.filter(Boolean) : [];
  const intent = clip(person.currentlyLookingFor, 220);
  const place = [person.currentCity, person.currentCountry].filter(Boolean).join(", ");
  const attending = (rsvps || [])
    .filter((row) => row && (row.status === "going" || row.status === "interested"))
    .slice(0, 40)
    .map((row) => {
      const event = eventsById?.get?.(row.eventId);
      return {
        "@type": "Event",
        name: clip(event?.title || row.eventTitle || "Event", 160),
        startDate: event?.startAt || "",
        eventAttendanceMode: row.status,
      };
    });

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    identifier: person.id,
    name: person.fullName,
    knowsAbout: focus,
    homeLocation: place,
    description: fence(clip(person.shortProjectTagline, 240)),
    additionalProperty: [
      ...(intent
        ? [{ "@type": "PropertyValue", name: "intent", value: fence(intent) }]
        : []),
      {
        "@type": "PropertyValue",
        name: "visibleToCommunity",
        value: person.visibleToCommunity === true,
      },
    ],
    subjectOf: attending,
    memberOf: {
      "@type": "Organization",
      name: "Foresight Institute",
      url: "https://www.foresight.org/",
    },
  };
}

module.exports = { personalGraph };
