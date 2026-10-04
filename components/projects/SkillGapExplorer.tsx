"use client";

import * as React from "react";
import Link from "next/link";
import { useApiData } from "@/hooks/useApiData";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  ProgressBar,
  TableSkeleton,
} from "@/components/ui/Card";
import { BarChart } from "@/components/charts/Charts";
import { coverageBarColor } from "@/utils/badges";
import { formatDate } from "@/utils/format";
import type { SkillGapRow } from "@/services/analyticsService";

/** Skill gap analysis: required skills vs. the skills of the allocated team. */

export function SkillGapExplorer({ initialProjectId }: { initialProjectId?: string }) {
  const [expanded, setExpanded] = React.useState<string | null>(initialProjectId ?? null);

  const query = initialProjectId ? `?projectId=${initialProjectId}` : "";
  const { data, meta, loading, error } = useApiData<SkillGapRow[]>(
    `/api/skill-gaps${query}`
  );

  // Memoised so the identity is stable: `data ?? []` would otherwise allocate a
  // new array on every render and invalidate the chart memo below.
  const rows = React.useMemo(() => data ?? [], [data]);

  // Chart data is derived from the same rows the table shows.
  const chart = React.useMemo(() => {
    const withGaps = rows.filter((row) => row.gaps.length > 0);
    const counts = new Map<string, number>();
    for (const row of withGaps) {
      for (const gap of row.gaps) {
        counts.set(gap.skillName, (counts.get(gap.skillName) ?? 0) + 1);
      }
    }
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
      labels: entries.map(([name]) => name),
      values: entries.map(([, count]) => count),
    };
  }, [rows]);

  if (loading && !data) {
    return (
      <Card>
        <TableSkeleton rows={6} columns={5} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState message={error} />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No projects to analyse"
          description="Skill gaps are computed for active, planned and on-hold projects."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Projects analysed" value={Number(meta?.projectsAnalysed ?? rows.length)} />
        <Tile label="Projects with gaps" value={Number(meta?.projectsWithGaps ?? 0)} />
        <Tile label="Open skill gaps" value={Number(meta?.totalOpenGaps ?? 0)} />
        <Tile
          label="Average coverage"
          value={`${meta?.averageCoveragePercent ?? 0}%`}
        />
      </div>

      <Card>
        <CardHeader
          title="Most frequent gaps"
          subtitle="Skills that the allocated teams do not cover"
        />
        <CardBody>
          <BarChart
            labels={chart.labels}
            values={chart.values}
            horizontal
            height={Math.max(220, chart.labels.length * 32)}
            colors={["#dc2626"]}
            emptyLabel="Every project requirement is currently covered."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Coverage by project"
          subtitle="Select a row to see the skill-by-skill comparison"
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Deadline</th>
                <th>Team</th>
                <th>Coverage</th>
                <th>Missing skills</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <React.Fragment key={row.projectId}>
                  <tr>
                    <td>
                      <Link href={`/projects/${row.projectId}`} className="link font-medium">
                        {row.projectName}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {row.projectCode} &middot; {row.clientName}
                      </p>
                    </td>
                    <td className="text-sm">
                      {formatDate(row.deadline)}
                      <p
                        className={
                          row.daysRemaining <= 14 ? "text-xs text-danger" : "text-xs text-ink-500"
                        }
                      >
                        {row.daysRemaining < 0
                          ? `${Math.abs(row.daysRemaining)}d overdue`
                          : `${row.daysRemaining}d left`}
                      </p>
                    </td>
                    <td className="text-sm tabular-nums">
                      {row.allocatedCount}/{row.requiredTeamSize}
                    </td>
                    <td className="w-36">
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={row.overallCoveragePercent}
                          colorClass={coverageBarColor(row.overallCoveragePercent)}
                          className="h-1.5 flex-1"
                          label="Coverage"
                        />
                        <span className="w-11 text-right text-xs tabular-nums text-ink-700">
                          {row.overallCoveragePercent}%
                        </span>
                      </div>
                    </td>
                    <td>
                      {row.missingSkills.length === 0 ? (
                        <Badge className="badge-success">Fully covered</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.missingSkills.slice(0, 4).map((name) => (
                            <Badge key={name} className="badge-danger">
                              {name}
                            </Badge>
                          ))}
                          {row.missingSkills.length > 4 ? (
                            <Badge className="badge-neutral">
                              +{row.missingSkills.length - 4}
                            </Badge>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() =>
                          setExpanded((current) =>
                            current === row.projectId ? null : row.projectId
                          )
                        }
                        aria-expanded={expanded === row.projectId}
                      >
                        {expanded === row.projectId ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>

                  {expanded === row.projectId ? (
                    <tr>
                      <td colSpan={6} className="bg-ink-50/60">
                        <div className="py-2">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                            Skill coverage detail
                          </p>
                          {row.gaps.length === 0 ? (
                            <p className="text-sm text-ink-600">
                              Every required skill is covered by the allocated team.
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {row.gaps.map((gap) => (
                                <li
                                  key={gap.skillId}
                                  className="flex flex-wrap items-center justify-between gap-2 text-xs"
                                >
                                  <span className="text-ink-700">
                                    {gap.skillName}{" "}
                                    <Badge className="badge-neutral ml-1">
                                      {gap.importance}
                                    </Badge>
                                  </span>
                                  <span className="tabular-nums text-ink-500">
                                    best {gap.bestProficiency ?? 0}/{gap.requiredProficiency} (
                                    {gap.coveragePercent}%)
                                    {gap.bestEmployeeName
                                      ? ` · ${gap.bestEmployeeName}`
                                      : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-3 flex gap-2">
                            <Link
                              href={`/allocation/recommend?projectId=${row.projectId}`}
                              className="btn-primary btn-xs"
                            >
                              Find candidates for the missing skills
                            </Link>
                            <Link href={`/projects/${row.projectId}`} className="btn-secondary btn-xs">
                              Open project
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}