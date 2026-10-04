import type {
  AllocationStatus,
  EmployeeStatus,
  ProjectPriority,
  ProjectStatus,
  UtilizationBand,
} from "@/types";

const NEUTRAL = "badge-neutral";
const BRAND = "badge-brand";
const SUCCESS = "badge-success";
const WARNING = "badge-warning";
const DANGER = "badge-danger";
const INFO = "badge-info";

/** Tailwind class for each project status badge. */
export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  PLANNING: INFO,
  ACTIVE: SUCCESS,
  ON_HOLD: WARNING,
  COMPLETED: BRAND,
  CANCELLED: NEUTRAL,
};

export const PROJECT_PRIORITY_STYLES: Record<ProjectPriority, string> = {
  LOW: NEUTRAL,
  MEDIUM: INFO,
  HIGH: WARNING,
  CRITICAL: DANGER,
};

export const UTILIZATION_STYLES: Record<UtilizationBand, string> = {
  AVAILABLE: SUCCESS,
  MODERATE: INFO,
  HIGH: WARNING,
  OVERALLOCATED: DANGER,
};

export const EMPLOYEE_STATUS_STYLES: Record<EmployeeStatus, string> = {
  ACTIVE: SUCCESS,
  ON_LEAVE: WARNING,
  INACTIVE: NEUTRAL,
};

export const ALLOCATION_STATUS_STYLES: Record<AllocationStatus, string> = {
  ACTIVE: SUCCESS,
  COMPLETED: BRAND,
  CANCELLED: NEUTRAL,
};

export const ROLE_STYLES: Record<string, string> = {
  ADMIN: DANGER,
  PROJECT_MANAGER: BRAND,
  EMPLOYEE: NEUTRAL,
};

/** Tone used by progress bars for a workload percentage. */
export function workloadBarColor(total: number): string {
  if (total > 100) return "bg-danger";
  if (total > 80) return "bg-warning";
  if (total > 60) return "bg-info";
  return "bg-success";
}

export function scoreBarColor(score: number): string {
  if (score >= 85) return "bg-success";
  if (score >= 70) return "bg-brand-500";
  if (score >= 55) return "bg-warning";
  return "bg-danger";
}

export function coverageBarColor(percent: number): string {
  if (percent >= 100) return "bg-success";
  if (percent >= 60) return "bg-warning";
  return "bg-danger";
}