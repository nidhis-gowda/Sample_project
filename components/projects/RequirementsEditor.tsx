"use client";

import * as React from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { Select } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Card";
import { PROFICIENCY_LABELS, type RequirementImportance } from "@/types";

/**
 * Dynamic editor for a project's required skills.
 *
 * Rows are held locally and submitted together with the rest of the project form
 * (`requirements` array), then validated server-side on save.
 */

export interface RequirementRow {
  skillId: string;
  requiredProficiency: number;
  importance: RequirementImportance;
}

export function RequirementsEditor({
  rows,
  onChange,
  availableSkills,
  disabled,
}: {
  rows: RequirementRow[];
  onChange: (rows: RequirementRow[]) => void;
  availableSkills: Array<{ id: string; name: string; category: string }>;
  disabled?: boolean;
}) {
  const used = new Set(rows.map((row) => row.skillId));
  const available = availableSkills.filter((skill) => !used.has(skill.id));

  const update = (index: number, patch: Partial<RequirementRow>) => {
    onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  };

  const add = (skillId: string) => {
    if (!skillId) return;
    onChange([...rows, { skillId, requiredProficiency: 3, importance: "REQUIRED" }]);
  };

  const remove = (index: number) =>
    onChange(rows.filter((_, position) => position !== index));

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-300 px-4 py-6 text-center">
          <p className="text-sm text-ink-600">No required skills defined yet.</p>
          <p className="mt-1 text-xs text-ink-500">
            Without requirements the matching score is neutral for every candidate.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const skill = availableSkills.find((item) => item.id === row.skillId);
            return (
              <li
                key={row.skillId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 px-3 py-2.5"
              >
                <div className="min-w-[9rem] flex-1">
                  <p className="text-sm font-medium text-ink-800">
                    {skill?.name ?? "Unknown skill"}
                  </p>
                  {skill ? (
                    <Badge className="badge-neutral mt-0.5">{skill.category}</Badge>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <label
                    className="text-xs text-ink-500"
                    htmlFor={`required-level-${row.skillId}`}
                  >
                    Required level
                  </label>
                  <Select
                    id={`required-level-${row.skillId}`}
                    value={row.requiredProficiency}
                    disabled={disabled}
                    onChange={(event) =>
                      update(index, { requiredProficiency: Number(event.target.value) })
                    }
                    className="h-8 w-32 py-0 text-xs"
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level} · {PROFICIENCY_LABELS[level]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-ink-500" htmlFor={`importance-${row.skillId}`}>
                    Importance
                  </label>
                  <Select
                    id={`importance-${row.skillId}`}
                    value={row.importance}
                    disabled={disabled}
                    onChange={(event) =>
                      update(index, {
                        importance: event.target.value as RequirementImportance,
                      })
                    }
                    className="h-8 w-28 py-0 text-xs"
                  >
                    <option value="REQUIRED">Required</option>
                    <option value="OPTIONAL">Optional</option>
                  </Select>
                </div>

                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="btn-ghost btn-xs p-1.5 text-danger hover:bg-danger-soft"
                  aria-label={`Remove ${skill?.name ?? "requirement"}`}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
        <label className="label" htmlFor="requirement-picker">
          Add a required skill
        </label>
        <Select
          id="requirement-picker"
          value=""
          disabled={disabled || available.length === 0}
          onChange={(event) => {
            add(event.target.value);
            event.target.value = "";
          }}
        >
          <option value="">
            {available.length === 0 ? "All catalogue skills added" : "Select a skill…"}
          </option>
          {available.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name} ({skill.category})
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-ink-500">
          Required skills count fully towards the score; optional skills count for half.
        </p>
      </div>
    </div>
  );
}