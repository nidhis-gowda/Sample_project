import { describe, expect, it } from "vitest";
import {
  createEmployeeSchema,
  selfEmployeeUpdateSchema,
  setEmployeeSkillsSchema,
} from "@/lib/validators/employee";
import {
  createProjectSchema,
  allocateTeamSchema,
  createAllocationSchema,
  recommendationQuerySchema,
} from "@/lib/validators/project";
import { createSkillSchema } from "@/lib/validators/skill";
import { updateSettingsSchema, matchingWeightsSchema } from "@/lib/validators/admin";
import { escapeRegex, resolveSort, searchFilter } from "@/lib/db/query";

/**
 * Validation tests.
 *
 * The same Zod schemas run on the server for every write, so these assertions
 * pin down the input contract of the REST API.
 */

const OBJECT_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f1f77bcf86cd799439012";

describe("employee validation", () => {
  const valid = {
    name: "Alex Morgan",
    email: "Alex.Morgan@Example.COM",
    jobRole: "BACKEND_DEVELOPER",
  };

  it("accepts a minimal valid employee and normalises the email", () => {
    const parsed = createEmployeeSchema.parse(valid);
    expect(parsed.email).toBe("alex.morgan@example.com");
    expect(parsed.status).toBe("ACTIVE");
    expect(parsed.availabilityPercent).toBe(100);
    expect(parsed.skills).toEqual([]);
  });

  it("rejects an invalid email", () => {
    const result = createEmployeeSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown job role", () => {
    const result = createEmployeeSchema.safeParse({ ...valid, jobRole: "ROCKET_SCIENTIST" });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range availability and experience", () => {
    expect(
      createEmployeeSchema.safeParse({ ...valid, availabilityPercent: 101 }).success
    ).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ ...valid, yearsOfExperience: -1 }).success
    ).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ ...valid, yearsOfExperience: 80 }).success
    ).toBe(false);
  });

  it("rejects a non ObjectId department reference", () => {
    expect(
      createEmployeeSchema.safeParse({ ...valid, departmentId: "engineering" }).success
    ).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ ...valid, departmentId: OBJECT_ID }).success
    ).toBe(true);
  });

  it("clamps proficiency to the 1-5 range", () => {
    expect(
      setEmployeeSkillsSchema.safeParse({
        skills: [{ skillId: "s1", proficiency: 0, yearsOfExperience: 1 }],
      }).success
    ).toBe(false);
    expect(
      setEmployeeSkillsSchema.safeParse({
        skills: [{ skillId: "s1", proficiency: 6, yearsOfExperience: 1 }],
      }).success
    ).toBe(false);
    expect(
      setEmployeeSkillsSchema.safeParse({
        skills: [{ skillId: "s1", proficiency: 5, yearsOfExperience: 1 }],
      }).success
    ).toBe(true);
  });

  it("silently ignores fields outside the self-service allow list", () => {
    // Zod strips unknown keys, so an employee posting `jobRole` or `email` has
    // those fields discarded rather than applied. That is the property that
    // stops privilege escalation through the profile endpoint.
    const parsed = selfEmployeeUpdateSchema.parse({
      availabilityPercent: 50,
      jobRole: "ADMIN",
      email: "attacker@example.com",
    });

    expect(parsed).toEqual({ availabilityPercent: 50 });
    expect(Object.keys(parsed)).toEqual(["availabilityPercent"]);
  });

  it("still rejects invalid values for the allowed fields", () => {
    expect(selfEmployeeUpdateSchema.safeParse({ availabilityPercent: 500 }).success).toBe(false);
    expect(selfEmployeeUpdateSchema.safeParse({ yearsOfExperience: -5 }).success).toBe(false);
  });
});

