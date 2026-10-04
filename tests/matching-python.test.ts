import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  checkPythonService,
  isPythonServiceConfigured,
  recommendEmployees,
} from "@/lib/matching/python";
import { rankEmployees } from "@/lib/matching/engine";
import { MATCH_WEIGHTS } from "@/types/matching";
import type {
  EmployeeMatchInput,
  EmployeeSkillInput,
  MatchResult,
  ProjectMatchInput,
  SkillRequirementInput,
} from "@/types/matching";

/**
 * Tests for the optional Python-engine integration (`lib/matching/python.ts`).
 *
 * The module is a *gateway*: when `MATCHING_SERVICE_URL` is set it POSTs the
 * candidate pool to the Python FastAPI mirror and, on any failure — non-200,
 * malformed payload, network error or timeout — it must transparently fall back
 * to the in-process TypeScript engine and report why (README §6.8).
 *
 * Instead of mocking `fetch`, these tests run a real ephemeral HTTP server so the
 * actual request/abort/timeout behaviour of the integration is exercised.
 */

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function skill(
  id: string,
  name: string,
  proficiency: number,
  category: EmployeeSkillInput["category"] = "Programming"
): EmployeeSkillInput {
  return { skillId: id, skillName: name, category, proficiency, yearsOfExperience: 3 };
}

function employee(overrides: Partial<EmployeeMatchInput> = {}): EmployeeMatchInput {
  return {
    employeeId: "emp-1",
    name: "Ada Lovelace",
    jobRole: "BACKEND_DEVELOPER",
    status: "ACTIVE",
    yearsOfExperience: 8,
    availabilityPercent: 90,
    currentWorkloadPercent: 20,
    skills: [skill("s-python", "Python", 5), skill("s-sql", "SQL", 4)],
    calendarAvailabilityPercent: null,
    ...overrides,
  };
}

function requirement(
  id: string,
  name: string,
  requiredProficiency: number,
  category: SkillRequirementInput["category"] = "Programming"
): SkillRequirementInput {
  return { skillId: id, skillName: name, category, requiredProficiency, importance: "REQUIRED" };
}

function project(overrides: Partial<ProjectMatchInput> = {}): ProjectMatchInput {
  return {
    projectId: "prj-1",
    name: "Banking Modernisation",
    requiredTeamSize: 3,
    requiredExperienceYears: 4,
    daysUntilDeadline: 60,
    requirements: [requirement("s-python", "Python", 4), requirement("s-sql", "SQL", 3)],
    preferredRoles: ["BACKEND_DEVELOPER"],
    ...overrides,
  };
}

/** Two candidates whose scores differ, so ordering can be asserted. */
const POOL: EmployeeMatchInput[] = [
  employee({ employeeId: "strong", name: "Strong Candidate" }),
  employee({
    employeeId: "weak",
    name: "Weak Candidate",
    yearsOfExperience: 1,
    availabilityPercent: 20,
    currentWorkloadPercent: 120,
    skills: [skill("s-python", "Python", 1)],
  }),
];

/* ------------------------------------------------------------------ */
/* A controllable stand-in for the FastAPI mirror                      */
/* ------------------------------------------------------------------ */

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Server;
let baseUrl: string;
let handler: Handler;

beforeAll(async () => {
  server = createServer((req, res) => handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  // Any hanging connection left by the timeout test must not stall the suite.
  server.closeAllConnections?.();
});

/* ------------------------------------------------------------------ */
/* Environment handling                                                */
/* ------------------------------------------------------------------ */

const KEY = "MATCHING_SERVICE_URL";
let original: string | undefined;

beforeEach(() => {
  original = process.env[KEY];
  delete process.env[KEY];
  handler = (_req, res) => {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ detail: "not configured" }));
  };
});

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

/** Convenience: a JSON responder with a given status. */
function json(status: number, body: unknown): Handler {
  return (_req, res) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
}


/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("isPythonServiceConfigured", () => {
  it("is false when MATCHING_SERVICE_URL is unset", () => {
    expect(isPythonServiceConfigured()).toBe(false);
  });

  it("is false for a blank value and true for a real URL", () => {
    process.env[KEY] = "   ";
    expect(isPythonServiceConfigured()).toBe(false);
    process.env[KEY] = baseUrl;
    expect(isPythonServiceConfigured()).toBe(true);
  });
});

describe("recommendEmployees - local engine", () => {
  it("uses the TypeScript engine when the Python service is not configured", async () => {
    const response = await recommendEmployees(POOL, project());

    expect(response.engine).toBe("typescript");
    expect(response.fallbackReason).toBeUndefined();
    // Identical to calling the pure engine directly.
    expect(response.results).toEqual(rankEmployees(POOL, project()));
  });

  it("honours forceLocal even when a reachable URL is configured", async () => {
    process.env[KEY] = baseUrl;
    // A 500 responder: if the module tried the network the result would differ.
    handler = json(500, { detail: "boom" });

    const response = await recommendEmployees(POOL, project(), { forceLocal: true });

    expect(response.engine).toBe("typescript");
    expect(response.fallbackReason).toBeUndefined();
    expect(response.results).toEqual(rankEmployees(POOL, project()));
  });
});

