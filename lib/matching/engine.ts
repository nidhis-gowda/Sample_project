import {
  MATCH_WEIGHTS,
  type EmployeeMatchInput,
  type EmployeeSkillInput,
  type MatchComponentKey,
  type MatchResult,
  type ProjectMatchInput,
  type SkillBreakdown,
  type SkillCoverageStatus,
  type SkillRequirementInput,
} from "@/types/matching";
import type { UtilizationBand } from "@/types";
import {
  FAIR_SHARE_MAX,
  FAIR_SHARE_MIN,
  GRADE_THRESHOLDS,
  OPTIONAL_SKILL_WEIGHT,
  PROJECTED_WORKLOAD_RANGE,
  PROJECTED_WORKLOAD_ZERO_POINT,
  ROLE_AFFINITY_WEIGHT,
  ROLE_PREFERENCE_WEIGHT,
  ROLE_FAMILIES,
  ROLE_SKILL_AFFINITY,
  TIGHT_DEADLINE_DAYS,
  TIGHT_DEADLINE_EXPERIENCE_MULTIPLIER,
  UTILIZATION_THRESHOLDS,
} from "./constants";

/* ------------------------------------------------------------------ */
/* Small numeric helpers                                               */
/* ------------------------------------------------------------------ */

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Round to a single decimal place (scores such as 91.4). */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Map a total allocation percentage to a utilization band. */
export function utilizationBand(totalAllocation: number): UtilizationBand {
  if (totalAllocation <= UTILIZATION_THRESHOLDS.available) return "AVAILABLE";
  if (totalAllocation <= UTILIZATION_THRESHOLDS.moderate) return "MODERATE";
  if (totalAllocation <= UTILIZATION_THRESHOLDS.high) return "HIGH";
  return "OVERALLOCATED";
}

/**
 * Percentage of a project's capacity one additional team member is expected to
 * take on. Used to estimate the workload impact of a new allocation.
 */
export function fairShareAllocation(requiredTeamSize: number): number {
  const teamSize = Math.max(1, Math.round(requiredTeamSize || 1));
  return clamp(Math.round(100 / teamSize), FAIR_SHARE_MIN, FAIR_SHARE_MAX);
}

/* ------------------------------------------------------------------ */
/* 1. Skill match (weight 45%)                                         */
/* ------------------------------------------------------------------ */

export function skillCoverageStatus(
  actual: number | null,
  required: number
): SkillCoverageStatus {
  if (actual === null || actual === undefined) return "missing";
  if (required <= 0) return actual > 0 ? "strong" : "gap";
  const ratio = actual / required;
  if (ratio > 1) return "strong";
  if (ratio === 1) return "meets";
  if (ratio >= 0.6) return "partial";
  return "gap";
}

export function skillCoverageValue(actual: number | null, required: number): number {
  if (actual === null || actual === undefined) return 0;
  if (required <= 0) return 1;
  return clamp(actual / required, 0, 1);
}

function explainSkill(breakdown: {
  skillName: string;
  requiredProficiency: number;
  actualProficiency: number | null;
  status: SkillCoverageStatus;
}): string {
  const { skillName, requiredProficiency, actualProficiency, status } = breakdown;
  switch (status) {
    case "strong":
      return `${skillName}: level ${actualProficiency} exceeds the required level ${requiredProficiency}.`;
    case "meets":
      return `${skillName}: level ${actualProficiency} exactly meets the requirement.`;
    case "partial":
      return `${skillName}: level ${actualProficiency} is close to the required level ${requiredProficiency} but below it.`;
    case "gap":
      return `${skillName}: level ${actualProficiency} is well below the required level ${requiredProficiency}.`;
    default:
      return `${skillName}: skill is missing (required level ${requiredProficiency}).`;
  }
}

