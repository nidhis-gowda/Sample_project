import type {
  EmployeeMatchInput,
  MatchResult,
  ProjectMatchInput,
} from "@/types/matching";
import { rankEmployees } from "./engine";

/**
 * Optional integration with the Python FastAPI matching service (`ml-service/`).
 *
 * The TypeScript engine is always available and is used as the fallback, so the
 * core application keeps working even when the Python service is offline or not
 * deployed. Set `MATCHING_SERVICE_URL` to enable it.
 */

const DEFAULT_TIMEOUT_MS = 2500;

export interface RecommendOptions {
  /** Force the local TypeScript engine even if the Python service is reachable. */
  forceLocal?: boolean;
  timeoutMs?: number;
}

export interface RecommendResponse {
  results: MatchResult[];
  engine: "typescript" | "python";
  /** Populated when a remote engine was attempted but failed. */
  fallbackReason?: string;
}

export function isPythonServiceConfigured(): boolean {
  return Boolean(process.env.MATCHING_SERVICE_URL?.trim());
}

export async function recommendEmployees(
  employees: EmployeeMatchInput[],
  project: ProjectMatchInput,
  options: RecommendOptions = {}
): Promise<RecommendResponse> {
  const local = (): RecommendResponse => ({
    results: rankEmployees(employees, project),
    engine: "typescript",
  });

  if (options.forceLocal || !isPythonServiceConfigured()) {
    return local();
  }

  const baseUrl = process.env.MATCHING_SERVICE_URL!.replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${baseUrl}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employees, project }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { ...local(), fallbackReason: `Python service responded ${response.status}` };
    }

    const payload = (await response.json()) as { results?: MatchResult[] };
    if (!payload?.results || !Array.isArray(payload.results)) {
      return { ...local(), fallbackReason: "Python service returned an unexpected payload" };
    }

    const results = payload.results
      .map((r) => ({ ...r, engine: "python" as const }))
      .sort((a, b) => b.overallScore - a.overallScore);

    return { results, engine: "python" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return { ...local(), fallbackReason: `Python service unavailable (${reason})` };
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/* Liveness probing                                                    */
/* ------------------------------------------------------------------ */

export interface PythonServiceHealth {
  /** Whether MATCHING_SERVICE_URL is set at all. */
  configured: boolean;
  /** Whether `/health` answered with a 2xx payload. */
  reachable: boolean;
  /** Engine name reported by the service (expected: "python"). */
  engine?: string;
  /** Published component weights, used to spot a drifting service. */
  weights?: Record<string, number>;
  /** Human-readable explanation when the service is not reachable. */
  reason?: string;
}

/**
 * Probe the optional Python service's `/health` endpoint.
 *
 * This is the *liveness* half of the integration: `recommendEmployees` only
 * discovers that the service is missing once it has already committed to a
 * scoring request and fallen back. Exposing the probe lets `GET /api/health`
 * report which engine would answer, and — more usefully — *why* the Python
 * engine is unavailable (not configured, unreachable, non-2xx, bad payload).
 *
 * Never throws. Callers get an explanatory `reason` instead of an exception so
 * that a monitoring endpoint can always produce a response.
 */
export async function checkPythonService(
  options: { timeoutMs?: number } = {}
): Promise<PythonServiceHealth> {
  if (!isPythonServiceConfigured()) {
    return {
      configured: false,
      reachable: false,
      reason: "MATCHING_SERVICE_URL is not configured",
    };
  }

  const baseUrl = process.env.MATCHING_SERVICE_URL!.replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        configured: true,
        reachable: false,
        reason: `Python service responded ${response.status}`,
      };
    }

    const payload = (await response.json()) as {
      engine?: unknown;
      weights?: unknown;
    };

    return {
      configured: true,
      reachable: true,
      engine: typeof payload?.engine === "string" ? payload.engine : undefined,
      weights:
        payload?.weights && typeof payload.weights === "object"
          ? (payload.weights as Record<string, number>)
          : undefined,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return {
      configured: true,
      reachable: false,
      reason: `Python service unavailable (${reason})`,
    };
  } finally {
    clearTimeout(timeout);
  }
}