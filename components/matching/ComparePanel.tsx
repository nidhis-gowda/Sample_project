"use client";

import * as React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Card, CardBody, CardHeader, ProgressBar } from "@/components/ui/Card";
import { coverageBarColor } from "@/utils/badges";
import type { MatchComponentKey, MatchResult } from "@/types/matching";

/**
 * Side-by-side comparison of up to three ranked candidates.
 *
 * Rows are the five score components plus the raw inputs that drove them, so a
 * manager can see exactly where two similar candidates differ.
 */

const COMPARE_KEYS: MatchComponentKey[] = [
  "skillMatch",
  "experience",
  "availability",
  "workload",
  "roleSuitability",
];

function labelFor(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function ComparePanel({
  results,
  onRemove,
  onClear,
}: {
  results: MatchResult[];
  onRemove: (employeeId: string) => void;
  onClear: () => void;
}) {
  if (results.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title={`Compare (${results.length})`}
        subtitle="Highest score first"
        actions={
          <button type="button" className="btn-ghost btn-xs" onClick={onClear}>
            Clear
          </button>
        }
      />
      <CardBody className="space-y-4">
        <div className="space-y-2">
          {results.map((result) => (
            <div
              key={result.employeeId}
              className="flex items-center justify-between gap-2"
            >
              <a
                href={`/employees/${result.employeeId}`}
                className="link truncate text-sm"
              >
                {result.employeeName}
              </a>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-ink-900">
                  {result.overallScore.toFixed(1)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(result.employeeId)}
                  className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  aria-label={`Remove ${result.employeeName} from the comparison`}
                >
                  <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>

        <table className="w-full text-xs">
          <tbody>
            {COMPARE_KEYS.map((key) => (
              <tr key={key} className="border-t border-ink-100">
                <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink-600">
                  {labelFor(key)}
                </th>
                {results.map((result) => {
                  const value = result.components[key];
                  return (
                    <td key={result.employeeId} className="py-1.5 pl-2">
                      <div className="flex items-center gap-1.5">
                        <ProgressBar
                          value={value}
                          colorClass={coverageBarColor(value)}
                          className="h-1.5 w-12"
                          label={labelFor(key)}
                        />
                        <span className="tabular-nums text-ink-700">{value.toFixed(0)}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr className="border-t border-ink-100">
              <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink-600">
                Skills covered
              </th>
              {results.map((result) => (
                <td key={result.employeeId} className="py-1.5 pl-2 tabular-nums text-ink-700">
                  {result.requiredSkillsCovered}/{result.requiredSkillsTotal}
                </td>
              ))}
            </tr>

            <tr className="border-t border-ink-100">
              <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink-600">
                Projected workload
              </th>
              {results.map((result) => (
                <td key={result.employeeId} className="py-1.5 pl-2 tabular-nums text-ink-700">
                  {Math.round(result.projectedWorkloadPercent)}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}