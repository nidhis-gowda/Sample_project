"use client";

import * as React from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Input, Select } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Card";
import { PROFICIENCY_LABELS, type EmployeeSkillDTO } from "@/types";
import { cn } from "@/utils/cn";

/**
 * Reusable editor for an employee's skill set (proficiency + years of experience).
 *
 * Rows are kept locally and submitted as a whole set to
 * `PUT /api/employees/:id/skills`, which replaces the set atomically.
 */

export interface SkillRow {
  skillId: string;
  proficiency: number;
  yearsOfExperience: number;
}

export function toRows(skills: EmployeeSkillDTO[]): SkillRow[] {
  return skills.map((skill) => ({
    skillId: skill.skillId,
    proficiency: skill.proficiency,
    yearsOfExperience: skill.yearsOfExperience,
  }));
}

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-ink-400",
  2: "bg-info",
  3: "bg-brand-500",
  4: "bg-warning",
  5: "bg-success",
};

/** Five dots showing a proficiency level, with its label. */
export function ProficiencyDots({ level }: { level: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${level}/5 - ${PROFICIENCY_LABELS[level]}`}
    >
      {[1, 2, 3, 4, 5].map((dot) => (
        <span
          key={dot}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dot <= level ? (LEVEL_COLORS[level] ?? "bg-brand-500") : "bg-ink-200"
          )}
          aria-hidden
        />
      ))}
      <span className="ml-1 text-[11px] text-ink-500">{PROFICIENCY_LABELS[level]}</span>
    </span>
  );
}

export function SkillEditor({
  rows,
  onChange,
  availableSkills,
  error,
  disabled,
}: {
  rows: SkillRow[];
  onChange: (rows: SkillRow[]) => void;
  availableSkills: Array<{ id: string; name: string; category: string }>;
  error?: string;
  disabled?: boolean;
}) {
  const [pickerValue, setPickerValue] = React.useState("");
  const [pickerProficiency, setPickerProficiency] = React.useState(3);
  const [pickerYears, setPickerYears] = React.useState(0);

  const used = new Set(rows.map((row) => row.skillId));
  const available = availableSkills.filter((skill) => !used.has(skill.id));

  const addSkill = () => {
    if (!pickerValue) return;
    onChange([
      ...rows,
      {
        skillId: pickerValue,
        proficiency: pickerProficiency,
        yearsOfExperience: pickerYears,
      },
    ]);
    setPickerValue("");
  };

  const update = (index: number, patch: Partial<SkillRow>) => {
    onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  };

  const remove = (index: number) =>
    onChange(rows.filter((_, position) => position !== index));

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-300 px-4 py-6 text-center text-sm text-ink-500">
          No skills recorded yet. Add the first one below.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const skill = availableSkills.find((item) => item.id === row.skillId);
            return (
              <li
                key={row.skillId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2.5"
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
                  <label className="text-xs text-ink-500" htmlFor={`proficiency-${row.skillId}`}>
                    Level
                  </label>
                  <Select
                    id={`proficiency-${row.skillId}`}
                    value={row.proficiency}
                    disabled={disabled}
                    onChange={(event) =>
                      update(index, { proficiency: Number(event.target.value) })
                    }
                    className="h-8 w-28 py-0 text-xs"
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level} - {PROFICIENCY_LABELS[level]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-ink-500" htmlFor={`years-${row.skillId}`}>
                    Years
                  </label>
                  <Input
                    id={`years-${row.skillId}`}
                    type="number"
                    min={0}
                    max={60}
                    step={0.5}
                    value={row.yearsOfExperience}
                    disabled={disabled}
                    onChange={(event) =>
                      update(index, { yearsOfExperience: Number(event.target.value) })
                    }
                    className="h-8 w-20 py-0 text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="btn-ghost btn-xs p-1.5 text-danger hover:bg-danger-soft"
                  aria-label={`Remove ${skill?.name ?? "skill"}`}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="skill-picker">
            Add a skill
          </label>
          <Select
            id="skill-picker"
            value={pickerValue}
            disabled={disabled || available.length === 0}
            onChange={(event) => setPickerValue(event.target.value)}
          >
            <option value="">
              {available.length === 0 ? "All catalogue skills added" : "Select a skill..."}
            </option>
            {available.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name} ({skill.category})
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="label" htmlFor="skill-picker-level">
            Level
          </label>
          <Select
            id="skill-picker-level"
            value={pickerProficiency}
            disabled={disabled}
            onChange={(event) => setPickerProficiency(Number(event.target.value))}
            className="w-32"
          >
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                {level} - {PROFICIENCY_LABELS[level]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="label" htmlFor="skill-picker-years">
            Years
          </label>
          <Input
            id="skill-picker-years"
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={pickerYears}
            disabled={disabled}
            onChange={(event) => setPickerYears(Number(event.target.value))}
            className="w-24"
          />
        </div>

        <button
          type="button"
          onClick={addSkill}
          disabled={disabled || !pickerValue}
          className="btn-secondary"
        >
          <PlusIcon className="h-4 w-4" aria-hidden />
          Add
        </button>
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}