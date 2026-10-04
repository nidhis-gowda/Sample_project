import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { recommendEmployees } from "@/lib/matching/python";
import { computeTeamCoverage } from "@/lib/matching/team";
import { getMatchInputsByIds, listEmployeesForMatching } from "@/services/employeeService";
import { getProjectMatchInput, getProjectById } from "@/services/projectService";
import type { MatchResult, RecommendationQuery, TeamCoverageResult } from "@/types/matching";
import type { ProjectDTO } from "@/types";

/**
 * Matching service — orchestrates the (pure) matching engine with the database.
 *
 * The optional Python FastAPI service is used when reachable; otherwise the
 * TypeScript engine answers, so the feature never breaks.
 */

export interface RecommendationResponse {
  project: ProjectDTO;
  results: MatchResult[];
  engine: "typescript" | "python";
  fallbackReason?: string;
  candidatesEvaluated: number;
}

/** Employees already allocated to the project are excluded from suggestions. */
export async function getRecommendations(
  projectId: string,
  filters: RecommendationQuery = {}
): Promise<RecommendationResponse> {
  await connectDB();

  const [project, projectMatchInput] = await Promise.all([
    getProjectById(projectId),
    getProjectMatchInput(projectId),
  ]);
  if (projectMatchInput.requirements.length === 0 && project.requirements.length === 0) {
    // Not an error — the response simply explains that nothing can be scored yet.
  }

  const candidates = await listEmployeesForMatching({
    departmentId: filters.departmentId,
    jobRole: filters.jobRole,
    skillId: filters.skillId,
  });

  const allocatedIds = new Set(
    (project.allocatedCount ? await allocatedEmployeeIds(projectId) : new Set<string>())
  );

  const pool = candidates.filter((candidate) => !allocatedIds.has(candidate.employeeId));

  const { results, engine, fallbackReason } = await recommendEmployees(
    pool,
    projectMatchInput,
    { forceLocal: filters.forceLocal }
  );

  const filtered = results.filter((result) => {
    if (filters.minScore !== undefined && result.overallScore < filters.minScore) return false;
    if (
      filters.minAvailability !== undefined &&
      result.components.availability < filters.minAvailability
    ) {
      return false;
    }
    if (
      filters.maxWorkload !== undefined &&
      result.projectedWorkloadPercent > filters.maxWorkload
    ) {
      return false;
    }
    if (filters.minExperience !== undefined) {
      const candidate = pool.find((item) => item.employeeId === result.employeeId);
      if (!candidate || candidate.yearsOfExperience < filters.minExperience) return false;
    }
    return true;
  });

  return {
    project,
    results: filtered.slice(0, filters.limit ?? 25),
    engine,
    fallbackReason,
    candidatesEvaluated: pool.length,
  };
}

async function allocatedEmployeeIds(projectId: string): Promise<Set<string>> {
  const { AllocationModel } = await import("@/models/Allocation");
  const rows = await AllocationModel.find({ projectId, status: "ACTIVE" })
    .select("employeeId")
    .lean();
  return new Set(rows.map((row) => String(row.employeeId)));
}

/** Skill coverage for an arbitrary set of candidate employees. */
export async function getCoverageForEmployees(
  projectId: string,
  employeeIds: string[]
): Promise<{ project: ProjectDTO; coverage: TeamCoverageResult }> {
  await connectDB();
  if (!projectId) throw HttpError.badRequest("A project is required.");

  const [project, projectMatchInput, members] = await Promise.all([
    getProjectById(projectId),
    getProjectMatchInput(projectId),
    getMatchInputsByIds(employeeIds),
  ]);

  return {
    project,
    coverage: computeTeamCoverage(projectMatchInput.requirements, members),
  };
}

/** Skill coverage of the team that is *currently allocated* to the project. */
export async function getCurrentTeamCoverage(projectId: string): Promise<{
  project: ProjectDTO;
  coverage: TeamCoverageResult;
  memberIds: string[];
}> {
  const memberIds = [...(await allocatedEmployeeIds(projectId))];
  const { project, coverage } = await getCoverageForEmployees(projectId, memberIds);
  return { project, coverage, memberIds };
}