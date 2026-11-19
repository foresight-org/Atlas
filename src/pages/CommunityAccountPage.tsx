/**
 * CommunityAccountPage — deep-link fallback for /community.
 *
 * The public home sign-in overlay is the primary path. This page keeps the
 * same form for shared links, as a card over the soft wash rather than a wall of copy.
 */

import foresightIcon from "../assets/Foresight_RGB_Icon_Black.png?url";
import { CommunitySignupForm } from "../components/auth/CommunitySignupForm";
import { AgentAccessNote } from "../components/community/AgentAccessNote";
import {
  FORESIGHT_FELLOWSHIP_URL,
  FORESIGHT_GRANTS_URL,
  FORESIGHT_ORG_WWW_URL,
} from "../constants/foresight";
import type { DirectoryAuthResult } from "../services/memberAuth";

interface CommunityAccountPageProps {
  onCreated: (result: DirectoryAuthResult) => void;
  onSignInInstead: () => void;
}

export function CommunityAccountPage({ onCreated, onSignInInstead }: CommunityAccountPageProps) {
  return (
    <main className="min-h-[100svh] overflow-y-auto bg-[linear-gradient(165deg,rgba(209,250,229,0.55)_0%,rgba(255,255,255,0.96)_42%,rgba(165,243,252,0.45)_100%)] px-5 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md">
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
            Community account
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            For the wider Foresight community. Fellows and grantees appear only when they choose to.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl">
          <CommunitySignupForm onCreated={onCreated} onSignInInstead={onSignInInstead} />
        </div>

        <p className="mt-6 text-center text-sm leading-relaxed text-gray-600">
          To join the fellow and grantee network, apply on{" "}
          <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_ORG_WWW_URL} target="_blank" rel="noopener noreferrer">foresight.org</a>
          {" "}—{" "}
          <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_FELLOWSHIP_URL} target="_blank" rel="noopener noreferrer">fellowship</a>
          {" or "}
          <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_GRANTS_URL} target="_blank" rel="noopener noreferrer">grants</a>.
        </p>
        <div className="mt-6 flex justify-center">
          <AgentAccessNote />
        </div>
      </div>
    </main>
  );
}
