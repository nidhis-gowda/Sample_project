"use client";

import * as React from "react";
import Link from "next/link";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useApiData, useDebounced } from "@/hooks/useApiData";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  ProgressBar,
  TableSkeleton,
} from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { Pagination } from "@/components/ui/Pagination";
import {
  PROJECT_PRIORITY_STYLES,
  PROJECT_STATUS_STYLES,
  coverageBarColor,
} from "@/utils/badges";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectDTO,
  type ProjectPriority,
  type ProjectStatus,
} from "@/types";
import { formatDate, humanize } from "@/utils/format";

/** Project portfolio with real filtering, sorting and pagination. */

const PAGE_SIZE = 12;

export function ProjectList({
  canCreate,
  showAllToggle,
}: {
  canCreate: boolean;
  /** PROJECT_MANAGERs can opt into the whole company portfolio. */
  showAllToggle?: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [sort, setSort] = React.useState("deadline");
  const [direction, setDirection] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(1);
  const [mine, setMine] = React.useState(true);

  const debounced = useDebounced(search, 300);
  React.useEffect(() => setPage(1), [debounced, status, priority, mine]);

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    sort,
    direction,
  });
  if (debounced.trim()) query.set("q", debounced.trim());
  if (status) query.set("status", status);
  if (priority) query.set("priority", priority);
  if (mine && showAllToggle) query.set("mine", "true");

  const { data, meta, loading, error } = useApiData<ProjectDTO[]>(
    `/api/projects?${query.toString()}`
  );
  const projects = data ?? [];
  const total = Number(meta?.total ?? 0);
return (
    <Card>
      <CardHeader
        title="Projects"
        subtitle={loading ? "Loading…" : `${total} project${total === 1 ? "" : "s"}`}
        actions={
          canCreate ? (
            <Link href="/projects/new" className="btn-primary btn-sm">
              <PlusIcon className="h-4 w-4" aria-hidden />
              New project
            </Link>
          ) : null
        }
      />

      <div className="grid gap-3 border-b border-ink-200 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="project-search" className="label">
            Search
          </label>
          <Input
            id="project-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, code or client"
          />
        </div>

        <div>
          <label htmlFor="project-status" className="label">
            Status
          </label>
          <Select
            id="project-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Any status</option>
            {PROJECT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PROJECT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="project-priority" className="label">
            Priority
          </label>
          <Select
            id="project-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">Any priority</option>
            {PROJECT_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="project-sort" className="label">
            Sort by
          </label>
          <div className="flex gap-2">
            <Select
              id="project-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="deadline">Deadline</option>
              <option value="name">Name</option>
              <option value="code">Code</option>
              <option value="priority">Priority</option>
              <option value="progress">Progress</option>
              <option value="createdAt">Created</option>
            </Select>
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => setDirection((value) => (value === "asc" ? "desc" : "asc"))}
              aria-label={direction === "asc" ? "Ascending" : "Descending"}
            >
              {direction === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>
      </div>

      {showAllToggle ? (
        <div className="flex items-center gap-3 border-b border-ink-200 bg-ink-50/60 px-4 py-2">
          <input
            id="mine-only"
            type="checkbox"
            checked={mine}
            onChange={(event) => setMine(event.target.checked)}
            className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="mine-only" className="text-xs text-ink-600">
            Only projects I manage
          </label>
        </div>
      ) : null}

      {loading && !data ? (
        <TableSkeleton rows={5} columns={5} />
      ) : error ? (
        <ErrorState message={error} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects match these filters"
          description="Clear a filter, or create the first project to start matching employees."
          action={
            canCreate ? (
              <Link href="/projects/new" className="btn-primary">
                <PlusIcon className="h-4 w-4" aria-hidden />
                New project
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {!loading && !error && projects.length > 0 ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      ) : null}
    </Card>
  );
}
function ProjectCard({ project }: { project: ProjectDTO }) {
  const staffing = project.staffingPercent ?? 0;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl border border-ink-200 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900 group-hover:text-brand-700">
            {project.name}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {project.code} · {project.clientName}
          </p>
        </div>
        <MagnifyingGlassIcon
          className="h-4 w-4 shrink-0 text-ink-300 group-hover:text-brand-500"
          aria-hidden
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge className={PROJECT_STATUS_STYLES[project.status as ProjectStatus]}>
          {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
        </Badge>
        <Badge className={PROJECT_PRIORITY_STYLES[project.priority as ProjectPriority]}>
          {humanize(project.priority)}
        </Badge>
      </div>

      <dl className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-ink-500">Deadline</dt>
          <dd
            className={
              (project.daysRemaining ?? 0) <= 14 ? "font-medium text-danger" : "text-ink-700"
            }
          >
            {formatDate(project.deadline)}
            {(project.daysRemaining ?? 0) <= 14 ? ` · ${project.daysRemaining}d` : ""}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-500">Team</dt>
          <dd className="text-ink-700">
            {project.allocatedCount ?? 0} / {project.requiredTeamSize}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-500">Skills required</dt>
          <dd className="text-ink-700">{project.requirements.length}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-ink-500">
          <span>Staffing</span>
          <span className="tabular-nums">{staffing}%</span>
        </div>
        <ProgressBar
          value={Math.min(100, staffing)}
          colorClass={coverageBarColor(staffing)}
          className="mt-1"
          label="Staffing"
        />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-ink-500">
          <span>Progress</span>
          <span className="tabular-nums">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} className="mt-1" label="Progress" />
      </div>
    </Link>
  );
}