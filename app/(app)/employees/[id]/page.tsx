import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { requireUser } from "@/lib/auth/rbac";
import { canEditEmployee } from "@/lib/auth/access";
import { HttpError } from "@/lib/api/http-error";
import { getEmployeeById } from "@/services/employeeService";
import { listAllocations } from "@/services/allocationService";
import { recommendTrainingForGaps, type TrainingGap } from "@/services/trainingService";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ProgressBar,
} from "@/components/ui/Card";
import { AvailabilityControl } from "@/components/employees/AvailabilityControl";
import { ProficiencyDots } from "@/components/employees/SkillEditor";
import {
  EMPLOYEE_STATUS_STYLES,
  UTILIZATION_STYLES,
  workloadBarColor,
} from "@/utils/badges";
import {
  JOB_ROLE_LABELS,
  PROFICIENCY_LABELS,
  type AllocationDTO,
  type EmployeeStatus,
  type UtilizationBand,
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
    const employee = await getEmployeeById(id);
    return { title: employee.name };
  } catch {
    return { title: "Employee" };
  }
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  let employee;
  try {
    employee = await getEmployeeById(id);
  } catch (error) {
    // A malformed id is a 400 and a missing one is a 404; from the visitor's
    // point of view both mean "no such employee", so render the 404 page
    // instead of letting the error bubble up as a 500.
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  const allocations = await listAllocations({ employeeId: id, status: "ACTIVE" });

  // Training recommendations are personal, so an EMPLOYEE only ever sees their own.
  const showTraining = user.role !== "EMPLOYEE" || user.employeeId === id;
  const training: TrainingGap[] = showTraining
    ? await recommendTrainingForGaps(
        employee.skills
          .filter((skill) => skill.proficiency < 3)
          .map((skill) => ({
            skillId: skill.skillId,
            skillName: skill.skillName,
            currentProficiency: skill.proficiency,
            requiredProficiency: 3,
            reason: `Profile level ${skill.proficiency}/5; level 3 is the company baseline.`,
          }))
      )
    : [];

  const mayEdit = canEditEmployee(user, id);

  // Group skills by category so the profile reads like a capability summary.
  const byCategory = new Map<string, typeof employee.skills>();
  for (const skill of employee.skills) {
    const bucket = byCategory.get(skill.category) ?? [];
    bucket.push(skill);
    byCategory.set(skill.category, bucket);
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-brand-600 to-brand-400" aria-hidden />
        <CardBody className="-mt-10">
          <div className="flex flex-wrap items-end gap-4">
            <Avatar name={employee.name} src={employee.avatar} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink-900">
                  {employee.name}
                </h1>
                <Badge className={EMPLOYEE_STATUS_STYLES[employee.status as EmployeeStatus]}>
                  {humanize(employee.status)}
                </Badge>
                {employee.calendarConnected ? (
                  <Badge className="badge-info">Calendar connected</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-ink-500">
                {employee.employeeId} &middot; {JOB_ROLE_LABELS[employee.jobRole]}
                {employee.departmentName ? ` · ${employee.departmentName}` : ""}
              </p>
              <p className="text-xs text-ink-500">
                {employee.email} &middot; {employee.location}
              </p>
            </div>

            {mayEdit ? (
              <Link href={`/employees/${employee.id}/edit`} className="btn-secondary">
                <PencilSquareIcon className="h-4 w-4" aria-hidden />
                Edit profile
              </Link>
            ) : null}
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-ink-500">Experience</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                {employee.yearsOfExperience} year{employee.yearsOfExperience === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Availability</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                {formatPercent(employee.availabilityPercent)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Current workload</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                {formatPercent(employee.totalAllocation)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Active projects</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                {employee.activeProjectCount}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <WorkloadCard
          totalAllocation={employee.totalAllocation}
          utilizationBand={employee.utilizationBand}
          allocations={allocations}
        />
        <AvailabilityCard
          employeeId={employee.id}
          availabilityPercent={employee.availabilityPercent}
          calendarConnected={employee.calendarConnected}
          canEdit={mayEdit}
        />
      </div>

      <Card>
        <CardHeader
          title="Skills"
          subtitle={`${employee.skills.length} skill${
            employee.skills.length === 1 ? "" : "s"
          } recorded - these drive the matching score`}
        />
        {employee.skills.length === 0 ? (
          <EmptyState
            title="No skills recorded"
            description="Add skills so this employee can be matched to projects."
            action={
              mayEdit ? (
                <Link href={`/employees/${employee.id}/edit`} className="btn-primary">
                  Add skills
                </Link>
              ) : undefined
            }
          />
        ) : (
          <CardBody className="space-y-5">
            {[...byCategory.entries()].map(([category, skills]) => (
              <div key={category}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  {category}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {skills.map((skill) => (
                    <div
                      key={skill.skillId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-ink-800">
                        {skill.skillName}
                      </span>
                      <ProficiencyDots level={skill.proficiency} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Certifications" subtitle="Formal qualifications on record" />
          {employee.certifications.length === 0 ? (
            <EmptyState
              title="No certifications recorded"
              description="Certifications are optional but help justify a higher proficiency."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {employee.certifications.map((certification) => (
                <li key={certification.name} className="px-5 py-3.5">
                  <p className="text-sm font-medium text-ink-800">{certification.name}</p>
                  <p className="text-xs text-ink-500">
                    {certification.issuer ?? "Issuer not recorded"}
                    {certification.issuedOn
                      ? ` · ${formatDate(certification.issuedOn)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {showTraining ? <TrainingCard training={training} /> : null}
      </div>
    </div>
  );
}

/** Workload summary with one card per active allocation. */
function WorkloadCard({
  totalAllocation,
  utilizationBand,
  allocations,
}: {
  totalAllocation: number;
  utilizationBand: UtilizationBand;
  allocations: AllocationDTO[];
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Current workload"
        subtitle="Sum of every active allocation"
        actions={
          <Badge className={UTILIZATION_STYLES[utilizationBand]}>
            {humanize(utilizationBand)}
          </Badge>
        }
      />
      <CardBody>
        <ProgressBar
          value={Math.min(100, totalAllocation)}
          colorClass={workloadBarColor(totalAllocation)}
          label="Total workload"
        />
        <p className="mt-2 text-xs text-ink-500">
          {totalAllocation > 100
            ? "This employee is overallocated. Review their allocations before adding more."
            : `${formatPercent(100 - Math.min(100, totalAllocation))} of capacity remains.`}
        </p>

        {allocations.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No active allocations"
              description="This employee is not currently allocated to any project."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {allocations.map((allocation) => (
              <div key={allocation.id} className="rounded-lg border border-ink-200 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${allocation.projectId}`}
                      className="link text-sm font-medium"
                    >
                      {allocation.projectName}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {allocation.projectCode} &middot; {allocation.roleInProject}
                    </p>
                  </div>
                  <Badge
                    className={
                      UTILIZATION_STYLES[
                        allocation.allocationPercent > 60 ? "HIGH" : "MODERATE"
                      ]
                    }
                  >
                    {formatPercent(allocation.allocationPercent)}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-ink-400">
                  Since {formatDate(allocation.startDate)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Availability summary plus the (role-guarded) update control. */
function AvailabilityCard({
  employeeId,
  availabilityPercent,
  calendarConnected,
  canEdit,
}: {
  employeeId: string;
  availabilityPercent: number;
  calendarConnected: boolean;
  canEdit: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="Availability"
        subtitle="Capacity offered to new projects"
        actions={
          <AvailabilityControl
            employeeId={employeeId}
            initial={availabilityPercent}
            canEdit={canEdit}
          />
        }
      />
      <CardBody>
        <p className="text-3xl font-semibold tracking-tight text-ink-900">
          {formatPercent(availabilityPercent)}
        </p>
        <ProgressBar
          value={availabilityPercent}
          colorClass="bg-info"
          className="mt-3"
          label="Availability"
        />
        <p className="mt-3 text-xs leading-relaxed text-ink-500">
          {calendarConnected
            ? "A Google Calendar is connected, so busy time also feeds into the matching score."
            : "Availability is set manually. Connecting a Google Calendar lets busy time refine the score."}
        </p>
      </CardBody>
    </Card>
  );
}

/** Recommended courses for the skills that sit below the company baseline. */
function TrainingCard({ training }: { training: TrainingGap[] }) {
  return (
    <Card>
      <CardHeader
        title="Recommended training"
        subtitle="Based on skills below level 3"
        actions={
          <Link href="/training" className="btn-ghost btn-xs">
            Catalogue
          </Link>
        }
      />
      {training.length === 0 ? (
        <EmptyState
          title="No training needed"
          description="Every recorded skill is at intermediate level or above."
        />
      ) : (
        <ul className="divide-y divide-ink-100">
          {training.map((item) => (
            <li key={item.skillId ?? item.skillName} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-800">
                  {item.recommended?.title ?? `Improve ${item.skillName}`}
                </p>
                {item.recommended ? (
                  <Badge className="badge-brand">
                    {item.recommended.durationHours}h &middot;{" "}
                    {PROFICIENCY_LABELS[item.recommended.targetProficiency]}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                {item.skillName}: level {item.currentProficiency}/5, target{" "}
                {item.requiredProficiency}/5.
              </p>
              {item.recommended ? (
                <p className="mt-1 text-xs leading-relaxed text-ink-600">
                  {item.recommended.description}
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-500">
                  No internal course covers this skill yet.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}