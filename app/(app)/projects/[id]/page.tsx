import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { requirePageUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { HttpError } from "@/lib/api/http-error";
import { getProjectById } from "@/services/projectService";
import { getProjectTeamSummary } from "@/services/allocationService";
import { getCurrentTeamCoverage } from "@/services/matchingService";
import { notifySkillGap } from "@/services/notificationService";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ProgressBar,
} from "@/components/ui/Card";
import {
  PROJECT_PRIORITY_STYLES,
  PROJECT_STATUS_STYLES,
  coverageBarColor,
  workloadBarColor,
} from "@/utils/badges";
import {
  JOB_ROLE_LABELS,
  PROFICIENCY_LABELS,
  PROJECT_STATUS_LABELS,
  type ProjectPriority,
  type ProjectStatus,
} from "@/types";
import { formatDate, formatPercent, humanize } from "@/utils/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const project = await getProjectById(id);
    return { title: project.name };
  } catch {
    return { title: "Project" };
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageUser("project:read");

  let project;
  let team;
  let coverage;
  try {
    [project, team, coverage] = await Promise.all([
      getProjectById(id),
      getProjectTeamSummary(id),
      getCurrentTeamCoverage(id),
    ]);
  } catch (error) {
    // Both a malformed id (400) and a missing one (404) mean "no such project".
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  const canEdit = can(user.role, "project:update");
  const canAllocate = can(user.role, "allocation:manage");
  const gaps = coverage.coverage.gaps;

  // Tell the responsible manager once when a freshly staffed project still has
  // uncovered requirements.
  if (canAllocate && gaps.length > 0 && project.managerId === user.id) {
    await notifySkillGap({
      managerUserId: user.id,
      projectName: project.name,
      projectId: project.id,
      missingSkills: gaps.map((gap) => gap.skillName),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          Projects
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink-900">
                  {project.name}
                </h1>
                <Badge className={PROJECT_STATUS_STYLES[project.status as ProjectStatus]}>
                  {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
                </Badge>
                <Badge
                  className={PROJECT_PRIORITY_STYLES[project.priority as ProjectPriority]}
                >
                  {humanize(project.priority)}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-ink-500">
                {project.code} &middot; {project.clientName}
                {project.managerName ? ` · Managed by ${project.managerName}` : ""}
              </p>
              {project.description ? (
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
                  {project.description}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {canAllocate ? (
                <Link
                  href={`/allocation/recommend?projectId=${project.id}`}
                  className="btn-primary"
                >
                  <SparklesIcon className="h-4 w-4" aria-hidden />
                  Find employees
                </Link>
              ) : null}
              {canEdit ? (
                <Link href={`/projects/${project.id}/edit`} className="btn-secondary">
                  <PencilSquareIcon className="h-4 w-4" aria-hidden />
                  Edit
                </Link>
              ) : null}
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="text-xs text-ink-500">Start</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink-900">
                {formatDate(project.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Deadline</dt>
              <dd
                className={
                  (project.daysRemaining ?? 0) <= 14
                    ? "mt-0.5 text-sm font-medium text-danger"
                    : "mt-0.5 text-sm font-medium text-ink-900"
                }
              >
                {formatDate(project.deadline)}
                <span className="block text-xs font-normal text-ink-500">
                  {(project.daysRemaining ?? 0) < 0
                    ? `${Math.abs(project.daysRemaining ?? 0)} days overdue`
                    : `${project.daysRemaining} days left`}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Team size</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink-900">
                {project.allocatedCount} / {project.requiredTeamSize}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Min experience</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink-900">
                {project.requiredExperienceYears} years
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Progress</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink-900">
                {project.progress}%
              </dd>
              <ProgressBar value={project.progress} className="mt-2" label="Progress" />
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Team"
            subtitle={`${team.allocatedCount} allocation(s), ${team.totalAllocationPercent}% total committed`}
          />
          {team.allocations.length === 0 ? (
            <EmptyState
              title="No one allocated yet"
              description="Run the matching engine to find the best-fitting employees."
              action={
                canAllocate ? (
                  <Link
                    href={`/allocation/recommend?projectId=${project.id}`}
                    className="btn-primary"
                  >
                    Find employees
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <CardBody className="space-y-3">
              {team.allocations.map((allocation) => (
                <div key={allocation.id} className="rounded-lg border border-ink-200 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <a
                        href={`/employees/${allocation.employeeId}`}
                        className="link text-sm font-medium"
                      >
                        {allocation.employeeName}
                      </a>
                      <p className="text-xs text-ink-500">
                        {JOB_ROLE_LABELS[allocation.employeeRole]} &middot;{" "}
                        {allocation.roleInProject}
                      </p>
                    </div>
                    <Badge className="badge-neutral">
                      {formatPercent(allocation.allocationPercent)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Skill coverage"
            subtitle="Coverage of the allocated team"
          />
          <CardBody>
            <p className="text-3xl font-semibold tracking-tight text-ink-900">
              {coverage.coverage.overallCoveragePercent}%
            </p>
            <ProgressBar
              value={coverage.coverage.overallCoveragePercent}
              colorClass={coverageBarColor(coverage.coverage.overallCoveragePercent)}
              className="mt-3"
              label="Coverage"
            />

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-ink-500">Required covered</dt>
                <dd className="font-semibold tabular-nums text-ink-900">
                  {coverage.coverage.requiredSkillsCovered}/
                  {coverage.coverage.requiredSkillsTotal}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Team workload</dt>
                <dd className="font-semibold tabular-nums text-ink-900">
                  {coverage.coverage.totalWorkloadPercent}%
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Avg experience</dt>
                <dd className="font-semibold tabular-nums text-ink-900">
                  {coverage.coverage.averageExperienceYears} yrs
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Avg availability</dt>
                <dd className="font-semibold tabular-nums text-ink-900">
                  {coverage.coverage.averageAvailabilityPercent}%
                </dd>
              </div>
            </dl>

            {gaps.length > 0 ? (
              <div className="mt-4 rounded-lg bg-danger-soft p-3">
                <p className="text-xs font-semibold text-danger-ink">
                  Missing skills ({gaps.length})
                </p>
                <ul className="mt-1.5 space-y-1">
                  {gaps.map((gap) => (
                    <li key={gap.skillId} className="text-xs text-danger-ink">
                      {gap.skillName}{" "}
                      <span className="opacity-75">
                        (best {gap.bestProficiency ?? 0}/{gap.requiredProficiency})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-success-soft p-3 text-xs text-success-ink">
                Every required skill is covered by the current team.
              </p>
            )}

            <Link
              href={`/skill-gaps?projectId=${project.id}`}
              className="btn-secondary btn-sm mt-4 w-full"
            >
              Full skill gap analysis
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Required skills"
          subtitle={`${project.requirements.length} requirement(s) feeding the matching score`}
        />
        {project.requirements.length === 0 ? (
          <EmptyState
            title="No requirements defined"
            description="Without required skills the skill component of the matching score is neutral."
            action={
              canEdit ? (
                <Link href={`/projects/${project.id}/edit`} className="btn-primary">
                  Add requirements
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Category</th>
                  <th>Required level</th>
                  <th>Importance</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {project.requirements.map((requirement) => {
                  const detail = gaps.find((gap) => gap.skillId === requirement.skillId);
                  return (
                    <tr key={requirement.id}>
                      <td className="font-medium text-ink-900">
                        {requirement.skillName}
                      </td>
                      <td className="text-sm">{requirement.category}</td>
                      <td className="text-sm">
                        {requirement.requiredProficiency}/5 (
                        {PROFICIENCY_LABELS[requirement.requiredProficiency]})
                      </td>
                      <td>
                        <Badge
                          className={
                            requirement.importance === "REQUIRED"
                              ? "badge-brand"
                              : "badge-neutral"
                          }
                        >
                          {requirement.importance}
                        </Badge>
                      </td>
                      <td className="w-32">
                        {detail ? (
                          <Badge className="badge-danger">
                            {detail.coveragePercent}% covered
                          </Badge>
                        ) : (
                          <Badge className="badge-success">Covered</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
        <h2 className="text-sm font-semibold text-ink-900">
          How this project is staffed
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
          Staffing is measured in people-equivalents: the summed allocation percentage
          divided by 100. The matching engine scores every eligible employee against these{" "}
          {project.requirements.length} requirements, the target team size of{" "}
          {project.requiredTeamSize}, the {project.requiredExperienceYears}-year experience
          target and the deadline of {formatDate(project.deadline)}. The colour of each
          workload bar follows the standard utilisation bands.
        </p>
      </div>
    </div>
  );
}