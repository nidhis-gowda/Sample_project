import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { SkillGapExplorer } from "@/components/projects/SkillGapExplorer";

export const metadata: Metadata = { title: "Skill gaps" };
export const dynamic = "force-dynamic";

export default async function SkillGapsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  await requirePageUser("skillgap:read");
  const { projectId } = await searchParams;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">Skill gap analysis</h1>
        <p className="section-subtitle">
          Compares each project&apos;s required skills with the skills of the team that is
          actually allocated to it.
        </p>
      </header>

      <SkillGapExplorer initialProjectId={projectId} />
    </div>
  );
}