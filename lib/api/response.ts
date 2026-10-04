import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./http-error";
import type { PaginationMeta } from "@/types";

/**
 * Consistent JSON API envelope:
 *   success -> { ok: true, data, meta? }
 *   failure -> { ok: false, error: { code, message, fields? } }
 *
 * Stack traces are never returned; unknown errors are logged server-side and
 * reported as a generic 500.
 */

/** Metadata accepted alongside a successful payload. */
export type ResponseMeta = PaginationMeta | Record<string, unknown>;

export function ok<T>(data: T, init?: { status?: number; meta?: ResponseMeta }) {
  return NextResponse.json(
    { ok: true as const, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 }
  );
}

export function created<T>(data: T, meta?: ResponseMeta) {
  return ok(data, { status: 201, meta });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(error: HttpError) {
  const body = {
    ok: false as const,
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
      ...(error.details && process.env.NODE_ENV !== "production"
        ? { details: error.details }
        : {}),
    },
  };
  return NextResponse.json(body, { status: error.status });
}

interface MongoLikeError {
  name?: string;
  code?: number;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { message?: string }>;
  message?: string;
}

/** Maps Zod, Mongoose and unknown errors onto the HTTP envelope. */
export function handleError(error: unknown): NextResponse {
  if (error instanceof HttpError) return fail(error);

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".") || "form";
      if (!fields[path]) fields[path] = issue.message;
    }
    return fail(
      HttpError.badRequest(
        error.issues[0]?.message ?? "The submitted data is invalid.",
        fields
      )
    );
  }

  if (error && typeof error === "object") {
    const mongoError = error as MongoLikeError;

    // Duplicate key (unique index violation)
    if (mongoError.code === 11000) {
      const field = mongoError.keyValue ? Object.keys(mongoError.keyValue)[0] : undefined;
      return fail(
        HttpError.conflict(
          field
            ? `A record with the same ${field} already exists.`
            : "A record with the same unique values already exists."
        )
      );
    }

    // Mongoose document validation error
    if (mongoError.name === "ValidationError" && mongoError.errors) {
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(mongoError.errors)) {
        fields[key] = value?.message ?? "Invalid value";
      }
      return fail(HttpError.badRequest("The submitted data is invalid.", fields));
    }

    // Malformed ObjectId / cast errors
    if (mongoError.name === "CastError") {
      return fail(HttpError.badRequest("The provided identifier is invalid."));
    }

    // Mongoose model/schema mismatch
    if (mongoError.name === "MongooseServerSelectionError") {
      return fail(
        HttpError.serviceUnavailable(
          "Could not reach the database. Please check MONGODB_URI and your network."
        )
      );
    }
  }

  console.error("[api] unhandled error:", error);
  return fail(HttpError.internal());
}

/** Convenience wrapper so route handlers stay free of try/catch noise. */
export function withApi<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

/* ------------------------------------------------------------------ */
/* Pagination helpers                                                  */
/* ------------------------------------------------------------------ */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

export function readPagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const rawSize = Number.parseInt(
    searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
    10
  );
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Number.isFinite(rawSize) && rawSize > 0 ? rawSize : DEFAULT_PAGE_SIZE
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginationMeta(
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}