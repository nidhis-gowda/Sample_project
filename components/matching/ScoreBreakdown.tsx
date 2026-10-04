"use client";

import * as React from "react";
import { cn } from "@/utils/cn";
import { Badge, ProgressBar } from "@/components/ui/Card";
import { scoreBarColor } from "@/utils/badges";
import {
  MATCH_COMPONENT_LABELS,
  MATCH_WEIGHTS,
  type MatchComponentKey,
  type MatchResult,
  type SkillBreakdown,
} from "@/types/matching";
import { JOB_ROLE_LABELS } from "@/types";

/**
 * Transparent score presentation.
 *
 * Nothing here invents data: it renders exactly what `matchEmployee` returned -
 * the five component scores, their weights, the per-skill comparison, and the
 * generated reasons and warnings.
 */

const STATUS_STYLES: Record<SkillBreakdown["status"], string> = {
  strong: "badge-success",
  meets: "badge-brand",
  partial: "badge-warning",
  gap: "badge-danger",
  missing: "badge-danger",
};

/** ASCII symbols keep the output safe in any font/PDF context. */
const STATUS_SYMBOL: Record<SkillBreakdown["status"], string> = {
  strong: "+",
  meets: "=",
  partial: "!",
  gap: "x",
  missing: "x",
};

export const GRADE_BADGE: Record<MatchResult["grade"], string> = {
  STRONG: "badge-success",
  GOOD: "badge-brand",
  FAIR: "badge-warning",
  WEAK: "badge-danger",
};

/** Circular score indicator with an accessible text alternative. */
export function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-ink-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-700", {
            "stroke-success": score >= 85,
            "stroke-brand-500": score >= 70 && score < 85,
            "stroke-warning": score >= 55 && score < 70,
            "stroke-danger": score < 55,
          })}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-ink-900">
        {Math.round(score)}
      </span>
      <span className="sr-only">System Matching Score: {score} out of 100</span>
    </div>
  );
}

/** The five weighted components behind the overall score. */
export function ScoreBreakdown({ result }: { result: MatchResult }) {
  const keys = Object.keys(MATCH_WEIGHTS) as MatchComponentKey[];

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Score components
      </p>
      <ul className="space-y-2.5">
        {keys.map((key) => {
          const value = result.components[key];
          const weight = MATCH_WEIGHTS[key];
          return (
            <li key={key}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-700">
                  {MATCH_COMPONENT_LABELS[key]}
                  <span className="ml-1 text-ink-400">
                    x {Math.round(weight * 100)}%
                  </span>
                </span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {value.toFixed(1)}
                </span>
              </div>
              <ProgressBar
                value={value}
                colorClass={scoreBarColor(value)}
                className="mt-1 h-1.5"
                label={MATCH_COMPONENT_LABELS[key]}
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-2.5 text-xs text-ink-500">
        Weighted total
        <span className="font-semibold tabular-nums text-ink-900">
          {result.overallScore.toFixed(1)}
        </span>
        / 100
        <Badge className={GRADE_BADGE[result.grade]}>{result.grade}</Badge>
      </p>
    </div>
  );
}

/** Required vs. actual proficiency for every skill on the project. */
export function SkillComparison({ breakdown }: { breakdown: SkillBreakdown[] }) {
  if (breakdown.length === 0) {
    return (
      <p className="text-xs text-ink-500">
        This project has no skill requirements yet, so the skill component is neutral for
        every candidate.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Skill by skill
      </p>
      <div className="overflow-hidden rounded-lg border border-ink-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-ink-50 text-left text-[10px] uppercase tracking-wide text-ink-500">
              <th className="px-3 py-2 font-semibold">Skill</th>
              <th className="px-3 py-2 font-semibold">Required</th>
              <th className="px-3 py-2 font-semibold">Employee</th>
              <th className="px-3 py-2 font-semibold">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => (
              <tr key={item.skillId} className="border-t border-ink-100 align-top">
                <td className="px-3 py-2">
                  <span className="font-medium text-ink-800">{item.skillName}</span>
                  {item.importance === "OPTIONAL" ? (
                    <Badge className="badge-neutral ml-1.5">Optional</Badge>
                  ) : null}
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-500">
                    {item.explanation}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-700">
                  {item.requiredProficiency}/5
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-700">
                  {item.actualProficiency === null ? "-" : `${item.actualProficiency}/5`}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Badge className={STATUS_STYLES[item.status]}>
                    {STATUS_SYMBOL[item.status]} {Math.round(item.coverage * 100)}%
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The generated reasons and warnings for a recommendation. */
export function ReasonList({ result }: { result: MatchResult }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-success-ink">
          Why recommended
        </p>
        <ul className="space-y-1.5">
          {result.reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-xs leading-relaxed text-ink-700">
              <span className="mt-0.5 shrink-0 font-bold text-success">+</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {result.warnings.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning-ink">
            Watch out
          </p>
          <ul className="space-y-1.5">
            {result.warnings.map((warning) => (
              <li key={warning} className="flex gap-2 text-xs leading-relaxed text-ink-700">
                <span className="mt-0.5 shrink-0 font-bold text-warning">!</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Compact header line used on each recommendation row. */
export function CandidateHeader({
  result,
  rank,
}: {
  result: MatchResult;
  rank?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <ScoreRing score={result.overallScore} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">
          {rank !== undefined ? (
            <span className="mr-1.5 text-ink-400">#{rank}</span>
          ) : null}
          {result.employeeName}
        </p>
        <p className="text-xs text-ink-500">{JOB_ROLE_LABELS[result.jobRole]}</p>
        <p className="mt-0.5 text-[11px] text-ink-500">
          {result.requiredSkillsCovered}/{result.requiredSkillsTotal} required skills
          covered - projected workload {Math.round(result.projectedWorkloadPercent)}%
        </p>
      </div>
      <Badge className={GRADE_BADGE[result.grade]}>{result.grade}</Badge>
    </div>
  );
}