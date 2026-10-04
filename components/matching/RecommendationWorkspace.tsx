"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { api, errorMessage, ApiRequestError } from "@/hooks/useApi";
import { useApiData, useDebounced } from "@/hooks/useApiData";
import { useToast } from "@/hooks/useToast";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Modal";
import {
  TeamCoveragePanel,
  type TeamMemberInput,
} from "@/components/matching/TeamCoveragePanel";
import { ComparePanel } from "@/components/matching/ComparePanel";
import {
  CandidateRow,
  FiltersBar,
  ProjectPicker,
  type FilterValues,
} from "@/components/matching/RecommendationParts";
import { JOB_ROLE_LABELS, type ProjectDTO } from "@/types";
import type { MatchResult, TeamCoverageResult } from "@/types/matching";

/**
 * Recommendation workspace.
 *
 * Runs the matching engine for the selected project, lets a manager filter,
 * compare and select candidates, and finally allocates the chosen team.
 */

interface RecommendationResponse {
  project: ProjectDTO;
  results: MatchResult[];
  engine: "typescript" | "python";
  fallbackReason?: string;
  candidatesEvaluated: number;
}

const EMPTY_FILTERS: FilterValues = {
  minScore: "",
  departmentId: "",
  jobRole: "",
  skillId: "",
  minAvailability: "",
  minExperience: "",
  maxWorkload: "",
  limit: "15",
};

/** Counts the filters the manager has changed away from their default. */
function activeFilterCount(filters: FilterValues): number {
  return (Object.keys(filters) as Array<keyof FilterValues>).filter(
    (key) => filters[key] !== "" && filters[key] !== EMPTY_FILTERS[key]
  ).length;
}

function summaryText(
  loading: boolean,
  shown: number,
  meta: Record<string, unknown> | undefined
): string {
  if (loading) return "Scoring candidates...";
  return `${shown} of ${Number(meta?.candidatesEvaluated ?? 0)} candidate(s) shown`;
}

