/**
 * The signed-in person's own graph, for their agent or knowledge base.
 * Same shape as the MCP `my_subgraph` tool. No one else's data.
 */

import type { Person } from "../types";
import type { RSVPRecord } from "../types/events";
import { getEventById } from "../data/events";

export function personalGraphDocument(person: Person, rsvps: RSVPRecord[]) {
  const place = [person.currentCity, person.currentCountry].filter(Boolean).join(", ");
  const attending = rsvps
    .filter((row) => row.status === "going" || row.status === "interested")
    .slice(0, 40)
    .map((row) => {
      const event = getEventById(row.eventId);
      return {
        "@type": "Event",
        name: event?.title || row.eventTitle || "Event",
        startDate: event?.startAt || "",
        eventAttendanceMode: row.status,
      };
    });

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    identifier: person.id,
    name: person.fullName,
    knowsAbout: person.focusTags || [],
    homeLocation: place,
    description: (person.shortProjectTagline || "").trim(),
    additionalProperty: [
      { "@type": "PropertyValue", name: "intent", value: (person.currentlyLookingFor || "").trim() },
      { "@type": "PropertyValue", name: "visibleToCommunity", value: person.visibleToCommunity === true },
    ],
    subjectOf: attending,
    memberOf: {
      "@type": "Organization",
      name: "Foresight Institute",
      url: "https://www.foresight.org/",
    },
  };
}

export function downloadPersonalGraph(person: Person, rsvps: RSVPRecord[]) {
  const body = JSON.stringify(personalGraphDocument(person, rsvps), null, 2);
  const blob = new Blob([body], { type: "application/ld+json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "foresight-atlas-graph.json";
  link.click();
  URL.revokeObjectURL(url);
}
