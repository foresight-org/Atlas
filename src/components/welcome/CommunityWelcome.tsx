/**
 * CommunityWelcome — the first screen after a community account signs in.
 *
 * It says, in plain words, which atlas this is. The fellow and grantee
 * network is a different door. The paste lets their own agent open sign-in.
 * It carries no password, so it cannot be reused to create more accounts.
 */

import * as DialogPrimitive from "@radix-ui/react-dialog@1.1.6";
import foresightIconUrl from "../../assets/Foresight_RGB_Icon_Black.png?url";
import { AgentAccessNote } from "../community/AgentAccessNote";
import { Button } from "../ui/button";
import { Dialog, DialogOverlay, DialogPortal } from "../ui/dialog";
import {
  FORESIGHT_FELLOWSHIP_URL,
  FORESIGHT_GRANTS_URL,
  FORESIGHT_ORG_WWW_URL,
} from "../../constants/foresight";
import { Z_INDEX_WELCOME } from "../../constants/zIndex";

interface CommunityWelcomeProps {
  fullName: string;
  onDismiss: () => void;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "";
}

export function CommunityWelcome({ fullName, onDismiss }: CommunityWelcomeProps) {
  const name = firstName(fullName);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-slate-900/25 backdrop-blur-[3px]" style={{ zIndex: Z_INDEX_WELCOME }} />
        <DialogPrimitive.Content
          aria-describedby="community-welcome-body"
          className="fixed top-1/2 left-1/2 flex max-h-[min(100dvh-1.5rem,46rem)] w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.75rem] border border-white/80 bg-[#fbfaf7] shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)] outline-none"
          style={{ zIndex: Z_INDEX_WELCOME + 1 }}
        >
          <div className="overflow-y-auto px-6 py-7 sm:px-8">
            <img src={foresightIconUrl} alt="" className="size-10 object-contain" />
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
              Foresight community
            </p>
            <h2 className="mt-2 font-heading text-[1.65rem] leading-tight text-gray-900">
              {name ? `Welcome, ${name}.` : "Welcome."} This is the larger Foresight community.
            </h2>
            <div id="community-welcome-body" className="mt-4 space-y-3 text-sm leading-relaxed text-gray-700">
              <p>
                This atlas can help you connect with others in the community, and with the Foresight team.
                Fellows and grantees appear here only when they choose to be visible. Node memory stays internal.
              </p>
              <p>
                To gain access to the fellow and grantee network, apply to be a fellow or a grantee.
              </p>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_ORG_WWW_URL} target="_blank" rel="noopener noreferrer">
                  www.foresight.org
                </a>
              </li>
              <li>
                <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_FELLOWSHIP_URL} target="_blank" rel="noopener noreferrer">
                  Apply for the fellowship
                </a>
              </li>
              <li>
                <a className="font-medium text-gray-900 underline underline-offset-2" href={FORESIGHT_GRANTS_URL} target="_blank" rel="noopener noreferrer">
                  Apply for a grant
                </a>
              </li>
            </ul>

            <Button type="button" className="mt-6 min-h-11 w-full" onClick={onDismiss}>
              Enter the community
            </Button>
            <div className="mt-4 flex justify-center">
              <AgentAccessNote />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