export function computeSkillMatch(
  requirements: SkillRequirementInput[],
  employeeSkills: EmployeeSkillInput[]
): { score: number; breakdown: SkillBreakdown[] } {
  const byId = new Map(employeeSkills.map((s) => [s.skillId, s]));

  const breakdown: SkillBreakdown[] = requirements.map((req) => {
    const match = byId.get(req.skillId);
    const actual = match ? match.proficiency : null;
    const status = skillCoverageStatus(actual, req.requiredProficiency);
    return {
      skillId: req.skillId,
      skillName: req.skillName,
      category: req.category,
      importance: req.importance,
      requiredProficiency: req.requiredProficiency,
      actualProficiency: actual,
      yearsOfExperience: match?.yearsOfExperience ?? 0,
      coverage: skillCoverageValue(actual, req.requiredProficiency),
      status,
      explanation: explainSkill({
        skillName: req.skillName,
        requiredProficiency: req.requiredProficiency,
        actualProficiency: actual,
        status,
      }),
    };
  });

  if (breakdown.length === 0) {
    // No requirements defined — stay neutral instead of rewarding everybody.
    return { score: 100, breakdown };
  }

  let weighted = 0;
  let weightSum = 0;
  for (const item of breakdown) {
    const weight = item.importance === "REQUIRED" ? 1 : OPTIONAL_SKILL_WEIGHT;
    weighted += item.coverage * weight;
    weightSum += weight;
  }

  return {
    score: round1(weightSum === 0 ? 0 : (weighted / weightSum) * 100),
    breakdown,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Experience (weight 15%)                                          */
/* ------------------------------------------------------------------ */

export function computeExperienceScore(
  employeeYears: number,
  projectRequiredYears: number,
  daysUntilDeadline: number
): { score: number; effectiveRequiredYears: number; tightDeadline: boolean } {
  const tightDeadline = daysUntilDeadline <= TIGHT_DEADLINE_DAYS;
  const multiplier = tightDeadline ? TIGHT_DEADLINE_EXPERIENCE_MULTIPLIER : 1;
  // Never demand less than one year so the ratio stays meaningful.
  const effectiveRequiredYears = Math.max(1, projectRequiredYears * multiplier);

  const score = round1(clamp(employeeYears / effectiveRequiredYears, 0, 1) * 100);
  return { score, effectiveRequiredYears, tightDeadline };
}

/* ------------------------------------------------------------------ */
/* 3. Availability (weight 15%)                                        */
/* ------------------------------------------------------------------ */

/**
 * Calendar availability (when the employee connected Google Calendar) is the
 * more accurate signal, but the manually declared value is still respected: the
 * two are averaged.
 */
export function computeAvailabilityScore(
  declaredPercent: number,
  calendarPercent?: number | null
): { score: number; effectivePercent: number } {
  const declared = clamp(declaredPercent, 0, 100);
  if (calendarPercent === null || calendarPercent === undefined) {
    return { score: round1(declared), effectivePercent: declared };
  }
  const calendar = clamp(calendarPercent, 0, 100);
  const effective = Math.round((declared + calendar) / 2);
  return { score: round1(effective), effectivePercent: effective };
}

/* ------------------------------------------------------------------ */
/* 4. Workload (weight 15%)                                            */
/* ------------------------------------------------------------------ */

export function computeWorkloadScore(
  currentWorkloadPercent: number,
  fairShare: number
): { score: number; projected: number } {
  const current = Math.max(0, currentWorkloadPercent);
  const projected = Math.round((current + fairShare) * 10) / 10;
  const score = round1(
    clamp(
      (PROJECTED_WORKLOAD_ZERO_POINT - projected) / PROJECTED_WORKLOAD_RANGE,
      0,
      1
    ) * 100
  );
  return { score, projected };
}

/* ------------------------------------------------------------------ */
/* 5. Role suitability (weight 10%)                                    */
/* ------------------------------------------------------------------ */

export function computeRoleSuitabilityScore(
  employeeRole: keyof typeof ROLE_FAMILIES,
  requirements: SkillRequirementInput[],
  preferredRoles?: string[]
): number {
  /* a) explicit role preference expressed on the project */
  const preferred = preferredRoles?.filter(Boolean) ?? [];
  let preferenceScore: number;
  if (preferred.length === 0) {
    preferenceScore = 100; // neutral - no explicit preference configured
  } else if (preferred.includes(employeeRole)) {
    preferenceScore = 100;
  } else if (
    preferred.some(
      (role) =>
        ROLE_FAMILIES[role as keyof typeof ROLE_FAMILIES] === ROLE_FAMILIES[employeeRole]
    )
  ) {
    preferenceScore = 70;
  } else {
    preferenceScore = 35;
  }

  /* b) how well the employee's role covers the required skill categories */
  let affinityScore = 100;
  if (requirements.length > 0) {
    const affinities = ROLE_SKILL_AFFINITY[employeeRole] ?? [];
    const covered = requirements.filter((r) => affinities.includes(r.category)).length;
    affinityScore = round1((covered / requirements.length) * 100);
  }

  return round1(
    preferenceScore * ROLE_PREFERENCE_WEIGHT + affinityScore * ROLE_AFFINITY_WEIGHT
  );
}

/* ------------------------------------------------------------------ */
/* Overall scoring                                                     */
/* ------------------------------------------------------------------ */

export function gradeFor(overallScore: number): MatchResult["grade"] {
  if (overallScore >= GRADE_THRESHOLDS.strong) return "STRONG";
  if (overallScore >= GRADE_THRESHOLDS.good) return "GOOD";
  if (overallScore >= GRADE_THRESHOLDS.fair) return "FAIR";
  return "WEAK";
}

export function weightedOverall(components: Record<MatchComponentKey, number>): number {
  let total = 0;
  for (const key of Object.keys(MATCH_WEIGHTS) as MatchComponentKey[]) {
    total += components[key] * MATCH_WEIGHTS[key];
  }
  return round1(total);
}

/**
 * THE matching engine.
 *
 * Returns a *System Matching Score* (0-100) together with a full, auditable
 * breakdown so that a project manager can see exactly why an employee was
 * recommended.
 */
export function matchEmployee(
  employee: EmployeeMatchInput,
  project: ProjectMatchInput
): MatchResult {
  const { score: skillScore, breakdown } = computeSkillMatch(
    project.requirements,
    employee.skills
  );

  const experience = computeExperienceScore(
    employee.yearsOfExperience,
    project.requiredExperienceYears,
    project.daysUntilDeadline
  );

  const availability = computeAvailabilityScore(
    employee.availabilityPercent,
    employee.calendarAvailabilityPercent ?? null
  );

  const fairShare = fairShareAllocation(project.requiredTeamSize);
  const workload = computeWorkloadScore(employee.currentWorkloadPercent, fairShare);

  const roleScore = computeRoleSuitabilityScore(
    employee.jobRole,
    project.requirements,
    project.preferredRoles
  );

  const components: Record<MatchComponentKey, number> = {
    skillMatch: skillScore,
    experience: experience.score,
    availability: availability.score,
    workload: workload.score,
    roleSuitability: roleScore,
  };

  const overallScore = weightedOverall(components);

  const requiredItems = breakdown.filter((b) => b.importance === "REQUIRED");
  const matchedSkillIds = breakdown
    .filter((b) => b.status === "strong" || b.status === "meets")
    .map((b) => b.skillId);
  const partialSkillIds = breakdown
    .filter((b) => b.status === "partial")
    .map((b) => b.skillId);
  const missingSkillIds = breakdown
    .filter((b) => b.status === "missing" || b.status === "gap")
    .map((b) => b.skillId);

  return {
    employeeId: employee.employeeId,
    employeeName: employee.name,
    jobRole: employee.jobRole,
    overallScore,
    components,
    weights: MATCH_WEIGHTS,
    skillBreakdown: breakdown,
    matchedSkillIds,
    missingSkillIds,
    partialSkillIds,
    requiredSkillsCovered: requiredItems.filter(
      (b) => b.status === "strong" || b.status === "meets"
    ).length,
    requiredSkillsTotal: requiredItems.length,
    projectedWorkloadPercent: workload.projected,
    fairShareAllocationPercent: fairShare,
    reasons: buildReasons(employee, project, breakdown, {
      availabilityPercent: availability.effectivePercent,
      projectedWorkload: workload.projected,
      roleScore,
      effectiveRequiredYears: experience.effectiveRequiredYears,
    }),
    warnings: buildWarnings(employee, project, breakdown, {
      projectedWorkload: workload.projected,
      effectiveRequiredYears: experience.effectiveRequiredYears,
    }),
    grade: gradeFor(overallScore),
    engine: "typescript",
  };
}

/** Score every candidate and return them ranked best-first. */
export function rankEmployees(
  employees: EmployeeMatchInput[],
  project: ProjectMatchInput
): MatchResult[] {
  return employees
    .map((employee) => matchEmployee(employee, project))
    .sort(
      (a, b) =>
        b.overallScore - a.overallScore ||
        b.components.skillMatch - a.components.skillMatch ||
        a.employeeName.localeCompare(b.employeeName)
    );
}

/* ------------------------------------------------------------------ */
/* Human readable explanations                                         */
/* ------------------------------------------------------------------ */

interface ReasonContext {
  availabilityPercent: number;
  projectedWorkload: number;
  roleScore: number;
  effectiveRequiredYears: number;
}

interface WarningContext {
  projectedWorkload: number;
  effectiveRequiredYears: number;
}

function prettyRole(role: string): string {
  return role.replace(/_/g, " ").toLowerCase();
}

function buildReasons(
  employee: EmployeeMatchInput,
  project: ProjectMatchInput,
  breakdown: SkillBreakdown[],
  ctx: ReasonContext
): string[] {
  const reasons: string[] = [];

  for (const item of breakdown) {
    if (item.status === "strong") {
      reasons.push(
        `Strong ${item.skillName} experience (level ${item.actualProficiency}/5, required ${item.requiredProficiency}/5).`
      );
    } else if (item.status === "meets") {
      reasons.push(
        `Meets the required ${item.skillName} level (${item.requiredProficiency}/5).`
      );
    }
  }

  if (ctx.availabilityPercent > 0) {
    const calendarAdjusted =
      employee.calendarAvailabilityPercent !== null &&
      employee.calendarAvailabilityPercent !== undefined;
    reasons.push(
      `${ctx.availabilityPercent}% availability${calendarAdjusted ? " (Google Calendar adjusted)" : ""}.`
    );
  }

  if (ctx.projectedWorkload <= UTILIZATION_THRESHOLDS.available) {
    reasons.push(
      `Low workload impact — projected total of ${ctx.projectedWorkload}% after allocation.`
    );
  }

  if (ctx.roleScore >= 90) {
    reasons.push(`Role suitability is high for a ${prettyRole(employee.jobRole)}.`);
  }

  if (employee.yearsOfExperience >= ctx.effectiveRequiredYears) {
    reasons.push(
      `${employee.yearsOfExperience} years of experience (project expects ${ctx.effectiveRequiredYears}${project.daysUntilDeadline <= TIGHT_DEADLINE_DAYS ? " for the tight deadline" : ""}).`
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "No single outstanding factor — this is the best overall compromise across all scoring dimensions."
    );
  }

  return reasons;
}

function buildWarnings(
  employee: EmployeeMatchInput,
  project: ProjectMatchInput,
  breakdown: SkillBreakdown[],
  ctx: WarningContext
): string[] {
  const warnings: string[] = [];

  for (const item of breakdown) {
    if (item.status === "partial") {
      warnings.push(
        `${item.skillName} proficiency below requirement (${item.actualProficiency} vs ${item.requiredProficiency} required).`
      );
    } else if (item.status === "gap") {
      warnings.push(
        `${item.skillName} is a significant skill gap (level ${item.actualProficiency ?? 0}/5 vs ${item.requiredProficiency} required).`
      );
    } else if (item.status === "missing") {
      warnings.push(
        `${item.skillName} is missing from this employee's profile (required ${item.requiredProficiency}/5).`
      );
    }
  }

  if (employee.currentWorkloadPercent > UTILIZATION_THRESHOLDS.high) {
    warnings.push(
      `Already overallocated at ${employee.currentWorkloadPercent}% before this allocation.`
    );
  } else if (ctx.projectedWorkload > UTILIZATION_THRESHOLDS.high) {
    warnings.push(
      `Projected workload of ${ctx.projectedWorkload}% exceeds 100% — consider reducing other allocations.`
    );
  }

  if (employee.status === "ON_LEAVE") warnings.push("Employee is currently on leave.");
  if (employee.status === "INACTIVE") warnings.push("Employee account is inactive.");

  if (project.daysUntilDeadline < 0) {
    warnings.push("Project deadline has already passed.");
  } else if (project.daysUntilDeadline <= TIGHT_DEADLINE_DAYS) {
    warnings.push(
      `Tight deadline (${project.daysUntilDeadline} days) — experience expectation raised to ${ctx.effectiveRequiredYears} years.`
    );
  }

  const requiredCount = breakdown.filter((b) => b.importance === "REQUIRED").length;
  if (breakdown.length > 0 && requiredCount === 0) {
    warnings.push("Project has no REQUIRED skills configured — only optional skills scored.");
  }
  if (breakdown.length === 0) {
    warnings.push(
      "Project has no skill requirements yet, so the skill component is neutral for everyone."
    );
  }

  return warnings;
}