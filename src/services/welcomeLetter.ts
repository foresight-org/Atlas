/**
 * First-arrival letter.
 *
 * Armed only when an account is claimed: a claim link, a join, a new
 * profile, or the first magic-link open of an unclaimed row. A later
 * sign-in does not arm it. Closing it is remembered on this browser.
 *
 * The pending flag lives for this tab only. A returning member who already
 * has the atlas open is not interrupted, and an old pending flag left in
 * localStorage from a previous sign-in is dropped.
 */

const SEEN_KEY = "foresightatlas_welcome_seen";
const PENDING_KEY = "foresightatlas_welcome_pending";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function hasSeenWelcome(personId: string): boolean {
  return readSeen().includes(personId);
}

function markWelcomeSeen(personId: string): void {
  if (!personId || hasSeenWelcome(personId)) return;
  try {
    const next = [...readSeen(), personId].slice(-200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // Private mode can refuse the write. The letter may greet them once more.
  }
}

function readPending(): string | null {
  try {
    /* Older builds stored this across visits, so a sign-in reopened the letter. */
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Private mode can refuse the write.
  }
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Call once when the app boots.
 * A live session is someone already inside. Mark them seen unless their
 * letter is still waiting.
 */
export function noteExistingSession(personId: string | null): void {
  if (!personId) return;
  if (readPending() === personId) return;
  markWelcomeSeen(personId);
}

/** Queue the letter for this claim. No-ops once they have closed it. */
export function armWelcomeLetter(personId: string): void {
  if (!personId || hasSeenWelcome(personId)) return;
  try {
    sessionStorage.setItem(PENDING_KEY, personId);
  } catch {
    // Private mode can refuse the write. The letter may not appear.
  }
}

export function welcomeLetterIsPending(personId: string): boolean {
  if (!personId || hasSeenWelcome(personId)) return false;
  return readPending() === personId;
}

export function dismissWelcomeLetter(personId: string): void {
  if (personId) markWelcomeSeen(personId);
  try {
    if (!personId || readPending() === personId) sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // The seen flag is what keeps it closed.
  }
}
