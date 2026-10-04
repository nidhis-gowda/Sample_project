/**
 * Types for the employee ↔ project matching engine.
 *
 * The engine itself (`lib/matching/engine.ts`) is intentionally free of any
 * database, framework or network dependency so that it can be unit tested and
 * mirrored by the optional Python FastAPI service.
 */

import type { JobRole, RequirementImportance, SkillCategory } from "@/types";

export type MatchComponentKey =
  | "skillMatch"
  | "experience"
  | "availability"
  | "workload"
  | "roleSuitability";

/** Weights are expressed as fractions and must sum to 1. */
export const MATCH_WEIGHTS: Record<MatchComponentKey, number> = {
  skillMatch: 0.45,
  experience: 0.15,
  availability: 0.15,
  workload: 0.15,
  roleSuitability: 0.1,
};

export const MATCH_COMPONENT_LABELS: Record<MatchComponentKey, string> = {
  skillMatch: "Skill Match",
  experience: "Experience",
  availability: "Availability",
  workload: "Workload",
  roleSuitability: "Role Suitability",
};

export interface SkillRequirementInput {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  requiredProficiency: number;
  importance: RequirementImportance;
}

export interface EmployeeSkillInput {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  proficiency: number;
  yearsOfExperience: number;
}

export interface EmployeeMatchInput {
  employeeId: string;
  name: string;
  jobRole: JobRole;
  status?: "ACTIVE" | "ON_LEAVE" | "INACTIVE";
  yearsOfExperience: number;
  availabilityPercent: number;
  /** Sum of active allocation percentages, may exceed 100. */
  currentWorkloadPercent: number;
  skills: EmployeeSkillInput[];
  /** Optional calendar derived availability (0-100). */
  calendarAvailabilityPercent?: number | null;
}

export interface ProjectMatchInput {
  projectId: string;
  name: string;
  requiredTeamSize: number;
  requiredExperienceYears: number;
  /** Days until the project deadline (may be negative when overdue). */
  daysUntilDeadline: number;
  requirements: SkillRequirementInput[];
  /** Job roles explicitly requested by the project manager. */
  preferredRoles?: JobRole[];
}

export type SkillCoverageStatus = "strong" | "meets" | "partial" | "gap" | "missing";

export interface SkillBreakdown {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  importance: RequirementImportance;
  requiredProficiency: number;
  /** null when the employee does not have the skill at all. */
  actualProficiency: number | null;
  yearsOfExperience: number;
  /** 0..1 */
  coverage: number;
  status: SkillCoverageStatus;
  explanation: string;
}

export interface MatchResult {
  employeeId: string;
  employeeName: string;
  jobRole: JobRole;
  overallScore: number;
  components: Record<MatchComponentKey, number>;
  weights: Record<MatchComponentKey, number>;
  skillBreakdown: SkillBreakdown[];
  matchedSkillIds: string[];
  missingSkillIds: string[];
  partialSkillIds: string[];
  requiredSkillsCovered: number;
  requiredSkillsTotal: number;
  projectedWorkloadPercent: number;
  fairShareAllocationPercent: number;
  reasons: string[];
  warnings: string[];
  grade: "STRONG" | "GOOD" | "FAIR" | "WEAK";
  /** Which implementation produced this result. */
  engine: "typescript" | "python";
}

export interface TeamCoverageSkill {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  importance: RequirementImportance;
  requiredProficiency: number;
  bestProficiency: number | null;
  bestEmployeeId: string | null;
  bestEmployeeName: string | null;
  coveragePercent: number;
  covered: boolean;
}

export interface TeamCoverageResult {
  overallCoveragePercent: number;
  requiredCoveragePercent: number;
  optionalCoveragePercent: number;
  skills: TeamCoverageSkill[];
  gaps: TeamCoverageSkill[];
  requiredSkillsTotal: number;
  requiredSkillsCovered: number;
  averageExperienceYears: number;
  totalWorkloadPercent: number;
  averageAvailabilityPercent: number;
  memberCount: number;
}

export interface SkillGapReport {
  projectId: string;
  projectName: string;
  gaps: TeamCoverageSkill[];
  coverage: TeamCoverageResult;
}

export interface RecommendationQuery {
  minScore?: number;
  departmentId?: string;
  jobRole?: string;
  skillId?: string;
  minAvailability?: number;
  minExperience?: number;
  maxWorkload?: number;
  limit?: number;
  /** Force the TypeScript engine even when the Python service is configured. */
  forceLocal?: boolean;
}
