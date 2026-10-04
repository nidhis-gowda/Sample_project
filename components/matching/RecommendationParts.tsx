"use client";

import * as React from "react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import {
  CandidateHeader,
  ReasonList,
  ScoreBreakdown,
  SkillComparison,
} from "@/components/matching/ScoreBreakdown";
import { JOB_ROLE_LABELS, JOB_ROLES, type ProjectDTO } from "@/types";
import type { MatchResult } from "@/types/matching";

/** Project picker for the recommendation workspace. */
export function ProjectPicker({
  projects,
  projectId,
  onChange,
}: {
  projects: ProjectDTO[];
  projectId: string;
  onChange: (projectId: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Find employees for a project"
        subtitle="Candidates are scored against this project's requirements"
      />
      <CardBody>
        <Field label="Project" htmlFor="recommend-project" required>
          <Select
            id="recommend-project"
            value={projectId}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">Select a project…</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </Select>
        </Field>
      </CardBody>
    </Card>
  );
}

export function FiltersBar({
  filters,
  onChange,
  onToggle,
  onReset,
  open,
  departments,
  skills,
  summary,
  engine,
  fallbackReason,
  activeCount,
}: {
  filters: FilterValues;
  onChange: (key: keyof FilterValues) => (value: string) => void;
  onToggle: () => void;
  onReset: () => void;
  open: boolean;
  departments: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
  summary: string;
  engine?: string;
  fallbackReason?: string;
  activeCount: number;
}) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onToggle}
            aria-expanded={open}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden />
            Filters
            {activeCount > 0 ? <Badge className="badge-brand">{activeCount}</Badge> : null}
          </button>
          <span className="text-xs text-ink-500">{summary}</span>
          {engine === "python" ? (
            <Badge className="badge-info">Python engine</Badge>
          ) : engine === "typescript" ? (
            <Badge className="badge-neutral">TypeScript engine</Badge>
          ) : null}
          {fallbackReason ? (
            <span className="text-[11px] text-ink-400">{fallbackReason}</span>
          ) : null}
        </div>

        {open ? (
          <div className="grid gap-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Minimum score" htmlFor="filter-min-score">
              <Input
                id="filter-min-score"
                type="number"
                min={0}
                max={100}
                value={filters.minScore}
                onChange={(event) => onChange("minScore")(event.target.value)}
                placeholder="e.g. 70"
              />
            </Field>
            <Field label="Department" htmlFor="filter-rec-department">
              <Select
                id="filter-rec-department"
                value={filters.departmentId}
                onChange={(event) => onChange("departmentId")(event.target.value)}
              >
                <option value="">Any department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Job role" htmlFor="filter-rec-role">
              <Select
                id="filter-rec-role"
                value={filters.jobRole}
                onChange={(event) => onChange("jobRole")(event.target.value)}
              >
                <option value="">Any role</option>
                {JOB_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {JOB_ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Must have skill" htmlFor="filter-rec-skill">
              <Select
                id="filter-rec-skill"
                value={filters.skillId}
                onChange={(event) => onChange("skillId")(event.target.value)}
              >
                <option value="">Any skill</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Min availability %" htmlFor="filter-min-availability">
              <Input
                id="filter-min-availability"
                type="number"
                min={0}
                max={100}
                value={filters.minAvailability}
                onChange={(event) => onChange("minAvailability")(event.target.value)}
                placeholder="e.g. 40"
              />
            </Field>
            <Field label="Min experience (years)" htmlFor="filter-min-experience">
              <Input
                id="filter-min-experience"
                type="number"
                min={0}
                max={60}
                value={filters.minExperience}
                onChange={(event) => onChange("minExperience")(event.target.value)}
                placeholder="e.g. 3"
              />
            </Field>
            <Field label="Max projected workload %" htmlFor="filter-max-workload">
              <Input
                id="filter-max-workload"
                type="number"
                min={0}
                max={300}
                value={filters.maxWorkload}
                onChange={(event) => onChange("maxWorkload")(event.target.value)}
                placeholder="e.g. 120"
              />
            </Field>
            <Field label="Results to show" htmlFor="filter-limit">
              <Select
                id="filter-limit"
                value={filters.limit}
                onChange={(event) => onChange("limit")(event.target.value)}
              >
                {[10, 15, 25, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="button" className="btn-ghost btn-xs" onClick={onReset}>
                Reset all filters
              </button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
/** Filter values shared between the toolbar and the API query string. */
/* ------------------------------------------------------------------ */
/* Candidate row                                                       */
/* ------------------------------------------------------------------ */

export function CandidateRow({
  result,
  rank,
  expanded,
  inTeam,
  comparing,
  canAllocate,
  onToggleExpand,
  onToggleTeam,
  onToggleCompare,
}: {
  result: MatchResult;
  rank: number;
  expanded: boolean;
  inTeam: boolean;
  comparing: boolean;
  canAllocate: boolean;
  onToggleExpand: () => void;
  onToggleTeam: () => void;
  onToggleCompare: () => void;
}) {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <CandidateHeader result={result} rank={rank} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn-ghost btn-xs"
            onClick={onToggleCompare}
            aria-pressed={comparing}
          >
            {comparing ? "Comparing" : "Compare"}
          </button>
          {canAllocate ? (
            <button
              type="button"
              className={inTeam ? "btn-success btn-xs" : "btn-secondary btn-xs"}
              onClick={onToggleTeam}
            >
              {inTeam ? "In team" : "Add to team"}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-ghost btn-xs"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            {expanded ? "Hide" : "Details"}
          </button>
          <a href={`/employees/${result.employeeId}`} className="btn-ghost btn-xs">
            Profile
          </a>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-5 rounded-lg border border-ink-200 bg-ink-50/50 p-4 lg:grid-cols-2">
          <div className="space-y-5">
            <ScoreBreakdown result={result} />
            <ReasonList result={result} />
          </div>
          <SkillComparison breakdown={result.skillBreakdown} />
        </div>
      ) : null}
    </li>
  );
}
export interface FilterValues {
  minScore: string;
  departmentId: string;
  jobRole: string;
  skillId: string;
  minAvailability: string;
  minExperience: string;
  maxWorkload: string;
  limit: string;
}