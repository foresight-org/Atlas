/**
 * Event guest invites. The server decides who is new, who already has an
 * account, and who must be skipped. This module only carries the CSV.
 */

import { getApiBase } from "./api-base";
import { getIdentity } from "./identity";

export interface GuestPreviewRow {
  line: number;
  firstName: string;
  email: string;
  action: "invite" | "already_member" | "name_taken";
  role: string;
  /** Masked address already on the account, when the name matches someone else. */
  maskedEmail?: string;
}

export type NameClashAction = "link" | "connect" | "skip";

export interface GuestPreview {
  dryRun: true;
  mailConfigured: boolean;
  from: string;
  reminderInDays: number;
  counts: { invite: number; alreadyMember: number; nameTaken: number; invalid: number };
  errors: { line: number; message: string }[];
  preview: GuestPreviewRow[];
}

export interface GuestSendSlice {
  dryRun: false;
  from: string;
  processed: number;
  nextOffset: number;
  done: boolean;
  total: number;
  results: { email: string; firstName: string; status: string; error?: string }[];
}

async function postGuestInvites(body: Record<string, unknown>): Promise<GuestPreview | GuestSendSlice> {
  const identity = getIdentity();
  const response = await fetch(`${getApiBase()}/guest-invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(identity?.token ? { Authorization: `Bearer ${identity.token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Could not read this guest list.");
  }
  return payload;
}

export function previewGuestInvites(csv: string, eventName: string): Promise<GuestPreview> {
  return postGuestInvites({ csv, eventName, dryRun: true }) as Promise<GuestPreview>;
}

export function sendGuestInviteSlice(
  csv: string,
  eventName: string,
  offset: number,
  resolutions: { email: string; action: NameClashAction }[] = [],
): Promise<GuestSendSlice> {
  return postGuestInvites({
    csv,
    eventName,
    dryRun: false,
    offset,
    resolutions,
  }) as Promise<GuestSendSlice>;
}
