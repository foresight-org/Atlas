import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { requestLoginLink } from "../../services/loginLink";

interface DirectoryLoginFormProps {
  title?: string;
  description?: string;
  submitLabel?: string;
  onCancel?: () => void;
  /** Kept so a remembered name can hint the field, never to sign in by name. */
  initialName?: string | null;
}

/**
 * Sign-in is an email link. The address has to already be on an atlas account.
 * The reply is the same either way, so the form cannot be used to look people up.
 */
export function DirectoryLoginForm({
  title,
  description,
  submitLabel = "Email me a sign-in link",
  onCancel,
  initialName,
}: DirectoryLoginFormProps) {
  const remembered = (initialName ?? "").trim();
  const [email, setEmail] = useState(remembered.includes("@") ? remembered : "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter the email on your atlas account.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await requestLoginLink(trimmed);
      setSent(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a sign-in link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="on" className="space-y-5">
      {title || description ? (
        <div className="space-y-2">
          {title ? (
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-sm leading-6 text-gray-600">{description}</p>
          ) : null}
        </div>
      ) : null}

      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-950">
          {sent}
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="directory-login-email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="directory-login-email"
              name="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email on your account"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 pl-10"
            />
          </div>
          <p className="text-sm leading-6 text-gray-600">
            We email a link that signs you in. Accounts are by invite, so the address has to be the one we already have.
          </p>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} className="min-h-[44px]">
            Cancel
          </Button>
        ) : null}
        {sent ? null : (
          <Button type="submit" disabled={isSubmitting} className="min-h-[44px] px-5">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
