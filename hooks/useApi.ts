"use client";

import * as React from "react";

/**
 * Tiny fetch wrapper that understands the API envelope used by the backend.
 *
 * It unwraps `{ ok: true, data }` into the value and turns
 * `{ ok: false, error }` into a typed `ApiRequestError` carrying the HTTP status
 * and the per-field messages produced by Zod.
 */

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code: string,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

interface ApiFailure {
  ok: false;
  error: { code: string; message: string; fields?: Record<string, string> };
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<ApiResult<T>> {
  const { json, ...rest } = init ?? {};

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      throw new ApiRequestError(
        "The server returned an unexpected response.",
        response.status,
        "UNEXPECTED"
      );
    }
    return { data: undefined as T };
  }

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!payload.ok) {
    throw new ApiRequestError(
      payload.error.message,
      response.status,
      payload.error.code,
      payload.error.fields
    );
  }

  return { data: payload.data, meta: payload.meta };
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, json?: unknown) => request<T>(path, { method: "POST", json }),
  put: <T,>(path: string, json?: unknown) => request<T>(path, { method: "PUT", json }),
  patch: <T,>(path: string, json?: unknown) => request<T>(path, { method: "PATCH", json }),
  delete: <T,>(path: string, json?: unknown) =>
    request<T>(path, { method: "DELETE", json }),
};

/** Human readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}