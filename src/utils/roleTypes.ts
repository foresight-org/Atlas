import type { Person, RoleType } from "../types";

const VALID_ROLE_TYPES: RoleType[] = [
  "Fellow",
  "Grantee",
  "Prize Winner",
  "Senior Fellow",
  "Nodee",
  "Foresight Team",
  "Community",
];

export const ROLE_TYPE_OPTIONS: RoleType[] = VALID_ROLE_TYPES;

/** Self-service profile picker. Team, Senior Fellow, and Community are not choosable. */
export const PROFILE_ROLE_TYPE_OPTIONS: RoleType[] = VALID_ROLE_TYPES.filter(
  (r) => r !== "Senior Fellow" && r !== "Foresight Team" && r !== "Community",
);

const NODE_ADDABLE: RoleType[] = ["Fellow", "Grantee"];

/** The invite or sheet role. Nodee is an addition, not a replacement. */
export function lockedPrimaryRole(
  person: Pick<Person, "roleType" | "roleTypes"> | null | undefined,
): RoleType {
  const roles = getPersonRoleTypes(person);
  return roles.find((role) => role !== "Nodee") ?? roles[0] ?? "Fellow";
}

export function canAlsoBeNodee(
  person: Pick<Person, "roleType" | "roleTypes"> | null | undefined,
): boolean {
  return NODE_ADDABLE.includes(lockedPrimaryRole(person));
}

/** Fellow or grantee stays. Nodee may be added. Staff and community roles stay as assigned. */
export function withNodeeChoice(
  person: Pick<Person, "roleType" | "roleTypes"> | null | undefined,
  alsoNodee: boolean,
): RoleType[] {
  const primary = lockedPrimaryRole(person);
  if (primary === "Community") return ["Community"];
  if (primary === "Foresight Team") return ["Foresight Team"];
  if (primary === "Senior Fellow") return ["Senior Fellow"];
  if (NODE_ADDABLE.includes(primary) && alsoNodee) return [primary, "Nodee"];
  return [primary];
}

/** Roles a standing /join invite may create. Team / Senior Fellow stay staff-assigned. */
export const JOIN_ROLE_TYPE_OPTIONS: RoleType[] = VALID_ROLE_TYPES.filter(
  (r) => r !== "Senior Fellow" && r !== "Foresight Team" && r !== "Community",
);

export function getPrimaryRoleType(
  person: Pick<Person, "roleType" | "roleTypes"> | null | undefined,
): RoleType {
  return primaryRoleType(getPersonRoleTypes(person));
}

/** Parse roleType cell or in-memory value — plain string, JSON array, or comma-separated. */
export function parseRoleTypes(value: unknown): RoleType[] {
  if (value == null || String(value).trim() === "") return ["Fellow"];
  const s = String(value).trim();
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        const roles = parsed
          .map((r) => String(r).trim())
          .filter((r): r is RoleType => VALID_ROLE_TYPES.includes(r as RoleType));
        return roles.length > 0 ? roles : ["Fellow"];
      }
    } catch {
      /* fall through */
    }
  }
  if (s.includes(",")) {
    const roles = s
      .split(",")
      .map((r) => r.trim())
      .filter((r): r is RoleType => VALID_ROLE_TYPES.includes(r as RoleType));
    return roles.length > 0 ? roles : ["Fellow"];
  }
  return VALID_ROLE_TYPES.includes(s as RoleType) ? [s as RoleType] : ["Fellow"];
}

export function getPersonRoleTypes(
  person: Pick<Person, "roleType" | "roleTypes"> | null | undefined,
): RoleType[] {
  if (!person) return ["Fellow"];
  if (person.roleTypes?.length) return person.roleTypes;
  return parseRoleTypes(person.roleType);
}

export function primaryRoleType(roles: RoleType[]): RoleType {
  return roles[0] ?? "Fellow";
}

export function normalizeAffiliationInput(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}
