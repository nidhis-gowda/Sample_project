/**
 * Typed HTTP error used by the API layer and the server-side guards.
 *
 * Route handlers convert it into a consistent JSON envelope through
 * `lib/api/response.ts`; nothing else ever leaks internals to the client.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  /** Extra, non-sensitive detail (never a stack trace). */
  readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    options?: { fields?: Record<string, string>; details?: unknown }
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code ?? defaultCodeFor(status);
    this.fields = options?.fields;
    this.details = options?.details;
  }

  static badRequest(message = "Invalid input", fields?: Record<string, string>) {
    return new HttpError(400, message, "BAD_REQUEST", { fields });
  }
  static unauthorized(message = "You must sign in to perform this action.") {
    return new HttpError(401, message, "UNAUTHENTICATED");
  }
  static forbidden(message = "You do not have permission to perform this action.") {
    return new HttpError(403, message, "FORBIDDEN");
  }
  static notFound(message = "The requested resource was not found.") {
    return new HttpError(404, message, "NOT_FOUND");
  }
  static conflict(message = "The resource already exists or conflicts with existing data.") {
    return new HttpError(409, message, "CONFLICT");
  }
  static tooManyRequests(message = "Too many requests. Please slow down.") {
    return new HttpError(429, message, "RATE_LIMITED");
  }
  static serviceUnavailable(message = "A required service is unavailable.") {
    return new HttpError(503, message, "SERVICE_UNAVAILABLE");
  }
  static internal(message = "Something went wrong on our side.") {
    return new HttpError(500, message, "INTERNAL_ERROR");
  }
}

export function defaultCodeFor(status: number): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "ERROR";
  }
}