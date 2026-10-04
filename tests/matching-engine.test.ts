import { describe, expect, it } from "vitest";
import {
  clamp,
  computeAvailabilityScore,
  computeExperienceScore,
  computeRoleSuitabilityScore,
  computeSkillMatch,
  computeWorkloadScore,
  fairShareAllocation,
  gradeFor,
  matchEmployee,
  rankEmployees,
  round1,
  skillCoverageStatus,
  skillCoverageValue,
  utilizationBand,
  weightedOverall,
} from "@/lib/matching/engine";
import {
  FAIR_SHARE_MAX,
  FAIR_SHARE_MIN,
  TIGHT_DEADLINE_EXPERIENCE_MULTIPLIER,
} from "@/lib/matching/constants";
import { MATCH_WEIGHTS } from "@/types/matching";
import { computeTeamCoverage } from "@/lib/matching/team";
import type {
  EmployeeMatchInput,
  EmployeeSkillInput,
  ProjectMatchInput,
  SkillRequirementInput,
} from "@/types/matching";

/**
 * Unit tests for the matching engine.
 *
 * The engine is pure (no database, no network), so every rule below is
 * asserted directly. These tests are the executable specification of the
 * System Matching Score.
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

function requirement(
  id: string,
  name: string,
  requiredProficiency: number,
  importance: SkillRequirementInput["importance"] = "REQUIRED",
  category: SkillRequirementInput["category"] = "Programming"
): SkillRequirementInput {
  return { skillId: id, skillName: name, category, requiredProficiency, importance };
}

function employee(overrides: Partial<EmployeeMatchInput> = {}): EmployeeMatchInput {
  return {
    employeeId: "e1",
    name: "Test Employee",
    jobRole: "BACKEND_DEVELOPER",
    status: "ACTIVE",
    yearsOfExperience: 5,
    availabilityPercent: 100,
    currentWorkloadPercent: 0,
    skills: [],
    calendarAvailabilityPercent: null,
    ...overrides,
  };
}

function project(overrides: Partial<ProjectMatchInput> = {}): ProjectMatchInput {
  return {
    projectId: "p1",
    name: "Test Project",
    requiredTeamSize: 4,
    requiredExperienceYears: 3,
    daysUntilDeadline: 90,
    requirements: [],
    preferredRoles: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

describe("primitives", () => {
  it("clamps values into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("rounds to one decimal place", () => {
    expect(round1(3.14159)).toBe(3.1);
    expect(round1(3.15)).toBe(3.2);
    expect(round1(4)).toBe(4);
  });

  it("bands utilisation using the documented thresholds", () => {
    expect(utilizationBand(0)).toBe("AVAILABLE");
    expect(utilizationBand(60)).toBe("AVAILABLE");
    expect(utilizationBand(61)).toBe("MODERATE");
    expect(utilizationBand(80)).toBe("MODERATE");
    expect(utilizationBand(81)).toBe("HIGH");
    expect(utilizationBand(100)).toBe("HIGH");
    expect(utilizationBand(101)).toBe("OVERALLOCATED");
    expect(utilizationBand(150)).toBe("OVERALLOCATED");
  });

  it("computes the weighted total from the components", () => {
    const total = weightedOverall({
      skillMatch: 100,
      experience: 100,
      availability: 100,
      workload: 100,
      roleSuitability: 100,
    });
    expect(total).toBe(100);
  });

  it("keeps the documented weight split", () => {
    expect(MATCH_WEIGHTS).toEqual({
      skillMatch: 0.45,
      experience: 0.15,
      availability: 0.15,
      workload: 0.15,
      roleSuitability: 0.1,
    });
    const sum = Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("grades scores consistently", () => {
    expect(gradeFor(90)).toBe("STRONG");
    expect(gradeFor(85)).toBe("STRONG");
    expect(gradeFor(75)).toBe("GOOD");
    expect(gradeFor(60)).toBe("FAIR");
    expect(gradeFor(20)).toBe("WEAK");
  });

  it("derives a fair-share allocation inside the clamped range", () => {
    expect(fairShareAllocation(1)).toBeLessThanOrEqual(FAIR_SHARE_MAX);
    expect(fairShareAllocation(100)).toBeGreaterThanOrEqual(FAIR_SHARE_MIN);
    // A bigger team means a smaller share.
    expect(fairShareAllocation(8)).toBeLessThan(fairShareAllocation(2));
  });
});

/* ------------------------------------------------------------------ */
/* Skill matching                                                      */
/* ------------------------------------------------------------------ */

