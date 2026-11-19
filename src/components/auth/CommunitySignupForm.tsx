/**
 * Community account form — used inside the public sign-in overlay and on /community.
 */

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { createCommunityAccount, type DirectoryAuthResult } from "../../services/memberAuth";

interface CommunitySignupFormProps {
  onCreated: (result: DirectoryAuthResult) => void;
  onSignInInstead?: () => void;
  submitLabel?: string;
}

export function CommunitySignupForm({
  onCreated,
  onSignInInstead,
  submitLabel = "Create account",
}: CommunitySignupFormProps) {
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
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
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
        <Label htmlFor="community-city">
          City <span className="font-normal text-gray-400">optional</span>
        </Label>
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
        {submitLabel}
      </Button>
      {onSignInInstead ? (
        <p className="text-center text-sm text-gray-600">
          <button
            type="button"
            onClick={onSignInInstead}
            className="font-medium text-teal-800 underline-offset-2 hover:underline"
          >
            Already have an account? Sign in
          </button>
        </p>
      ) : null}
    </form>
  );
}
