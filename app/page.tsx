import Link from "next/link";
import {
  ArrowRightIcon,
  BoltIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { getSessionUser } from "@/lib/auth/rbac";
import { PublicHeader } from "@/components/layout/PublicHeader";
import type { ComponentType } from "react";

export const dynamic = "force-dynamic";

interface Feature {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: MagnifyingGlassIcon,
    title: "Explainable matching",
    body: "Every recommendation shows the five scored components, the per-skill comparison and the exact reasons behind it.",
  },
  {
    icon: UsersIcon,
    title: "Live workload tracking",
    body: "Allocation percentages roll up per employee so nobody is quietly pushed past 100%.",
  },
  {
    icon: BoltIcon,
    title: "Skill gap analysis",
    body: "Compare required project skills with the allocated team and see exactly what is missing.",
  },
  {
    icon: ChartBarIcon,
    title: "Company analytics",
    body: "Utilisation, staffing, department mix and skill distribution — computed from live data.",
  },
  {
    icon: SparklesIcon,
    title: "Training recommendations",
    body: "Turn each gap into a concrete course from the internal catalogue.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Real authorization",
    body: "Roles are enforced on the server for every API call, not just hidden in the interface.",
  },
];

const SCORE_WEIGHTS = [
  { label: "Skill match", value: 45 },
  { label: "Experience", value: 15 },
  { label: "Availability", value: 15 },
  { label: "Workload", value: 15 },
  { label: "Role suitability", value: 10 },
];
export default async function LandingPage() {
  const user = await getSessionUser();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "SkillAlloc";

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader
        appName={appName}
        signedInName={user?.name ?? null}
        signedInRole={user?.role ?? null}
      />

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-ink-50"
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1400px] px-4 py-16 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="badge-brand">
                <CheckBadgeIcon className="h-3.5 w-3.5" aria-hidden />
                Deterministic scoring · fully explainable
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink-900 lg:text-5xl">
                Put the right people on the right project — and show your working.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-600">
                {appName} keeps employee skills, certifications and availability in one
                place, then scores every candidate against a project&apos;s real requirements
                so a project manager can decide with evidence instead of guesswork.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={user ? "/dashboard" : "/login"} className="btn-primary px-5 py-2.5">
                  {user ? "Open the dashboard" : "Sign in with Google"}
                  <ArrowRightIcon className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/about" className="btn-secondary px-5 py-2.5">
                  How the scoring works
                </Link>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
                {[
                  { label: "Scoring components", value: "5" },
                  { label: "Skills in the catalogue", value: "25+" },
                  { label: "Roles supported", value: "3" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-ink-200 bg-white p-4">
                    <dt className="text-xs text-ink-500">{item.label}</dt>
                    <dd className="mt-1 text-2xl font-semibold text-ink-900">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <ScoreExplainerPanel />
          </div>
        </div>
      </section>

      <section className="border-t border-ink-200 bg-ink-50/60 py-16">
        <div className="mx-auto max-w-[1400px] px-4 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            Everything a delivery team needs
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Employees, skills, projects, allocations, workload, skill gaps, training,
            notifications and downloadable reports — all backed by MongoDB.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-ink-900">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-ink-500 lg:flex-row lg:px-8">
          <p>
            © {new Date().getFullYear()} {appName}. Built with Next.js, MongoDB and Auth.js.
          </p>
          <div className="flex gap-5">
            <Link href="/about" className="link">
              About
            </Link>
            <Link href="/login" className="link">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Visual explanation of the matching weights shown on the landing page. */
function ScoreExplainerPanel() {
  return (
    <div className="card p-6">
      <p className="card-title">System Matching Score</p>
      <p className="card-subtitle">
        A weighted, reproducible score from 0–100 — never an objective judgement.
      </p>
      <ul className="mt-5 space-y-3">
        {SCORE_WEIGHTS.map((weight) => (
          <li key={weight.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-700">{weight.label}</span>
              <span className="font-semibold tabular-nums text-ink-900">{weight.value}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${weight.value * 2}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 rounded-lg bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
        Total = Skill×0.45 + Experience×0.15 + Availability×0.15 + Workload×0.15 + Role×0.10.
        The same inputs always produce the same score, and the interface shows every input
        that produced it.
      </p>
    </div>
  );
}