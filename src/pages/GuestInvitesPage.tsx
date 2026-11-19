/**
 * Event invites — Foresight Team drops a guest CSV.
 * The server creates unclaimed community accounts and mails claim links.
 * A reminder is scheduled for two weeks later.
 */

import { useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import type { Identity } from "../services/identity";
import {
  previewGuestInvites,
  sendGuestInviteSlice,
  type GuestPreview,
  type GuestSendSlice,
} from "../services/guestInvites";
import { Button } from "../components/ui/button";

interface GuestInvitesPageProps {
  identity: Identity | null;
  teamViewer: boolean;
  resolving?: boolean;
  onNavigateHome: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  invited: "Invite sent · reminder in 14 days",
  invited_reminder_failed: "Invite sent · reminder did not schedule",
  already_member: "Already on Atlas",
  name_taken: "That name belongs to someone else",
  mail_failed: "Could not send",
  quota: "Resend daily limit reached",
  failed: "Could not add this person",
};

export function GuestInvitesPage({ identity, teamViewer, resolving, onNavigateHome }: GuestInvitesPageProps) {
  const [csv, setCsv] = useState("");
  const [eventName, setEventName] = useState("");
  const [preview, setPreview] = useState<GuestPreview | null>(null);
  const [sent, setSent] = useState<GuestSendSlice["results"]>([]);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setPreview(null);
    setSent([]);
    setError("");
  }

  async function onPreview() {
    setBusy("preview");
    setError("");
    setSent([]);
    try {
      setPreview(await previewGuestInvites(csv, eventName));
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not read this list.");
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    if (!preview || preview.counts.invite === 0) return;
    setBusy("send");
    setError("");
    const collected: GuestSendSlice["results"] = [];
    try {
      let offset = 0;
      let done = false;
      while (!done) {
        const slice = await sendGuestInviteSlice(csv, eventName, offset);
        collected.push(...slice.results);
        setSent([...collected]);
        setProgress(`${Math.min(slice.nextOffset, slice.total)} of ${slice.total}`);
        offset = slice.nextOffset;
        done = slice.done;
        if (slice.results.some((row) => row.status === "quota")) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sending stopped.");
    } finally {
      setBusy(null);
    }
  }

  if (resolving) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-5">
        <Loader2 className="size-5 animate-spin text-gray-400" aria-label="Loading" />
      </main>
    );
  }

  if (!identity?.token || !teamViewer) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-5 py-16">
        <h1 className="font-heading text-2xl font-semibold text-gray-900">Foresight Team only</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Event invites are an admin tool. Sign in with a team account.
        </p>
        <Button variant="outline" className="mt-6 w-fit" onClick={onNavigateHome}>
          Back to the map
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Map
        </button>

        <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
              <Mail className="size-5" aria-hidden />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-gray-900">
                Event invites
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Drop a CSV with first name, last name, and email. Each new guest gets a
                community account and a claim link. People who already have a password
                are skipped. A reminder goes out 14 days later.
              </p>
            </div>
          </div>

          <label className="mt-6 block text-sm font-medium text-gray-800" htmlFor="guest-event">
            Event name
          </label>
          <input
            id="guest-event"
            value={eventName}
            onChange={(event) => setEventName(event.target.value)}
            placeholder="Berlin salon, 19 Nov"
            className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-900 outline-none focus:border-gray-400"
          />

          <label className="mt-4 block text-sm font-medium text-gray-800" htmlFor="guest-csv">
            Guest CSV
          </label>
          <input
            id="guest-file"
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-800"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <textarea
            id="guest-csv"
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              setPreview(null);
              setSent([]);
            }}
            rows={8}
            placeholder={"first name,last name,email\nAda,Lovelace,ada@example.com"}
            className="mt-3 w-full rounded-2xl border border-gray-200 px-3 py-3 font-mono text-xs leading-relaxed text-gray-800 outline-none focus:border-gray-400"
          />

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy !== null || csv.trim().length === 0}
              onClick={() => void onPreview()}
            >
              {busy === "preview" ? <Loader2 className="size-4 animate-spin" /> : null}
              Preview
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={busy !== null || !preview || preview.counts.invite === 0 || !preview.mailConfigured}
              onClick={() => void onSend()}
            >
              {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : null}
              {preview ? `Send ${preview.counts.invite} invite${preview.counts.invite === 1 ? "" : "s"}` : "Send invites"}
            </Button>
          </div>

          {progress ? (
            <p className="mt-3 text-sm text-gray-600">Sending {progress}</p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
              {error}
            </p>
          ) : null}
          {preview && !preview.mailConfigured ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Preview is ready. Sending needs RESEND_API_KEY on this deploy. Mail will come from {preview.from}.
            </p>
          ) : null}
          {preview?.mailConfigured ? (
            <p className="mt-3 text-xs text-gray-500">From {preview.from}. Reminder in {preview.reminderInDays} days.</p>
          ) : null}
        </div>

        {preview ? (
          <section className="mt-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-gray-900">
              {preview.counts.invite} to invite · {preview.counts.alreadyMember} already on Atlas · {preview.counts.nameTaken} name clashes
              {preview.counts.invalid ? ` · ${preview.counts.invalid} unreadable` : ""}
            </h2>
            <ul className="mt-4 divide-y divide-gray-100">
              {preview.preview.map((row) => (
                <li key={`${row.line}-${row.email}`} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-gray-900">
                    {row.firstName} <span className="text-gray-500">{row.email}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500">
                    {row.action === "invite" ? "Invite" : row.action === "already_member" ? "Skip" : "Clash"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {sent.length > 0 ? (
          <section className="mt-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-gray-900">Sent</h2>
            <ul className="mt-4 divide-y divide-gray-100">
              {sent.map((row) => (
                <li key={row.email} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-gray-900">{row.firstName}</span>
                  <span className="shrink-0 text-right text-xs text-gray-600">
                    {STATUS_LABEL[row.status] || row.status}
                    {row.error ? ` · ${row.error}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
