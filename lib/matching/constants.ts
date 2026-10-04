import type { JobRole, SkillCategory } from "@/types";

/**
 * Which skill categories a given job role is naturally strong in.
 * Used by the *Role Suitability* component of the matching score.
 */
export const ROLE_SKILL_AFFINITY: Record<JobRole, SkillCategory[]> = {
  PROJECT_MANAGER: ["Management", "Data"],
  TECH_LEAD: [
    "Programming",
    "Backend",
    "Frontend",
    "Database",
    "Cloud",
    "DevOps",
    "Management",
  ],
  BACKEND_DEVELOPER: ["Programming", "Backend", "Database", "Cloud"],
  FRONTEND_DEVELOPER: ["Programming", "Frontend"],
  FULLSTACK_DEVELOPER: ["Programming", "Frontend", "Backend", "Database"],
  MOBILE_DEVELOPER: ["Programming", "Frontend", "Backend"],
  QA_ENGINEER: ["Testing", "Programming"],
  DEVOPS_ENGINEER: ["DevOps", "Cloud", "Security"],
  DATA_ENGINEER: ["Data", "Database", "Programming", "Cloud"],
  SECURITY_ENGINEER: ["Security", "DevOps", "Cloud"],
  UI_UX_DESIGNER: ["Frontend", "Management"],
  BUSINESS_ANALYST: ["Management", "Data"],
};

/** Roles in the same family are considered "related" during matching. */
export const ROLE_FAMILIES: Record<JobRole, string> = {
  PROJECT_MANAGER: "MANAGEMENT",
  BUSINESS_ANALYST: "MANAGEMENT",
  TECH_LEAD: "ENGINEERING",
  BACKEND_DEVELOPER: "ENGINEERING",
  FRONTEND_DEVELOPER: "ENGINEERING",
  FULLSTACK_DEVELOPER: "ENGINEERING",
  MOBILE_DEVELOPER: "ENGINEERING",
  DEVOPS_ENGINEER: "PLATFORM",
  SECURITY_ENGINEER: "PLATFORM",
  DATA_ENGINEER: "DATA",
  QA_ENGINEER: "QUALITY",
  UI_UX_DESIGNER: "DESIGN",
};

/* -------------------- Scoring tuning constants -------------------- */

/** Workload score reaches 0 when the projected total hits this value. */
export const PROJECTED_WORKLOAD_ZERO_POINT = 130;
/** Range over which the workload score decays from 100 to 0. */
export const PROJECTED_WORKLOAD_RANGE = 90;
/** Fair-share allocation is clamped into this range (percent). */
export const FAIR_SHARE_MIN = 10;
export const FAIR_SHARE_MAX = 60;
/** A project deadline closer than this many days tightens experience needs. */
export const TIGHT_DEADLINE_DAYS = 14;
export const TIGHT_DEADLINE_EXPERIENCE_MULTIPLIER = 1.25;
/** Optional skills count for half as much as required skills. */
export const OPTIONAL_SKILL_WEIGHT = 0.5;
/** Role suitability blends explicit role preference with skill-category affinity. */
export const ROLE_PREFERENCE_WEIGHT = 0.6;
export const ROLE_AFFINITY_WEIGHT = 0.4;

/** Utilization thresholds used across the whole application. */
export const UTILIZATION_THRESHOLDS = {
  available: 60, // 0-60  -> AVAILABLE
  moderate: 80, // 61-80 -> MODERATE
  high: 100, // 81-100 -> HIGH
  // > 100 -> OVERALLOCATED
} as const;

export const GRADE_THRESHOLDS = {
  strong: 85,
  good: 70,
  fair: 55,
} as const;