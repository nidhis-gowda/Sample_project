import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { containsRegex } from "@/lib/db/query";
import { EmployeeModel } from "@/models/Employee";
// Required for `.populate("departmentId")` — see the note in employeeService.
import { DepartmentModel } from "@/models/Department";
import { ProjectModel } from "@/models/Project";
import { SkillModel } from "@/models/Skill";
import { JOB_ROLE_LABELS, PROJECT_STATUS_LABELS } from "@/types";
import type { JobRole, ProjectStatus, SkillCategory } from "@/types";

/**
 * Global search used by the header search box.
 *
 * Results are deliberately narrow (id + label + one or two context fields) so
 * the top-bar dropdown stays fast, and every term is regex-escaped.
 */

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function searchEmployees(
  term: string,
  limit: number,
  restrictToActive: boolean
): Promise<SearchHit[]> {
  await connectDB();
  const regex = containsRegex(term);
  const docs = await EmployeeModel.find({
    $or: [{ name: regex }, { email: regex }, { employeeId: regex }],
    ...(restrictToActive ? { status: "ACTIVE" } : {}),
  })
    .populate("departmentId", "name")
    .select("name email employeeId jobRole departmentId status")
    .limit(limit)
    .lean();

  return docs.map((doc) => {
    const department =
      doc.departmentId && typeof doc.departmentId === "object" && "name" in doc.departmentId
        ? (doc.departmentId as { name?: string }).name
        : null;
    return {
      id: String(doc._id),
      title: doc.name,
      subtitle: `${doc.employeeId} · ${JOB_ROLE_LABELS[doc.jobRole as JobRole]}${
        department ? ` · ${department}` : ""
      }`,
      href: `/employees/${String(doc._id)}`,
    };
  });
}

export async function searchSkills(term: string, limit: number): Promise<SearchHit[]> {
  await connectDB();
  const regex = containsRegex(term);
  const docs = await SkillModel.find({ $or: [{ name: regex }, { description: regex }] })
    .select("name category description")
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    title: doc.name,
    subtitle: `${doc.category as SkillCategory}`,
    href: `/skills/${String(doc._id)}`,
  }));
}

export async function searchProjects(term: string, limit: number): Promise<SearchHit[]> {
  await connectDB();
  const regex = containsRegex(term);
  const docs = await ProjectModel.find({
    $or: [{ name: regex }, { code: regex }, { clientName: regex }],
  })
    .select("name code status")
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    title: doc.name,
    subtitle: `${doc.code} · ${PROJECT_STATUS_LABELS[doc.status as ProjectStatus]}`,
    href: `/projects/${String(doc._id)}`,
  }));
}

/** Employees that hold a specific skill — used by the skill detail page. */
export async function employeesWithSkill(
  skillId: string,
  limit = 50
): Promise<Array<{ id: string; name: string; employeeId: string; proficiency: number }>> {
  await connectDB();
  if (!Types.ObjectId.isValid(skillId)) return [];
  const docs = await EmployeeModel.find({ "skills.skillId": new Types.ObjectId(skillId) })
    .select("name employeeId skills")
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    employeeId: doc.employeeId,
    proficiency:
      doc.skills.find((skill) => String(skill.skillId) === skillId)?.proficiency ?? 0,
  }));
}