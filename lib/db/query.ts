import type { FilterQuery } from "mongoose";

/** Escapes user input before it is embedded into a RegExp (ReDoS / injection). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive "contains" filter for a single string field. */
export function containsRegex(value: string): RegExp {
  return new RegExp(escapeRegex(value.trim()), "i");
}

/**
 * Builds a safe `$or` search filter across the given fields.
 * Returns an empty object when the query is blank so it can be merged directly
 * into a Mongoose filter.
 */
export function searchFilter<T>(
  query: string | undefined,
  fields: Array<keyof T & string>
): FilterQuery<T> {
  const term = query?.trim();
  if (!term) return {};
  const regex = containsRegex(term);
  return { $or: fields.map((field) => ({ [field]: regex })) } as FilterQuery<T>;
}

/** Whitelisted sort — never accept an arbitrary field name from the client. */
export function resolveSort<T>(
  requested: string | undefined,
  allowed: Record<string, keyof T & string>,
  fallbackKey: keyof T & string,
  direction: "asc" | "desc" = "desc"
): Record<string, 1 | -1> {
  const field = requested && allowed[requested] ? allowed[requested] : fallbackKey;
  return { [field]: direction === "asc" ? 1 : -1 };
}

/** Drops `undefined` values so partial updates never clear unrelated fields. */
export function compact<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

/** Escapes a string for safe use inside a fixed-string regex. */
export function exactMatch(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value.trim())}$`, "i");
}