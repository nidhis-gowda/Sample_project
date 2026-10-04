import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { requirePageUser } from "@/lib/auth/rbac";
import { HttpError } from "@/lib/api/http-error";
import { getSkillById } from "@/services/skillService";
import { employeesWithSkill } from "@/services/searchService";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { ProficiencyDots } from "@/components/employees/SkillEditor";
import { PROFICIENCY_LABELS } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const skill = await getSkillById(id);
    return { title: skill.name };
  } catch {
    return { title: "Skill" };
  }
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser("skill:read");
  const { id } = await params;

  let skill;
  try {
    skill = await getSkillById(id);
  } catch (error) {
    // Both a malformed id (400) and a missing one (404) mean "no such skill".
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  const people = await employeesWithSkill(id);

  // Bucket employees by proficiency so the spread is visible at a glance.
  const byLevel = new Map<number, typeof people>();
  for (const person of people) {
    const bucket = byLevel.get(person.proficiency) ?? [];
    bucket.push(person);
    byLevel.set(person.proficiency, bucket);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/skills" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          Skill catalogue
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink-900">
                  {skill.name}
                </h1>
                <Badge className="badge-brand">{skill.category}</Badge>
              </div>
              {skill.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
                  {skill.description}
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-500">
                  No description recorded for this skill.
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tracking-tight text-ink-900">
                {skill.employeeCount}
              </p>
              <p className="text-xs text-ink-500">
                employee{skill.employeeCount === 1 ? "" : "s"} with this skill
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="People with this skill"
          subtitle="Proficiency levels recorded on each employee profile"
        />
        {people.length === 0 ? (
          <EmptyState
            title="Nobody has this skill yet"
            description="Add it to employee profiles so it can influence project matching."
          />
        ) : (
          <CardBody className="space-y-5">
            {[5, 4, 3, 2, 1]
              .filter((level) => (byLevel.get(level)?.length ?? 0) > 0)
              .map((level) => (
                <div key={level}>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Level {level} — {PROFICIENCY_LABELS[level]}
                    </p>
                    <Badge className="badge-neutral">
                      {byLevel.get(level)?.length ?? 0}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(byLevel.get(level) ?? []).map((person) => (
                      <Link
                        key={person.id}
                        href={`/employees/${person.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2 transition-colors hover:bg-ink-50"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-ink-800">
                          {person.name}
                        </span>
                        <ProficiencyDots level={person.proficiency} />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
          </CardBody>
        )}
      </Card>
    </div>
  );
}