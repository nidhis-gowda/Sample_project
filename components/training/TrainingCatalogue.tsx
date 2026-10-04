"use client";

import * as React from "react";
import { useApiData, useDebounced } from "@/hooks/useApiData";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { PROFICIENCY_LABELS, TRAINING_LEVELS, type TrainingLevel } from "@/types";
import type { TrainingDTO } from "@/services/trainingService";
import { humanize } from "@/utils/format";

/** Internal training catalogue (no paid external provider is involved). */

export function TrainingCatalogue({ isEmployee }: { isEmployee: boolean }) {
  const [search, setSearch] = React.useState("");
  const [level, setLevel] = React.useState("");

  const debounced = useDebounced(search, 300);

  const query = new URLSearchParams();
  if (debounced.trim()) query.set("q", debounced.trim());
  if (level) query.set("level", level);

  const { data, loading, error } = useApiData<TrainingDTO[]>(
    `/api/training${query.toString() ? `?${query}` : ""}`
  );
  const courses = data ?? [];

  // Group by skill so the catalogue reads as "what can I learn for each skill".
  const bySkill = new Map<string, TrainingDTO[]>();
  for (const course of courses) {
    const bucket = bySkill.get(course.skillName) ?? [];
    bucket.push(course);
    bySkill.set(course.skillName, bucket);
  }

  return (
    <Card>
      <CardHeader
        title="Training catalogue"
        subtitle={
          loading
            ? "Loading..."
            : `${courses.length} course${courses.length === 1 ? "" : "s"} across ${
                bySkill.size
              } skill${bySkill.size === 1 ? "" : "s"}`
        }
      />

      {isEmployee ? (
        <div className="border-b border-ink-200 bg-brand-50/40 px-4 py-3 text-xs text-ink-600">
          Courses are recommended automatically on your profile and on any employee
          page where you have a skill gap. Use the filters below to browse everything.
        </div>
      ) : null}

      <div className="grid gap-3 border-b border-ink-200 p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="training-search" className="label">
            Search
          </label>
          <Input
            id="training-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Course title, description or skill"
          />
        </div>
        <div>
          <label htmlFor="training-level" className="label">
            Level
          </label>
          <Select
            id="training-level"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">Any level</option>
            {TRAINING_LEVELS.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading && !data ? (
        <TrainingSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No courses found"
          description={
            debounced || level
              ? "Nothing matched the current filters."
              : "The training catalogue is empty."
          }
        />
      ) : (
        <div className="space-y-6 p-5">
          {[...bySkill.entries()].map(([skillName, list]) => (
            <div key={skillName}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                {skillName}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((course) => (
                  <div
                    key={course.id}
                    className="flex flex-col rounded-xl border border-ink-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-ink-900">{course.title}</h4>
                      {course.isInternal ? (
                        <Badge className="badge-brand">Internal</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-600">
                      {course.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge className="badge-neutral">{humanize(course.level)}</Badge>
                      <Badge className="badge-info">
                        To level {course.targetProficiency} (
                        {PROFICIENCY_LABELS[course.targetProficiency]})
                      </Badge>
                      <Badge className="badge-neutral">{course.durationHours}h</Badge>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-400">{course.provider}</p>
                    {course.url ? (
                      <a
                        href={course.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link mt-2 text-xs"
                      >
                        Course material
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TrainingSkeleton() {
  return (
    <div className="space-y-3 p-5" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}