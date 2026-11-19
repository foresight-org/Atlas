import { useEffect, useMemo } from "react";
import { MapPin } from "lucide-react";
import { getLastSignedInName } from "../../services/identity";
import { setPostLoginReturnUrl } from "../../services/returnUrl";
import {
  getCheckInAuthCopy,
  checkInReturnPath,
} from "../../utils/checkInAuth";
import { DirectoryLoginForm } from "./DirectoryLoginForm";
import foresightIcon from "../../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../../constants/foresight";
interface AuthGateProps {
  /** Current path (e.g. `/checkin/berlin`) — used for QR check-in context. */
  route: string;
  /** Authenticate a member; resolves with ok=false + message on failure. */
  onSignIn: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * AuthGate — the front door when someone lands on a gated route unsigned-in.
 *
 * Check-in keeps its own line. Everywhere else is the same door:
 * fellows, grantees, prize winners, nodees, and invited guests.
 */
export function AuthGate({ route, onSignIn }: AuthGateProps) {
  const checkInCopy = useMemo(() => getCheckInAuthCopy(route), [route]);

  useEffect(() => {
    const returnPath = checkInReturnPath(route);
    if (returnPath) setPostLoginReturnUrl(returnPath);
  }, [route]);

  return (
    <main
      className="relative flex min-h-[100svh] flex-col items-center justify-start overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 py-8 sm:min-h-[100dvh] sm:justify-center sm:py-10"
      style={{
        background:
          "linear-gradient(165deg, rgba(254,243,199,0.45) 0%, rgba(255,255,255,0.95) 42%, rgba(191,219,254,0.4) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-36 left-[18%] size-[28rem] rounded-full bg-amber-200/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-[10%] size-[24rem] rounded-full bg-sky-200/30 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className={`flex size-16 items-center justify-center rounded-3xl border bg-white/95 shadow-sm ${
              checkInCopy ? "border-amber-200/80" : "border-gray-200"
            }`}
          >
            {checkInCopy ? (
              <MapPin className="size-8 text-teal-700" aria-hidden />
            ) : (
              <a
                href={FORESIGHT_ORG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-full items-center justify-center rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                aria-label="Foresight Institute — opens foresight.org in a new tab"
              >
                <img src={foresightIcon} alt="" className="size-9 object-contain" />
              </a>
            )}
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
            {checkInCopy ? checkInCopy.heroTitle : "Sign in"}
          </h1>
          {!checkInCopy ? (
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Fellows, grantees, prize winners, nodees, and guests invited after an event.
            </p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm sm:p-7">
          <DirectoryLoginForm
            title={checkInCopy?.formTitle}
            submitLabel={checkInCopy?.submitLabel}
            initialName={getLastSignedInName()}
            onSubmit={onSignIn}
            showAccountRecovery
          />
        </div>
      </div>
    </main>
  );
}
