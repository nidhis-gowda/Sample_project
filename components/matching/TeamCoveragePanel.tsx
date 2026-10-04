"use client";

import * as React from "react";
import { TrashIcon, UserGroupIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Card, CardBody, CardHeader, ProgressBar } from "@/components/ui/Card";
import { Input } from "@/components/ui/Form";
import { coverageBarColor } from "@/utils/badges";
import { PROFICIENCY_LABELS } from "@/types";
import type { TeamCoverageResult } from "@/types/matching";

/**
 * Team builder panel.
 *
 * Shows the selected team, live skill coverage (recomputed by the API as the
 * manager ticks candidates), the missing skills, and the per-member allocation
 * sliders submitted with the allocation request.
 */

export interface TeamMemberInput {
  employeeId: string;
  employeeName: string;
  allocationPercent: number;
  roleInProject: string;
}

export function TeamCoveragePanel({
  team,
  coverage,
  requiredTeamSize,
  onRemove,
  onPercentChange,
  onRoleChange,
  onClear,
  onAllocate,
  busy,
}: {
  team: TeamMemberInput[];
  coverage: TeamCoverageResult | null;
  requiredTeamSize: number;
  onRemove: (employeeId: string) => void;
  onPercentChange: (employeeId: string, allocationPercent: number) => void;
  onRoleChange: (employeeId: string, roleInProject: string) => void;
  onClear: () => void;
  onAllocate: () => void;
  busy: boolean;
}) {
  return (
    <Card className="xl:sticky xl:top-24">
      <CardHeader
        title="Selected team"
        subtitle={
          requiredTeamSize > 0
            ? `${team.length} of ${requiredTeamSize} required members`
            : `${team.length} selected`
        }
        actions={
          team.length > 0 ? (
            <button type="button" className="btn-ghost btn-xs" onClick={onClear}>
              Clear
            </button>
          ) : null
        }
      />

      {team.length === 0 ? (
        <CardBody>
          <div className="rounded-lg border border-dashed border-ink-300 px-4 py-8 text-center">
            <UserGroupIcon className="mx-auto h-7 w-7 text-ink-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-ink-700">No one selected yet</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Use &ldquo;Add to team&rdquo; on a candidate. Coverage updates live as you
              build the team.
            </p>
          </div>
        </CardBody>
      ) : (
        <CardBody className="space-y-4">
          <TeamMemberList
            team={team}
            onRemove={onRemove}
            onPercentChange={onPercentChange}
            onRoleChange={onRoleChange}
          />

          <CoverageSummary coverage={coverage} />

          <button
            type="button"
            className="btn-primary w-full"
            onClick={onAllocate}
            disabled={busy}
          >
            {busy ? "Allocating..." : `Allocate ${team.length} to the project`}
          </button>
        </CardBody>
      )}
    </Card>
  );
}

/** Editable list of the selected team members. */
function TeamMemberList({
  team,
  onRemove,
  onPercentChange,
  onRoleChange,
}: {
  team: TeamMemberInput[];
  onRemove: (employeeId: string) => void;
  onPercentChange: (employeeId: string, allocationPercent: number) => void;
  onRoleChange: (employeeId: string, roleInProject: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {team.map((member) => (
        <li key={member.employeeId} className="rounded-lg border border-ink-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <a
              href={`/employees/${member.employeeId}`}
              className="link truncate text-sm font-medium"
            >
              {member.employeeName}
            </a>
            <button
              type="button"
              onClick={() => onRemove(member.employeeId)}
              className="btn-ghost btn-xs p-1 text-danger hover:bg-danger-soft"
              aria-label={`Remove ${member.employeeName}`}
            >
              <TrashIcon className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <label className="text-[11px] text-ink-500" htmlFor={`role-${member.employeeId}`}>
              Role
            </label>
            <Input
              id={`role-${member.employeeId}`}
              value={member.roleInProject}
              onChange={(event) => onRoleChange(member.employeeId, event.target.value)}
              className="h-7 py-0 text-xs"
              maxLength={80}
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <label
              className="text-[11px] text-ink-500"
              htmlFor={`alloc-${member.employeeId}`}
            >
              Allocation
            </label>
            <input
              id={`alloc-${member.employeeId}`}
              type="range"
              min={5}
              max={100}
              step={5}
              value={member.allocationPercent}
              onChange={(event) =>
                onPercentChange(member.employeeId, Number(event.target.value))
              }
              className="h-1.5 flex-1 accent-brand-600"
            />
            <span className="w-9 text-right text-[11px] font-medium tabular-nums text-ink-700">
              {member.allocationPercent}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Live coverage readout for the currently selected team. */
export function CoverageSummary({ coverage }: { coverage: TeamCoverageResult | null }) {
  if (!coverage) {
    return (
      <div className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
        Coverage is recalculated by the API whenever the team changes.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-ink-700">Overall skill coverage</span>
          <span className="font-semibold tabular-nums text-ink-900">
            {coverage.overallCoveragePercent}%
          </span>
        </div>
        <ProgressBar
          value={coverage.overallCoveragePercent}
          colorClass={coverageBarColor(coverage.overallCoveragePercent)}
          className="mt-1.5"
          label="Overall coverage"
        />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="text-ink-500">Required covered</dt>
          <dd className="font-semibold tabular-nums text-ink-900">
            {coverage.requiredSkillsCovered}/{coverage.requiredSkillsTotal}
          </dd>
        </div>
        <div>
          <dt className="text-ink-500">Avg experience</dt>
          <dd className="font-semibold tabular-nums text-ink-900">
            {coverage.averageExperienceYears} yrs
          </dd>
        </div>
        <div>
          <dt className="text-ink-500">Team workload</dt>
          <dd className="font-semibold tabular-nums text-ink-900">
            {coverage.totalWorkloadPercent}%
          </dd>
        </div>
        <div>
          <dt className="text-ink-500">Avg availability</dt>
          <dd className="font-semibold tabular-nums text-ink-900">
            {coverage.averageAvailabilityPercent}%
          </dd>
        </div>
      </dl>

      {coverage.gaps.length > 0 ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-danger-ink">
            <SparklesIcon className="h-3 w-3" aria-hidden />
            Missing ({coverage.gaps.length})
          </p>
          <ul className="space-y-1">
            {coverage.gaps.map((gap) => (
              <li
                key={gap.skillId}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-ink-700">{gap.skillName}</span>
                <span className="shrink-0 tabular-nums text-ink-500">
                  {gap.bestProficiency ?? 0}/{gap.requiredProficiency} (
                  {PROFICIENCY_LABELS[gap.requiredProficiency]})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] font-medium text-success-ink">
          Every required skill is covered by this team.
        </p>
      )}
    </div>
  );
}