describe("project validation", () => {
  const valid = {
    name: "Banking Modernisation",
    code: "prj-0001",
    clientName: "Northwind Bank",
    startDate: "2025-01-01",
    deadline: "2025-06-01",
    requiredTeamSize: 4,
  };

  it("accepts a valid project and uppercases the code", () => {
    const parsed = createProjectSchema.parse(valid);
    expect(parsed.code).toBe("PRJ-0001");
    expect(parsed.status).toBe("PLANNING");
    expect(parsed.priority).toBe("MEDIUM");
    expect(parsed.requirements).toEqual([]);
  });

  it("rejects a deadline before the start date", () => {
    const result = createProjectSchema.safeParse({
      ...valid,
      startDate: "2025-06-01",
      deadline: "2025-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("deadline");
    }
  });

  it("rejects an unknown status or priority", () => {
    expect(
      createProjectSchema.safeParse({ ...valid, status: "PAUSED" }).success
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({ ...valid, priority: "URGENT" }).success
    ).toBe(false);
  });

  it("rejects a team size below one", () => {
    expect(
      createProjectSchema.safeParse({ ...valid, requiredTeamSize: 0 }).success
    ).toBe(false);
  });

  it("rejects requirements with an out-of-range proficiency", () => {
    expect(
      createProjectSchema.safeParse({
        ...valid,
        requirements: [
          { skillId: OBJECT_ID, requiredProficiency: 6, importance: "REQUIRED" },
        ],
      }).success
    ).toBe(false);
  });
});

describe("allocation validation", () => {
  it("requires a percentage between 1 and 100", () => {
    const base = {
      employeeId: OBJECT_ID,
      allocationPercent: 50,
      roleInProject: "Backend Engineer",
    };
    expect(createAllocationSchema.safeParse(base).success).toBe(true);
    expect(createAllocationSchema.safeParse({ ...base, allocationPercent: 0 }).success).toBe(
      false
    );
    expect(createAllocationSchema.safeParse({ ...base, allocationPercent: 101 }).success).toBe(
      false
    );
  });

  it("defaults allowOverallocated to false", () => {
    const parsed = createAllocationSchema.parse({
      employeeId: OBJECT_ID,
      allocationPercent: 50,
      roleInProject: "Backend Engineer",
    });
    expect(parsed.allowOverallocated).toBe(false);
  });

  it("requires at least one team member", () => {
    expect(allocateTeamSchema.safeParse({ members: [] }).success).toBe(false);
    expect(
      allocateTeamSchema.safeParse({
        members: [
          {
            employeeId: OBJECT_ID,
            allocationPercent: 50,
            roleInProject: "Lead",
          },
        ],
      }).success
    ).toBe(true);
  });

  it("rejects an invalid employee id in a team", () => {
    expect(
      allocateTeamSchema.safeParse({
        members: [
          { employeeId: "abc", allocationPercent: 50, roleInProject: "Lead" },
        ],
      }).success
    ).toBe(false);
  });
});

describe("recommendation query validation", () => {
  it("applies defaults", () => {
    const parsed = recommendationQuerySchema.parse({});
    expect(parsed.limit).toBe(25);
    expect(parsed.forceLocal).toBe(false);
  });

  it("coerces numeric strings and rejects out-of-range scores", () => {
    expect(recommendationQuerySchema.parse({ minScore: "70" }).minScore).toBe(70);
    expect(recommendationQuerySchema.safeParse({ minScore: 101 }).success).toBe(false);
    expect(recommendationQuerySchema.parse({ forceLocal: "true" }).forceLocal).toBe(true);
  });
});

describe("skill and settings validation", () => {
  it("rejects an unknown skill category", () => {
    expect(createSkillSchema.safeParse({ name: "Rust", category: "Programming" }).success).toBe(
      true
    );
    expect(createSkillSchema.safeParse({ name: "Rust", category: "Sorcery" }).success).toBe(
      false
    );
  });

  it("requires matching weights to total 1.00", () => {
    expect(
      matchingWeightsSchema.safeParse({
        skillMatch: 0.45,
        experience: 0.15,
        availability: 0.15,
        workload: 0.15,
        roleSuitability: 0.1,
      }).success
    ).toBe(true);
    expect(
      matchingWeightsSchema.safeParse({
        skillMatch: 0.9,
        experience: 0.15,
        availability: 0.15,
        workload: 0.15,
        roleSuitability: 0.1,
      }).success
    ).toBe(false);
  });

  it("accepts a partial settings update", () => {
    expect(updateSettingsSchema.safeParse({ deadlineWarningDays: 21 }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ deadlineWarningDays: 0 }).success).toBe(false);
  });
});

describe("query injection defences", () => {
  it("escapes regex metacharacters in user input", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegex("(test)")).toBe("\\(test\\)");
  });

  it("builds an OR filter only when a term is present", () => {
    expect(searchFilter("  ", ["name"])).toEqual({});
    const filter = searchFilter("ali", ["name", "email"]);
    expect(Array.isArray(filter.$or)).toBe(true);
    expect((filter.$or as unknown[]).length).toBe(2);
  });

  it("never accepts an arbitrary sort field", () => {
    const allowed: Record<string, "name" | "createdAt"> = {
      name: "name",
      createdAt: "createdAt",
    };
    expect(resolveSort("name", allowed, "createdAt")).toEqual({ name: -1 });
    // An unknown field falls back to the default instead of reaching MongoDB.
    expect(resolveSort("$where", allowed, "createdAt")).toEqual({ createdAt: -1 });
    expect(resolveSort(undefined, allowed, "createdAt", "asc")).toEqual({ createdAt: 1 });
  });
});
