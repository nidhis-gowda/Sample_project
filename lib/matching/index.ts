/**
 * Public entry point for the matching subsystem.
 *
 * Keeping business logic behind a barrel module means UI components and API
 * route handlers never import implementation details directly.
 */
export * from "./constants";
export * from "./engine";
export * from "./team";
export * from "./python";
export { MATCH_COMPONENT_LABELS, MATCH_WEIGHTS } from "@/types/matching";
export type {
  EmployeeMatchInput,
  EmployeeSkillInput,
  MatchResult,
  ProjectMatchInput,
  SkillBreakdown,
  SkillRequirementInput,
  TeamCoverageResult,
  TeamCoverageSkill,
} from "@/types/matching";