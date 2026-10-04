import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { SkillManager } from "@/components/skills/SkillManager";

export const metadata: Metadata = { title: "Skills" };
export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const user = await requirePageUser("skill:read");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">Skill catalogue</h1>
        <p className="section-subtitle">
          The single source of truth for capabilities. Employee profiles and project
          requirements both reference these records.
        </p>
      </header>

      <SkillManager canManage={can(user.role, "skill:manage")} />
    </div>
  );
}