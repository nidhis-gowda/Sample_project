import type { ProjectStatus, UtilizationBand } from "@/types";

/** Presentation constants shared by the dashboard service and its charts. */

/** Chart x-axis order for the utilisation distribution. */
export const UTILIZATION_ORDER: UtilizationBand[] = [
  "AVAILABLE",
  "MODERATE",
  "HIGH",
  "OVERALLOCATED",
];

/** Chart x-axis order for the project status doughnut. */
export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
];

/** Fixed palette so a department always keeps the same colour across charts. */
export const DEPARTMENT_CHART_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#db2777",
  "#64748b",
];

/** Palette used by the skill-gap / staffing charts. */
export const GAP_CHART_COLORS = ["#dc2626", "#d97706", "#ca8a04", "#0284c7", "#4f46e5"];