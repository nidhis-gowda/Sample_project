import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { getEmployeeById } from "@/services/employeeService";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ProgressBar,
} from "@/components/ui/Card";
import { ProfileEditor } from "@/components/employees/ProfileEditor";
import { CalendarSettings } from "@/components/employees/CalendarSettings";
import { ProficiencyDots } from "@/components/employees/SkillEditor";
import { UTILIZATION_STYLES, workloadBarColor } from "@/utils/badges";
import {
  JOB_ROLE_LABELS,
  USER_ROLE_LABELS,
  UTILIZATION_BAND_LABELS,
} from "@/types";
import { formatPercent, humanize } from "@/utils/format";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requirePageUser("profile:update:own");

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <EmptyState
            title="No employee profile linked"
            description="Your account has no employee record yet. An administrator can link one from the Users screen, or ask them to create it."
          />
        </Card>
      </div>
    );
  }

  // `session.user.employeeId` already holds the *employee document* id, so this
  // must be looked up by employee id. Passing it to a user-id lookup would never
  // match and used to redirect every signed-in user to the dashboard.
  const employee = await getEmployeeById(user.employeeId);
  if (!employee) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-brand-600 to-brand-400" aria-hidden />
        <CardBody className="-mt-10">
          <div className="flex flex-wrap items-end gap-4">
            <Avatar name={employee.name} src={user.image ?? employee.avatar} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink-900">
                  {employee.name}
                </h1>
                <Badge className="badge-brand">
                  {USER_ROLE_LABELS[user.role]}
                </Badge>
                <Badge className={UTILIZATION_STYLES[employee.utilizationBand]}>
                  {UTILIZATION_BAND_LABELS[employee.utilizationBand]}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-ink-500">
                {employee.employeeId} &middot; {JOB_ROLE_LABELS[employee.jobRole]}
                {employee.departmentName ? ` · ${employee.departmentName}` : ""}
              </p>
              <p className="text-xs text-ink-500">{user.email}</p>
            </div>
            <Link href={`/employees/${employee.id}`} className="btn-secondary">
              View full profile
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-ink-500">Workload</p>
              <p className="mt-0.5 text-lg font-semibold text-ink-900">
                {formatPercent(employee.totalAllocation)}
              </p>
              <ProgressBar
                value={Math.min(100, employee.totalAllocation)}
                colorClass={workloadBarColor(employee.totalAllocation)}
                className="mt-2"
                label="Workload"
              />
            </div>
            <div>
              <p className="text-xs text-ink-500">Availability</p>
              <p className="mt-0.5 text-lg font-semibold text-ink-900">
                {formatPercent(employee.availabilityPercent)}
              </p>
              <ProgressBar
                value={employee.availabilityPercent}
                colorClass="bg-info"
                className="mt-2"
                label="Availability"
              />
            </div>
            <div>
              <p className="text-xs text-ink-500">Skills recorded</p>
              <p className="mt-0.5 text-lg font-semibold text-ink-900">
                {employee.skills.length}
              </p>
              <p className="mt-2 text-xs text-ink-500">
                {can(user.role, "employee:update")
                  ? "You can edit any profile as a manager."
                  : "Ask a manager to change a skill level."}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileEditor employee={employee} />
        <div className="space-y-6">
          <CalendarSettings />
          <Card>
            <CardHeader
              title="My skills"
              subtitle="These drive your matching score on every project"
              actions={
                can(user.role, "employee:update") ? (
                  <Link
                    href={`/employees/${employee.id}/edit`}
                    className="btn-secondary btn-xs"
                  >
                    Edit skills
                  </Link>
                ) : undefined
              }
            />
            {employee.skills.length === 0 ? (
              <EmptyState
                title="No skills recorded"
                description="Ask a manager to add your skills so you can be matched to projects."
              />
            ) : (
              <CardBody className="space-y-2">
                {employee.skills.map((skill) => (
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
              </CardBody>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}