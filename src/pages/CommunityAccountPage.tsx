/**
 * CommunityAccountPage — an account anyone can open.
 *
 * This is the outer atlas. The form cannot ask for a fellow, grantee, or
 * nodee role; the server throws that choice away and writes Community.
 * Fellows and nodees stay on the inner atlas, which this account never reads.
 */

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import foresightIcon from "../assets/Foresight_RGB_Icon_Black.png?url";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  FORESIGHT_FELLOWSHIP_URL,
  FORESIGHT_GRANTS_URL,
  FORESIGHT_ORG_WWW_URL,
} from "../constants/foresight";
import { AgentHandoffCard } from "../components/community/AgentHandoffCard";
import { createCommunityAccount } from "../services/memberAuth";
import type { DirectoryAuthResult } from "../services/memberAuth";

interface CommunityAccountPageProps {
  onCreated: (result: DirectoryAuthResult) => void;
  onSignInInstead: () => void;
}

export function CommunityAccountPage({ onCreated, onSignInInstead }: CommunityAccountPageProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      setError("Enter the name people know you by.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    if (!consent) {
      setError("Confirm that other community accounts may see your profile.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await createCommunityAccount({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        currentCity: city.trim(),
        consent: true,
      });
      onCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-[100svh] overflow-y-auto bg-[linear-gradient(165deg,rgba(209,250,229,0.55)_0%,rgba(255,255,255,0.96)_42%,rgba(165,243,252,0.45)_100%)] px-5 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <a
            href={FORESIGHT_ORG_WWW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-16 items-center justify-center rounded-3xl border border-white/80 bg-white shadow-sm"
            aria-label="Foresight Institute — opens foresight.org in a new tab"
          >
            <img src={foresightIcon} alt="" className="size-9 object-contain" />
          </a>
          <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-gray-900">
            Create a Foresight community account
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            This account is for the wider community. You can find other community
            accounts, the Foresight team, and the people who choose to be visible
            here, and you can RSVP to programming. Node memory stays internal.
          </p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4 rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl"
        >
          <div className="space-y-1.5">
            <Label htmlFor="community-name">Name</Label>
            <Input
              id="community-name"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ada Lovelace"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="community-email">Email</Label>
            <Input
              id="community-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ada@example.com"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="community-city">City <span className="font-normal text-gray-400">optional</span></Label>
            <Input
              id="community-city"
              autoComplete="address-level2"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Berlin"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="community-password">Password</Label>
            <Input
              id="community-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="community-confirm">Confirm password</Label>
            <Input
              id="community-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="h-11"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-gray-600">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-gray-300"
            />
            <span>
              Other Foresight community accounts can see my name and profile.
              This does not add me to the fellow or grantee directory. We don’t
              sell this data.
            </span>
          </label>
          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="min-h-11 w-full">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create account
          </Button>
          <p className="text-center text-sm text-gray-600">
            <button type="button" onClick={onSignInInstead} className="font-medium text-teal-800 underline-offset-2 hover:underline">
              Already have an account? Sign in
            </button>
          </p>
        </form>

        <p className="mt-6 text-center text-sm leading-relaxed text-gray-600">
          To join the fellow and grantee network, apply on{" "}
          <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_ORG_WWW_URL} target="_blank" rel="noopener noreferrer">foresight.org</a>
          {" "}—{" "}
          <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_FELLOWSHIP_URL} target="_blank" rel="noopener noreferrer">fellowship</a>
          {" or "}
          <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_GRANTS_URL} target="_blank" rel="noopener noreferrer">grants</a>.
        </p>
        <div className="mt-6">
          <AgentHandoffCard />
        </div>
      </div>
    </main>
  );
}
