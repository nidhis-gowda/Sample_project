import type { ZodTypeAny, z } from "zod";
import { HttpError } from "./http-error";

/** Shared helpers for reading and validating request payloads. */

/**
 * Parses the JSON body once and returns it as a plain object.
 * Invalid JSON is reported as a 400 (never a 500) with a friendly message.
 *
 * A `Request` body stream can only be consumed **once**, so a handler that needs
 * to inspect the payload shape must use this and validate the already-parsed
 * value, rather than calling `request.json()` a second time.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw HttpError.badRequest("The request body must be valid JSON.");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw HttpError.badRequest("The request body must be a JSON object.");
  }
  return raw as Record<string, unknown>;
}

/**
 * Parses a JSON body and validates it against a Zod schema.
 * Invalid JSON is reported as a 400 (never a 500) with a friendly message.
 */
export async function readBody<S extends ZodTypeAny>(
  request: Request,
  schema: S
): Promise<z.infer<S>> {
  const raw = await readJsonObject(request);
  // Throwing the ZodError lets `handleError` map it onto field level 400s.
  return schema.parse(raw) as z.infer<S>;
}

/**
 * Validates query string parameters. Zod's `.catch()` defaults in the shared
 * list schemas mean an unrecognised value degrades gracefully instead of
 * producing a hard 400 for a pagination hint.
 */
export function readQuery<S extends ZodTypeAny>(
  request: Request,
  schema: S
): z.infer<S> {
  const url = new URL(request.url);
  const entries: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    entries[key] = value;
  });
  return schema.parse(entries) as z.infer<S>;
}

/** Convenience: a single query string parameter. */
export function queryParam(request: Request, key: string): string | undefined {
  const value = new URL(request.url).searchParams.get(key);
  return value === null ? undefined : value;
}