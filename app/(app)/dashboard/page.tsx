import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { requirePageUser } from "@/lib/auth/rbac";
import { buildDashboard } from "@/services/dashboardService";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart, DoughnutChart, GroupedBarChart } from "@/components/charts/Charts";
import {
  DeadlineTable,
  UnderstaffedList,
  PortfolioTable,
} from "@/components/dashboard/DashboardTables";
import { UTILIZATION_BAND_LABELS } from "@/types";
import { DEPARTMENT_CHART_COLORS } from "@/lib/dashboard/constants";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser("dashboard:read");
  const data = await buildDashboard(user);
  const { stats, charts } = data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">
            {user.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
          </h1>
          <p className="section-subtitle">
            {data.scoped
              ? "Your own workload, assignments and training plan."
              : "Live company-wide staffing, utilisation and skill coverage."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/allocation/recommend" className="btn-secondary">
            Find employees for a project
          </Link>
          <Link href="/workload" className="btn-primary">
            Review workload
            <ArrowRightIcon className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total employees"
          value={stats.totalEmployees}
          hint={`${stats.availableEmployees} currently unallocated`}
          tone="brand"
        />
        <StatCard
          label="Active projects"
          value={stats.activeProjects}
          hint={`${stats.understaffedProjects} not fully staffed`}
          tone={stats.understaffedProjects > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Average utilisation"
          value={`${stats.averageUtilization}%`}
          hint={`${stats.allocatedEmployees} of ${stats.totalEmployees} allocated`}
          tone={stats.averageUtilization > 80 ? "warning" : "success"}
        />
        <StatCard
          label="Open skill gaps"
          value={stats.openSkillGaps}
          hint={`${stats.approachingDeadlines} project(s) near deadline`}
          tone={stats.openSkillGaps > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Employee utilisation"
            subtitle="How many people sit in each workload band"
          />
          <CardBody>
            <BarChart
              labels={charts.utilization.labels.map(
                (band) =>
                  UTILIZATION_BAND_LABELS[band as keyof typeof UTILIZATION_BAND_LABELS]
              )}
              values={charts.utilization.values}
              colors={["#16a34a", "#0284c7", "#d97706", "#dc2626"]}
              emptyLabel="Allocate employees to a project to populate this chart."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Projects by status" subtitle="All projects in scope" />
          <CardBody>
            <DoughnutChart
              labels={charts.projectStatus.labels}
              values={charts.projectStatus.values}
            />
          </CardBody>
        </Card>
      </div>
<div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top skills across the company"
            subtitle="Most common capabilities"
          />
          <CardBody>
            <BarChart
              labels={charts.skillDistribution.labels}
              values={charts.skillDistribution.values}
              horizontal
              height={280}
              emptyLabel="Add skills to employee profiles to populate this chart."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Department distribution"
            subtitle="Head count per department"
          />
          <CardBody>
            <DoughnutChart
              labels={charts.departmentDistribution.labels}
              values={charts.departmentDistribution.values}
              colors={DEPARTMENT_CHART_COLORS}
              height={280}
              emptyLabel="Assign employees to departments to populate this chart."
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Project staffing"
            subtitle="Required people versus allocated people-equivalents"
          />
          <CardBody>
            <GroupedBarChart
              labels={charts.projectStaffing.labels}
              series={[
                {
                  label: "Required",
                  values: charts.projectStaffing.required,
                  color: "#c7d2fe",
                },
                {
                  label: "Allocated",
                  values: charts.projectStaffing.allocated,
                  color: "#4f46e5",
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Most common skill gaps"
            subtitle="Requirements the allocated teams do not cover"
            actions={
              <Link href="/skill-gaps" className="btn-ghost btn-xs">
                View all
              </Link>
            }
          />
          <CardBody>
            <BarChart
              labels={charts.skillGaps.labels}
              values={charts.skillGaps.values}
              horizontal
              height={280}
              colors={["#dc2626"]}
              emptyLabel="No open skill gaps across the projects in scope."
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Projects approaching their deadline"
            subtitle="Due within the next 14 days"
            actions={
              <Link href="/projects" className="btn-ghost btn-xs">
                All projects
              </Link>
            }
          />
          {data.approachingDeadlines.length === 0 ? (
            <EmptyState
              title="No deadlines in the next 14 days"
              description="Nothing is due imminently. Projects with an imminent deadline appear here."
            />
          ) : (
            <DeadlineTable rows={data.approachingDeadlines} />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Understaffed projects"
            subtitle="Below the required team size"
          />
          <UnderstaffedList rows={data.understaffed} />
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Active portfolio"
          subtitle="Sorted by nearest deadline"
          actions={
            <Link href="/projects" className="btn-ghost btn-xs">
              View all
            </Link>
          }
        />
        {data.recentProjects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first project to start matching employees to requirements."
            action={
              <Link href="/projects/new" className="btn-primary">
                New project
              </Link>
            }
          />
        ) : (
          <PortfolioTable rows={data.recentProjects} />
        )}
      </Card>
    </div>
  );
}