export function RecommendationWorkspace({
  projects,
  departments,
  skills,
  initialProjectId,
  canAllocate,
}: {
  projects: ProjectDTO[];
  departments: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
  initialProjectId?: string;
  canAllocate: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [projectId, setProjectId] = React.useState(initialProjectId ?? "");
  const [filters, setFilters] = React.useState<FilterValues>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [team, setTeam] = React.useState<TeamMemberInput[]>([]);
  const [coverage, setCoverage] = React.useState<TeamCoverageResult | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [allocating, setAllocating] = React.useState(false);

  const debouncedFilters = useDebounced(filters, 350);

  // Filters travel to the API, so the ranking shown is exactly what the server
  // computed and never a client-side re-score.
  const query = React.useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedFilters.minScore) params.set("minScore", debouncedFilters.minScore);
    if (debouncedFilters.departmentId)
      params.set("departmentId", debouncedFilters.departmentId);
    if (debouncedFilters.jobRole) params.set("jobRole", debouncedFilters.jobRole);
    if (debouncedFilters.skillId) params.set("skillId", debouncedFilters.skillId);
    if (debouncedFilters.minAvailability)
      params.set("minAvailability", debouncedFilters.minAvailability);
    if (debouncedFilters.minExperience)
      params.set("minExperience", debouncedFilters.minExperience);
    if (debouncedFilters.maxWorkload)
      params.set("maxWorkload", debouncedFilters.maxWorkload);
    params.set("limit", debouncedFilters.limit || "15");
    return params.toString();
  }, [debouncedFilters]);

  const path = projectId ? `/api/projects/${projectId}/recommendations?${query}` : null;
  const { data, meta, loading, error } = useApiData<RecommendationResponse>(path);
  const results = data?.results ?? [];

  const setFilter = (key: keyof FilterValues) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const toggleTeam = (result: MatchResult) => {
    setTeam((current) => {
      const exists = current.some((member) => member.employeeId === result.employeeId);
      if (exists) {
        return current.filter((member) => member.employeeId !== result.employeeId);
      }
      return [
        ...current,
        {
          employeeId: result.employeeId,
          employeeName: result.employeeName,
          allocationPercent: result.fairShareAllocationPercent,
          roleInProject: JOB_ROLE_LABELS[result.jobRole],
        },
      ];
    });
  };

  // Recompute live coverage as the manager ticks candidates.
  React.useEffect(() => {
    if (!projectId || team.length === 0) {
      setCoverage(null);
      return undefined;
    }
    let cancelled = false;
    api
      .post<{ coverage: TeamCoverageResult }>(`/api/projects/${projectId}/coverage`, {
        employeeIds: team.map((member) => member.employeeId),
      })
      .then(({ data: result }) => {
        if (!cancelled) setCoverage(result.coverage);
      })
      .catch(() => {
        if (!cancelled) setCoverage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, team]);

  const toggleCompare = (employeeId: string) => {
    setCompareIds((current) => {
      if (current.includes(employeeId)) {
        return current.filter((id) => id !== employeeId);
      }
      if (current.length >= 3) {
        toast.info("Compare up to three candidates", "Remove one before adding another.");
        return current;
      }
      return [...current, employeeId];
    });
  };

  const allocate = async (allowOverallocated: boolean) => {
    if (!projectId || team.length === 0) return;
    setAllocating(true);
    try {
      const { data: result } = await api.post<{ warnings?: string[] }>(
        `/api/projects/${projectId}/allocate`,
        {
          members: team.map((member) => ({
            employeeId: member.employeeId,
            allocationPercent: member.allocationPercent,
            roleInProject: member.roleInProject,
          })),
          allowOverallocated,
          notify: true,
        }
      );
      const warnings = result?.warnings ?? [];
      toast.success(
        `${team.length} team member${team.length === 1 ? "" : "s"} allocated`,
        warnings.length > 0 ? warnings.join(" ") : undefined
      );
      setConfirmOpen(false);
      setTeam([]);
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 409) {
        // The API refuses to overallocate silently, so ask for an explicit override.
        toast.error("Over-allocation blocked", cause.message);
        setConfirmOpen(true);
      } else {
        toast.error("Could not allocate the team", errorMessage(cause));
      }
    } finally {
      setAllocating(false);
    }
  };

  if (projects.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No projects available"
          description="Create a project with required skills before running recommendations."
        />
      </Card>
    );
  }

  const comparedResults = compareIds
    .map((id) => results.find((result) => result.employeeId === id))
    .filter((result): result is MatchResult => Boolean(result));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <ProjectPicker
          projects={projects}
          projectId={projectId}
          onChange={(value) => {
            setProjectId(value);
            setExpanded(null);
            setTeam([]);
          }}
        />

        {projectId ? (
          <FiltersBar
            filters={filters}
            onChange={setFilter}
            onToggle={() => setShowFilters((value) => !value)}
            onReset={() => setFilters(EMPTY_FILTERS)}
            open={showFilters}
            departments={departments}
            skills={skills}
            summary={summaryText(loading, results.length, meta)}
            engine={meta?.engine as string | undefined}
            fallbackReason={
              meta?.fallbackReason ? String(meta.fallbackReason) : undefined
            }
            activeCount={activeFilterCount(filters)}
          />
        ) : null}

        {!projectId ? (
          <Card>
            <EmptyState
              title="Choose a project to begin"
              description="Recommendations are computed from that project's required skills, team size, experience target and deadline."
              icon={<SparklesIcon className="h-6 w-6" aria-hidden />}
            />
          </Card>
        ) : loading && !data ? (
          <Card>
            <CardHeader title="Recommendations" subtitle="Scoring candidates..." />
            <CardBody className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </CardBody>
          </Card>
        ) : error ? (
          <Card>
            <ErrorState message={error} />
          </Card>
        ) : results.length === 0 ? (
          <Card>
            <EmptyState
              title="No candidates match these filters"
              description="Lower the minimum score, widen the department or role filter, or relax the availability requirement."
            />
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="Ranked candidates"
              subtitle="System Matching Score: decision support, not an objective ranking of people"
            />
            <ul className="divide-y divide-ink-100">
              {results.map((result, index) => (
                <CandidateRow
                  key={result.employeeId}
                  result={result}
                  rank={index + 1}
                  expanded={expanded === result.employeeId}
                  inTeam={team.some((member) => member.employeeId === result.employeeId)}
                  comparing={compareIds.includes(result.employeeId)}
                  canAllocate={canAllocate}
                  onToggleExpand={() =>
                    setExpanded((current) =>
                      current === result.employeeId ? null : result.employeeId
                    )
                  }
                  onToggleTeam={() => toggleTeam(result)}
                  onToggleCompare={() => toggleCompare(result.employeeId)}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        {comparedResults.length > 0 ? (
          <ComparePanel
            results={comparedResults}
            onRemove={(id) =>
              setCompareIds((current) => current.filter((item) => item !== id))
            }
            onClear={() => setCompareIds([])}
          />
        ) : null}

        {canAllocate ? (
          <TeamCoveragePanel
            team={team}
            coverage={coverage}
            requiredTeamSize={data?.project.requiredTeamSize ?? 0}
            onRemove={(employeeId) =>
              setTeam((current) =>
                current.filter((member) => member.employeeId !== employeeId)
              )
            }
            onPercentChange={(employeeId, allocationPercent) =>
              setTeam((current) =>
                current.map((member) =>
                  member.employeeId === employeeId
                    ? { ...member, allocationPercent }
                    : member
                )
              )
            }
            onRoleChange={(employeeId, roleInProject) =>
              setTeam((current) =>
                current.map((member) =>
                  member.employeeId === employeeId ? { ...member, roleInProject } : member
                )
              )
            }
            onClear={() => setTeam([])}
            onAllocate={() => setConfirmOpen(true)}
            busy={allocating}
          />
        ) : (
          <Card>
            <CardHeader title="Team builder" subtitle="Requires allocation permission" />
            <EmptyState
              title="Not available for your role"
              description="Your role can view recommendations but cannot allocate employees."
            />
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        busy={allocating}
        tone="primary"
        title="Allocate the selected team"
        confirmLabel="Confirm allocation"
        message={
          <>
            <p>
              You are about to allocate <strong>{team.length}</strong> employee
              {team.length === 1 ? "" : "s"} to this project.
            </p>
            <p className="mt-2 text-xs text-ink-500">
              Each employee receives a notification and their workload is recalculated
              immediately.
            </p>
          </>
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => allocate(true)}
      />
    </div>
  );
}