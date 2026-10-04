/**
 * Shared domain types, enums and DTOs.
 *
 * These constants are the single source of truth for the string unions used by
 * the Mongoose schemas, the Zod validators, the UI and the REST API.
 */

/* ------------------------------------------------------------------ */
/* Users & roles                                                       */
/* ------------------------------------------------------------------ */

export const USER_ROLES = ["ADMIN", "PROJECT_MANAGER", "EMPLOYEE"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  PROJECT_MANAGER: "Project Manager",
  EMPLOYEE: "Employee",
};

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export const SKILL_CATEGORIES = [
  "Programming",
  "Frontend",
  "Backend",
  "Database",
  "Cloud",
  "DevOps",
  "Testing",
  "Security",
  "Data",
  "Management",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const PROFICIENCY_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

/* ------------------------------------------------------------------ */
/* Employees                                                           */
/* ------------------------------------------------------------------ */

export const JOB_ROLES = [
  "PROJECT_MANAGER",
  "TECH_LEAD",
  "BACKEND_DEVELOPER",
  "FRONTEND_DEVELOPER",
  "FULLSTACK_DEVELOPER",
  "MOBILE_DEVELOPER",
  "QA_ENGINEER",
  "DEVOPS_ENGINEER",
  "DATA_ENGINEER",
  "SECURITY_ENGINEER",
  "UI_UX_DESIGNER",
  "BUSINESS_ANALYST",
] as const;
export type JobRole = (typeof JOB_ROLES)[number];

export const JOB_ROLE_LABELS: Record<JobRole, string> = {
  PROJECT_MANAGER: "Project Manager",
  TECH_LEAD: "Tech Lead",
  BACKEND_DEVELOPER: "Backend Developer",
  FRONTEND_DEVELOPER: "Frontend Developer",
  FULLSTACK_DEVELOPER: "Fullstack Developer",
  MOBILE_DEVELOPER: "Mobile Developer",
  QA_ENGINEER: "QA Engineer",
  DEVOPS_ENGINEER: "DevOps Engineer",
  DATA_ENGINEER: "Data Engineer",
  SECURITY_ENGINEER: "Security Engineer",
  UI_UX_DESIGNER: "UI/UX Designer",
  BUSINESS_ANALYST: "Business Analyst",
};

export const EMPLOYEE_STATUSES = ["ACTIVE", "ON_LEAVE", "INACTIVE"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const REQUIREMENT_IMPORTANCE = ["REQUIRED", "OPTIONAL"] as const;
export type RequirementImportance = (typeof REQUIREMENT_IMPORTANCE)[number];

/* ------------------------------------------------------------------ */
/* Allocations & workload                                              */
/* ------------------------------------------------------------------ */

export const ALLOCATION_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export const UTILIZATION_BANDS = [
  "AVAILABLE",
  "MODERATE",
  "HIGH",
  "OVERALLOCATED",
] as const;
export type UtilizationBand = (typeof UTILIZATION_BANDS)[number];

export const UTILIZATION_BAND_LABELS: Record<UtilizationBand, string> = {
  AVAILABLE: "Available",
  MODERATE: "Moderate",
  HIGH: "High",
  OVERALLOCATED: "Overallocated",
};

/* ------------------------------------------------------------------ */
/* Training & notifications                                            */
/* ------------------------------------------------------------------ */

export const TRAINING_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

export const NOTIFICATION_TYPES = [
  "PROJECT_ASSIGNMENT",
  "ALLOCATION_REQUEST",
  "ALLOCATION_APPROVAL",
  "SKILL_GAP",
  "TRAINING_RECOMMENDATION",
  "DEADLINE_APPROACHING",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Generic API envelope                                                */
/* ------------------------------------------------------------------ */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: PaginationMeta & Record<string, unknown>;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    /** Field level validation errors, keyed by field path. */
    fields?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/* ------------------------------------------------------------------ */
/* Serialised (client safe) shapes                                     */
/* ------------------------------------------------------------------ */

export interface SkillDTO {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
  employeeCount?: number;
}

export interface DepartmentDTO {
  id: string;
  name: string;
  code: string;
  description?: string;
  employeeCount?: number;
}

export interface EmployeeSkillDTO {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  proficiency: number;
  yearsOfExperience: number;
}

export interface EmployeeDTO {
  id: string;
  userId?: string | null;
  employeeId: string;
  name: string;
  email: string;
  avatar?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  jobRole: JobRole;
  status: EmployeeStatus;
  yearsOfExperience: number;
  location: string;
  availabilityPercent: number;
  calendarConnected: boolean;
  skills: EmployeeSkillDTO[];
  certifications: Array<{ name: string; issuer?: string; issuedOn?: string | null }>;
  totalAllocation: number;
  utilizationBand: UtilizationBand;
  activeProjectCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectRequirementDTO {
  id: string;
  skillId: string;
  skillName: string;
  category: SkillCategory;
  requiredProficiency: number;
  importance: RequirementImportance;
}

export interface ProjectDTO {
  id: string;
  name: string;
  code: string;
  clientName: string;
  description?: string;
  startDate: string;
  deadline: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  requiredTeamSize: number;
  requiredExperienceYears: number;
  progress: number;
  managerId?: string | null;
  managerName?: string | null;
  requirements: ProjectRequirementDTO[];
  allocatedCount?: number;
  totalAllocationPercent?: number;
  daysRemaining?: number;
  staffingPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AllocationDTO {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: JobRole;
  projectId: string;
  projectName: string;
  projectCode: string;
  allocationPercent: number;
  roleInProject: string;
  startDate: string;
  endDate?: string | null;
  status: AllocationStatus;
  createdAt?: string;
}

export interface WorkloadDTO {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  jobRole: JobRole;
  departmentName?: string | null;
  availabilityPercent: number;
  totalAllocation: number;
  utilizationBand: UtilizationBand;
  activeProjectCount: number;
  projects: Array<{ projectId: string; projectName: string; allocationPercent: number }>;
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalEmployees: number;
  availableEmployees: number;
  activeProjects: number;
  allocatedEmployees: number;
  averageUtilization: number;
  openSkillGaps: number;
  approachingDeadlines: number;
  understaffedProjects: number;
}

export interface DashboardCharts {
  utilization: { labels: string[]; values: number[] };
  skillDistribution: { labels: string[]; values: number[] };
  projectStatus: { labels: string[]; values: number[] };
  departmentDistribution: { labels: string[]; values: number[] };
  skillGaps: { labels: string[]; values: number[] };
  projectStaffing: {
    labels: string[];
    required: number[];
    allocated: number[];
  };
}