import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/rbac";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { MATCH_WEIGHTS, MATCH_COMPONENT_LABELS } from "@/types/matching";
import { UTILIZATION_THRESHOLDS } from "@/lib/matching/constants";
import { UTILIZATION_BAND_LABELS } from "@/types";

export const dynamic = "force-dynamic";

const COMPONENT_EXPLAINER: Record<string, string> = {
  skillMatch:
    "Every required skill is compared with the employee proficiency (1-5). Meeting or exceeding the requirement scores 100%. Optional skills count for half as much as required skills.",
  experience:
    "Years of experience against the project requirement. Deadlines within 14 days raise the expectation by 25%, because short windows need proven delivery.",
  availability:
    "The availability percentage the employee has set, optionally adjusted by their Google Calendar free/busy ratio when a calendar is connected.",
  workload:
    "The projected total allocation after adding this project fair-share percentage. The score decays as the projected total approaches 130%.",
  roleSuitability:
    "60% from an explicit role preference on the project, 40% from how well the employee role naturally fits the required skill categories.",
};

const STACK = [
  {
    title: "Next.js + TypeScript",
    body: "App Router with React Server Components for reads and Route Handlers for writes. Business logic lives in services, never inside a page.",
  },
  {
    title: "MongoDB + Mongoose",
    body: "Collections for users, employees, skills, projects, allocations, workloads, training, notifications, departments and settings, with indexes on commonly searched fields.",
  },
  {
    title: "Auth.js (NextAuth v5)",
    body: "Google OAuth with a JWT session. The role is re-synchronised with the database every two minutes so an admin role change applies without a re-login.",
  },
  {
    title: "Zod validation",
    body: "Every request body and query string is validated server-side; errors return field-level messages that the forms render inline.",
  },
  {
    title: "Chart.js",
    body: "Free, open-source charting rendered client-side. No paid dashboard or BI service is involved.",
  },
  {
    title: "pdf-lib",
    body: "PDF reports are generated in-process and CSV by a small hand-written writer. No external or paid service.",
  },
];

/** Public explanation of the product, the scoring model and the architecture. */
export default async function AboutPage() {
  const user = await getSessionUser();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "SkillAlloc";

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader
        appName={appName}
        signedInName={user?.name ?? null}
        signedInRole={user?.role ?? null}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8 lg:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">About {appName}</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-600">
          A resource and skills allocation platform for IT delivery teams. It exists to
          answer one question well: <em>who should work on this project, and why?</em>
        </p>

        <section className="mt-12">
          <h2 className="section-title">The System Matching Score</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
            The score is a transparent, deterministic calculation. It is not a
            machine-learning prediction and not an objective judgement of a person. It is
            decision support. The same data always produces the same number, and the
            application always shows the components that produced it.
          </p>

          <div className="card mt-6 overflow-hidden">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Weight</th>
                    <th>How it is calculated</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(MATCH_WEIGHTS).map(([key, weight]) => (
                    <tr key={key}>
                      <td className="font-medium text-ink-900">
                        {MATCH_COMPONENT_LABELS[key as keyof typeof MATCH_COMPONENT_LABELS]}
                      </td>
                      <td className="tabular-nums">{Math.round(weight * 100)}%</td>
                      <td className="max-w-xl text-ink-600">{COMPONENT_EXPLAINER[key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-4 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm text-info-ink">
            Overall score = Skill x 0.45 + Experience x 0.15 + Availability x 0.15 +
            Workload x 0.15 + Role x 0.10, rounded to one decimal place.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="section-title">Workload bands</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
            An employee total allocation is the sum of the percentages of every ACTIVE
            allocation they hold.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { band: "AVAILABLE", range: `0-${UTILIZATION_THRESHOLDS.available}%` },
              {
                band: "MODERATE",
                range: `${UTILIZATION_THRESHOLDS.available + 1}-${UTILIZATION_THRESHOLDS.moderate}%`,
              },
              {
                band: "HIGH",
                range: `${UTILIZATION_THRESHOLDS.moderate + 1}-${UTILIZATION_THRESHOLDS.high}%`,
              },
              { band: "OVERALLOCATED", range: `above ${UTILIZATION_THRESHOLDS.high}%` },
            ].map((item) => (
              <div key={item.band} className="card p-4">
                <p className="text-sm font-semibold text-ink-900">
                  {UTILIZATION_BAND_LABELS[item.band as keyof typeof UTILIZATION_BAND_LABELS]}
                </p>
                <p className="mt-1 text-xs text-ink-500">{item.range}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-600">
            Allocating someone above 100% is blocked with a clear warning; the manager must
            explicitly confirm the over-allocation.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="section-title">How it is built</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STACK.map((item) => (
              <div key={item.title} className="card p-5">
                <h3 className="text-sm font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 rounded-xl border border-ink-200 bg-ink-50 p-6">
          <h2 className="text-sm font-semibold text-ink-900">Ready to try it?</h2>
          <p className="mt-1 text-sm text-ink-600">
            Sign in with Google, or run the seed script to load demo data first.
          </p>
          <Link href={user ? "/dashboard" : "/login"} className="btn-primary mt-4">
            {user ? "Open the dashboard" : "Sign in"}
          </Link>
        </div>
      </main>
    </div>
  );
}