describe("recommendEmployees - remote engine", () => {
  it("returns Python-scored results, sorted best-first and tagged as the python engine", async () => {
    process.env[KEY] = baseUrl;

    // The real engine output, delivered in reverse order and stamped with the
    // wrong engine, so both the re-sorting and the engine tagging are observable.
    const real = rankEmployees(POOL, project());
    const outOfOrder = [...real]
      .reverse()
      .map((result) => ({ ...result, engine: "typescript" as const }));

    handler = json(200, { results: outOfOrder });

    const response = await recommendEmployees(POOL, project());

    expect(response.engine).toBe("python");
    expect(response.fallbackReason).toBeUndefined();
    expect(response.results.map((r) => r.employeeId)).toEqual(
      [...real].sort((a, b) => b.overallScore - a.overallScore).map((r) => r.employeeId)
    );
    for (const result of response.results) {
      expect(result.engine).toBe("python");
    }
    // Descending overall score.
    const scores = response.results.map((r: MatchResult) => r.overallScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("accepts an empty result set without falling back", async () => {
    process.env[KEY] = baseUrl;
    handler = json(200, { results: [] });

    const response = await recommendEmployees(POOL, project());

    expect(response.engine).toBe("python");
    expect(response.results).toEqual([]);
  });
});

describe("recommendEmployees - fallback contract", () => {
  it("falls back to TypeScript on a non-200 response and reports the status", async () => {
    process.env[KEY] = baseUrl;
    handler = json(503, { detail: "overloaded" });

    const response = await recommendEmployees(POOL, project());

    expect(response.engine).toBe("typescript");
    expect(response.fallbackReason).toContain("503");
    expect(response.results).toEqual(rankEmployees(POOL, project()));
  });

  it("falls back when the payload has no results array", async () => {
    process.env[KEY] = baseUrl;
    handler = json(200, { results: "not-an-array" });

    const response = await recommendEmployees(POOL, project());

    expect(response.engine).toBe("typescript");
    expect(response.fallbackReason).toMatch(/unexpected payload/i);
    expect(response.results).toEqual(rankEmployees(POOL, project()));
  });

  it("falls back when the service is unreachable", async () => {
    // Port 1 is never listening: the connection is refused immediately.
    process.env[KEY] = "http://127.0.0.1:1";

    const response = await recommendEmployees(POOL, project());

    expect(response.engine).toBe("typescript");
    expect(response.fallbackReason).toMatch(/unavailable/i);
    expect(response.results).toEqual(rankEmployees(POOL, project()));
  });

  it("falls back when the service does not answer before the timeout", async () => {
    process.env[KEY] = baseUrl;
    // A responder that never writes: the request can only end via the timeout.
    handler = () => {};

    const response = await recommendEmployees(POOL, project(), { timeoutMs: 150 });

    expect(response.engine).toBe("typescript");
    expect(response.fallbackReason).toMatch(/unavailable/i);
    expect(response.results).toEqual(rankEmployees(POOL, project()));
  });
});

describe("checkPythonService - liveness probe", () => {
  it("reports the service as unconfigured without touching the network", async () => {
    // `beforeEach` clears MATCHING_SERVICE_URL, so there is no URL to probe.
    const health = await checkPythonService();

    expect(health.configured).toBe(false);
    expect(health.reachable).toBe(false);
    expect(health.reason).toMatch(/not configured/i);
  });

  it("probes the /health path and reports the engine and weights on success", async () => {
    process.env[KEY] = baseUrl;
    let requestedPath: string | undefined;
    handler = (req, res) => {
      requestedPath = req.url;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ status: "ok", engine: "python", weights: MATCH_WEIGHTS })
      );
    };

    const health = await checkPythonService();

    expect(requestedPath).toBe("/health");
    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(true);
    expect(health.engine).toBe("python");
    expect(health.weights).toEqual(MATCH_WEIGHTS);
    expect(health.reason).toBeUndefined();
  });

  it("tolerates a 2xx payload that omits engine and weights", async () => {
    process.env[KEY] = baseUrl;
    handler = json(200, { status: "ok" });

    const health = await checkPythonService();

    expect(health.reachable).toBe(true);
    expect(health.engine).toBeUndefined();
    expect(health.weights).toBeUndefined();
  });

  it("reports a non-2xx response as unreachable and includes the status", async () => {
    process.env[KEY] = baseUrl;
    handler = json(503, { detail: "starting up" });

    const health = await checkPythonService();

    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(false);
    expect(health.reason).toContain("503");
  });

  it("never throws when the service cannot be reached", async () => {
    // Port 1 is never listening: the connection is refused immediately.
    process.env[KEY] = "http://127.0.0.1:1";

    const health = await checkPythonService();

    expect(health.reachable).toBe(false);
    expect(health.reason).toMatch(/unavailable/i);
  });

  it("reports a timeout as unreachable instead of hanging", async () => {
    process.env[KEY] = baseUrl;
    // A responder that never writes: the probe can only end via the timeout.
    handler = () => {};

    const health = await checkPythonService({ timeoutMs: 150 });

    expect(health.reachable).toBe(false);
    expect(health.reason).toMatch(/unavailable/i);
  });

  it("never throws on a malformed (non-JSON) body", async () => {
    process.env[KEY] = baseUrl;
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("not json at all");
    };

    const health = await checkPythonService();

    expect(health.reachable).toBe(false);
    expect(health.reason).toMatch(/unavailable/i);
  });
});