describe("computeSkillMatch", () => {
  it("scores 100 when every required skill is exceeded", () => {
    const { score, breakdown } = computeSkillMatch(
      [requirement("s1", "Python", 4), requirement("s2", "SQL", 3)],
      [skill("s1", "Python", 5), skill("s2", "SQL", 4)]
    );
    expect(score).toBe(100);
    expect(breakdown.every((item) => item.coverage === 1)).toBe(true);
  });

  it("treats meeting the required level as full coverage", () => {
    const { score, breakdown } = computeSkillMatch(
      [requirement("s1", "Python", 4)],
      [skill("s1", "Python", 4)]
    );
    expect(score).toBe(100);
    expect(breakdown[0].status).toBe("meets");
  });

  it("penalises proficiency below the requirement proportionally", () => {
    const { score } = computeSkillMatch(
      [requirement("s1", "Python", 4)],
      [skill("s1", "Python", 2)]
    );
    expect(score).toBe(50);
  });

  it("scores a missing skill as zero", () => {
    const { score, breakdown } = computeSkillMatch(
      [requirement("s1", "Python", 4)],
      []
    );
    expect(score).toBe(0);
    expect(breakdown[0].status).toBe("missing");
    expect(breakdown[0].actualProficiency).toBeNull();
  });

  it("halves the influence of optional skills relative to required ones", () => {
    // Two requirements, each met or missed in opposite directions. Because the
    // optional one only counts for half, meeting the REQUIRED skill matters
    // roughly twice as much.
    const optionalMatters = computeSkillMatch(
      [
        requirement("s1", "Python", 4),
        requirement("s2", "Docker", 4, "OPTIONAL"),
      ],
      [skill("s1", "Python", 5)]
    ).score;
    const requiredMatters = computeSkillMatch(
      [
        requirement("s1", "Python", 4),
        requirement("s2", "Docker", 4, "OPTIONAL"),
      ],
      [skill("s2", "Docker", 5)]
    ).score;

    expect(optionalMatters).toBeCloseTo(66.7, 1);
    expect(requiredMatters).toBeCloseTo(33.3, 1);
    expect(optionalMatters).toBeGreaterThan(requiredMatters);
  });

  it("mixes matched and unmatched skills", () => {
    const { score } = computeSkillMatch(
      [requirement("s1", "Python", 4), requirement("s2", "Go", 3)],
      [skill("s1", "Python", 5)]
    );
    expect(score).toBe(50);
  });

  it("is neutral when the project has no requirements", () => {
    const { score, breakdown } = computeSkillMatch([], [skill("s1", "Python", 5)]);
    expect(score).toBe(100);
    expect(breakdown).toHaveLength(0);
  });

  it("classifies coverage status at each boundary", () => {
    expect(skillCoverageStatus(null, 4)).toBe("missing");
    expect(skillCoverageStatus(5, 4)).toBe("strong");
    expect(skillCoverageStatus(4, 4)).toBe("meets");
    expect(skillCoverageStatus(3, 5)).toBe("partial");
    expect(skillCoverageStatus(2, 5)).toBe("gap");

    expect(skillCoverageValue(5, 4)).toBe(1);
    expect(skillCoverageValue(2, 4)).toBe(0.5);
    expect(skillCoverageValue(null, 4)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Experience                                                         */
/* ------------------------------------------------------------------ */

describe("computeExperienceScore", () => {
  it("scores full marks at or above the requirement", () => {
    expect(computeExperienceScore(5, 3, 90).score).toBe(100);
    expect(computeExperienceScore(3, 3, 90).score).toBe(100);
  });

  it("scales down below the requirement", () => {
    const result = computeExperienceScore(0, 4, 90);
    expect(result.score).toBe(0);
    expect(result.score).toBeLessThan(100);
  });

  it("raises the expectation for a tight deadline", () => {
    const loose = computeExperienceScore(3, 3, 90);
    const tight = computeExperienceScore(3, 3, 5);
    expect(tight.effectiveRequiredYears).toBeCloseTo(
      3 * TIGHT_DEADLINE_EXPERIENCE_MULTIPLIER,
      5
    );
    expect(tight.effectiveRequiredYears).toBeGreaterThan(
      loose.effectiveRequiredYears
    );
    expect(tight.tightDeadline).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Availability & workload                                            */
/* ------------------------------------------------------------------ */

describe("computeAvailabilityScore", () => {
  it("uses the declared percentage when no calendar is connected", () => {
    expect(computeAvailabilityScore(80, null).effectivePercent).toBe(80);
    expect(computeAvailabilityScore(80, null).score).toBe(80);
  });

  it("averages the declared and calendar figures when a calendar is connected", () => {
    // 100% declared but only 40% free on the calendar -> 70% effective.
    const result = computeAvailabilityScore(100, 40);
    expect(result.effectivePercent).toBe(70);
    expect(result.score).toBe(70);
  });

  it("scores proportionally and clamps at the extremes", () => {
    expect(computeAvailabilityScore(50, null).score).toBe(50);
    expect(computeAvailabilityScore(100, null).score).toBe(100);
    expect(computeAvailabilityScore(0, null).score).toBe(0);
    expect(computeAvailabilityScore(150, null).score).toBe(100);
  });
});

describe("computeWorkloadScore", () => {
  it("reports the projected total including the fair share", () => {
    const result = computeWorkloadScore(50, 25);
    expect(result.projected).toBe(75);
  });

  it("penalises a high current workload", () => {
    expect(computeWorkloadScore(0, 25).score).toBe(100);
    expect(computeWorkloadScore(130, 25).score).toBe(0);
  });

  it("never goes below zero", () => {
    expect(computeWorkloadScore(200, 25).score).toBeGreaterThanOrEqual(0);
  });
});

/* ------------------------------------------------------------------ */
/* Role suitability                                                   */
/* ------------------------------------------------------------------ */

describe("computeRoleSuitabilityScore", () => {
  it("scores full marks when the role is explicitly preferred", () => {
    expect(computeRoleSuitabilityScore("BACKEND_DEVELOPER", [], ["BACKEND_DEVELOPER"])).toBe(100);
  });

  it("penalises a role that is not preferred", () => {
    const score = computeRoleSuitabilityScore("UI_UX_DESIGNER", [], [
      "BACKEND_DEVELOPER",
    ]);
    expect(score).toBeLessThan(100);
  });

  it("falls back to category affinity when no role is preferred", () => {
    const matched = computeRoleSuitabilityScore(
      "BACKEND_DEVELOPER",
      [requirement("s1", "Python", 3)],
      []
    );
    const mismatched = computeRoleSuitabilityScore(
      "UI_UX_DESIGNER",
      [requirement("s1", "Python", 3)],
      []
    );
    expect(matched).toBeGreaterThan(mismatched);
  });
});
/* ------------------------------------------------------------------ */
/* End-to-end scoring                                                  */
/* ------------------------------------------------------------------ */

describe("matchEmployee", () => {
  const bankingProject = project({
    requiredTeamSize: 4,
    requiredExperienceYears: 4,
    daysUntilDeadline: 90,
    requirements: [
      requirement("s-python", "Python", 4),
      requirement("s-sql", "SQL", 4),
      requirement("s-react", "React", 3),
      requirement("s-docker", "Docker", 3, "OPTIONAL"),
    ],
  });

  it("returns a fully auditable result", () => {
    const result = matchEmployee(
      employee({
        skills: [
          skill("s-python", "Python", 5),
          skill("s-sql", "SQL", 5),
          skill("s-react", "React", 3),
        ],
      }),
      bankingProject
    );

    // 3 of 3 required skills covered, the optional one is missing.
    expect(result.requiredSkillsCovered).toBe(3);
    expect(result.requiredSkillsTotal).toBe(3);
    expect(result.missingSkillIds).toContain("s-docker");
    expect(result.skillBreakdown).toHaveLength(4);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.engine).toBe("typescript");
  });

  it("keeps the score inside 0-100 for every input", () => {
    const cases = [
      employee({ skills: [], yearsOfExperience: 0, availabilityPercent: 0, currentWorkloadPercent: 200 }),
      employee({
        skills: [
          skill("s-python", "Python", 5),
          skill("s-sql", "SQL", 5),
          skill("s-react", "React", 5),
          skill("s-docker", "Docker", 5),
        ],
        yearsOfExperience: 30,
        availabilityPercent: 100,
        currentWorkloadPercent: 0,
      }),
    ];
    for (const candidate of cases) {
      const result = matchEmployee(candidate, bankingProject);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    }
  });

  it("scores a strong candidate above a weak one", () => {
    const strong = matchEmployee(
      employee({
        skills: [
          skill("s-python", "Python", 5),
          skill("s-sql", "SQL", 5),
          skill("s-react", "React", 4),
          skill("s-docker", "Docker", 4),
        ],
        yearsOfExperience: 8,
        availabilityPercent: 90,
        currentWorkloadPercent: 10,
      }),
      bankingProject
    );
    const weak = matchEmployee(
      employee({
        skills: [skill("s-python", "Python", 1)],
        yearsOfExperience: 1,
        availabilityPercent: 20,
        currentWorkloadPercent: 90,
      }),
      bankingProject
    );

    expect(strong.overallScore).toBeGreaterThan(weak.overallScore);
    expect(strong.grade).not.toBe("WEAK");
  });

  it("penalises an already overallocated employee", () => {
    const free = matchEmployee(employee({ currentWorkloadPercent: 0 }), bankingProject);
    const busy = matchEmployee(employee({ currentWorkloadPercent: 120 }), bankingProject);
    expect(busy.components.workload).toBeLessThan(free.components.workload);
    expect(
      busy.warnings.some((warning) => warning.includes("overallocated"))
    ).toBe(true);
  });

  it("warns when the project has no required skills configured", () => {
    const result = matchEmployee(employee(), project());
    expect(result.warnings.some((w) => w.includes("no skill requirements"))).toBe(true);
  });

  it("flags an employee on leave", () => {
    const result = matchEmployee(
      employee({ status: "ON_LEAVE" }),
      bankingProject
    );
    expect(result.warnings.some((w) => w.includes("on leave"))).toBe(true);
  });

  it("adjusts availability when a calendar is connected", () => {
    const without = matchEmployee(
      employee({ availabilityPercent: 100 }),
      bankingProject
    );
    const withCalendar = matchEmployee(
      employee({ availabilityPercent: 100, calendarAvailabilityPercent: 20 }),
      bankingProject
    );
    expect(withCalendar.components.availability).toBeLessThan(
      without.components.availability
    );
  });

  it("rewards a preferred job role", () => {
    const preferred = project({
      requirements: bankingProject.requirements,
      requiredTeamSize: 4,
      preferredRoles: ["FRONTEND_DEVELOPER"],
    });
    const frontend = matchEmployee(
      employee({ jobRole: "FRONTEND_DEVELOPER" }),
      preferred
    );
    const qa = matchEmployee(employee({ jobRole: "QA_ENGINEER" }), preferred);
    expect(frontend.components.roleSuitability).toBeGreaterThan(
      qa.components.roleSuitability
    );
  });

  it("is deterministic for identical inputs", () => {
    const candidate = employee({
      skills: [skill("s-python", "Python", 4), skill("s-sql", "SQL", 3)],
    });
    expect(matchEmployee(candidate, bankingProject)).toEqual(
      matchEmployee(candidate, bankingProject)
    );
  });
});

describe("rankEmployees", () => {
  const requirements = [requirement("s1", "Python", 4)];

  it("sorts best first", () => {
    const ranked = rankEmployees(
      [
        employee({ employeeId: "weak", skills: [skill("s1", "Python", 1)] }),
        employee({
          employeeId: "strong",
          skills: [skill("s1", "Python", 5)],
          currentWorkloadPercent: 0,
        }),
        employee({ employeeId: "middle", skills: [skill("s1", "Python", 4)] }),
      ],
      project({ requirements, requiredTeamSize: 4 })
    );

    expect(ranked.map((r) => r.employeeId)).toEqual(["strong", "middle", "weak"]);
    expect(ranked[0].overallScore).toBeGreaterThanOrEqual(ranked[1].overallScore);
    expect(ranked[1].overallScore).toBeGreaterThanOrEqual(ranked[2].overallScore);
  });

  it("breaks ties by skill match then name", () => {
    const ranked = rankEmployees(
      [
        employee({ employeeId: "b", name: "Bob", skills: [skill("s1", "Python", 4)] }),
        employee({ employeeId: "a", name: "Alice", skills: [skill("s1", "Python", 4)] }),
      ],
      project({ requirements, requiredTeamSize: 4 })
    );
    expect(ranked.map((r) => r.employeeName)).toEqual(["Alice", "Bob"]);
  });

  it("returns an empty list for no candidates", () => {
    expect(rankEmployees([], project({ requirements }))).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Team coverage                                                       */
/* ------------------------------------------------------------------ */

describe("computeTeamCoverage", () => {
  const requirements = [
    requirement("s1", "Python", 4),
    requirement("s2", "Docker", 3),
    requirement("s3", "Kubernetes", 3, "OPTIONAL"),
  ];

  it("reports full coverage when the team meets every requirement", () => {
    const coverage = computeTeamCoverage(requirements, [
      employee({ skills: [skill("s1", "Python", 5), skill("s2", "Docker", 4), skill("s3", "Kubernetes", 3)] }),
    ]);

    expect(coverage.overallCoveragePercent).toBe(100);
    expect(coverage.gaps).toHaveLength(0);
    expect(coverage.requiredSkillsCovered).toBe(2);
    expect(coverage.requiredSkillsTotal).toBe(2);
  });

  it("lists the missing skills in ascending coverage order", () => {
    const coverage = computeTeamCoverage(requirements, [
      employee({ skills: [skill("s2", "Docker", 4)] }),
    ]);

    expect(coverage.gaps).toHaveLength(2);
    expect(coverage.gaps.map((gap) => gap.skillName).sort()).toEqual([
      "Kubernetes",
      "Python",
    ]);
    // Sorted worst-first so the biggest problem appears at the top.
    expect(coverage.gaps[0].coveragePercent).toBeLessThanOrEqual(
      coverage.gaps[1].coveragePercent
    );
    expect(coverage.skills.find((s) => s.skillName === "Docker")?.covered).toBe(true);
  });

  it("uses the best member in the team for each skill", () => {
    const coverage = computeTeamCoverage(
      [requirement("s1", "Python", 4)],
      [
        employee({ employeeId: "a", name: "A", skills: [skill("s1", "Python", 2)] }),
        employee({ employeeId: "b", name: "B", skills: [skill("s1", "Python", 5)] }),
      ]
    );

    const python = coverage.skills[0];
    expect(python.bestProficiency).toBe(5);
    expect(python.bestEmployeeName).toBe("B");
    expect(python.coveragePercent).toBe(100);
  });

  it("summarises experience, workload and availability", () => {
    const coverage = computeTeamCoverage(requirements, [
      employee({
        yearsOfExperience: 4,
        currentWorkloadPercent: 50,
        availabilityPercent: 80,
        skills: [skill("s1", "Python", 4)],
      }),
      employee({
        yearsOfExperience: 8,
        currentWorkloadPercent: 30,
        availabilityPercent: 60,
        skills: [skill("s2", "Docker", 3)],
      }),
    ]);

    expect(coverage.memberCount).toBe(2);
    expect(coverage.averageExperienceYears).toBe(6);
    expect(coverage.totalWorkloadPercent).toBe(80);
    expect(coverage.averageAvailabilityPercent).toBe(70);
  });

  it("returns zero coverage for an empty team", () => {
    const coverage = computeTeamCoverage(requirements, []);
    expect(coverage.memberCount).toBe(0);
    expect(coverage.overallCoveragePercent).toBe(0);
    expect(coverage.gaps).toHaveLength(3);
  });

  it("returns zero coverage when the project has no requirements", () => {
    const coverage = computeTeamCoverage([], [employee()]);
    expect(coverage.overallCoveragePercent).toBe(0);
    expect(coverage.gaps).toHaveLength(0);
  });
});
