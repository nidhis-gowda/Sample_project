import type { EmployeeMatchInput, SkillRequirementInput } from "@/types/matching";
import type { TeamCoverageResult, TeamCoverageSkill } from "@/types/matching";
import { OPTIONAL_SKILL_WEIGHT } from "./constants";
import { clamp, round1, skillCoverageValue } from "./engine";

/**
 * Aggregate skill coverage of a candidate/selected team against a project's
 * requirements. Used by the Team Builder and the Skill Gap analysis.
 *
 * Coverage for a skill is the *best* proficiency present in the team, because a
 * single strong member is enough to cover a requirement.
 */
export function computeTeamCoverage(
  requirements: SkillRequirementInput[],
  members: EmployeeMatchInput[]
): TeamCoverageResult {
  const skills: TeamCoverageSkill[] = requirements.map((req) => {
    let bestProficiency: number | null = null;
    let bestEmployeeId: string | null = null;
    let bestEmployeeName: string | null = null;

    for (const member of members) {
      const skill = member.skills.find((s) => s.skillId === req.skillId);
      if (!skill) continue;
      if (bestProficiency === null || skill.proficiency > bestProficiency) {
        bestProficiency = skill.proficiency;
        bestEmployeeId = member.employeeId;
        bestEmployeeName = member.name;
      }
    }

    const coveragePercent = round1(
      skillCoverageValue(bestProficiency, req.requiredProficiency) * 100
    );

    return {
      skillId: req.skillId,
      skillName: req.skillName,
      category: req.category,
      importance: req.importance,
      requiredProficiency: req.requiredProficiency,
      bestProficiency,
      bestEmployeeId,
      bestEmployeeName,
      coveragePercent,
      covered: coveragePercent >= 100,
    };
  });

  const required = skills.filter((s) => s.importance === "REQUIRED");
  const optional = skills.filter((s) => s.importance === "OPTIONAL");

  const weightedSum =
    required.reduce((acc, s) => acc + s.coveragePercent, 0) +
    optional.reduce((acc, s) => acc + s.coveragePercent * OPTIONAL_SKILL_WEIGHT, 0);
  const weightTotal = required.length + optional.length * OPTIONAL_SKILL_WEIGHT;

  const avg = (values: number[]): number =>
    values.length === 0 ? 0 : round1(values.reduce((a, b) => a + b, 0) / values.length);

  return {
    overallCoveragePercent: weightTotal === 0 ? 0 : round1(weightedSum / weightTotal),
    requiredCoveragePercent: avg(required.map((s) => s.coveragePercent)),
    optionalCoveragePercent: avg(optional.map((s) => s.coveragePercent)),
    skills,
    gaps: skills
      .filter((s) => !s.covered)
      .sort((a, b) => a.coveragePercent - b.coveragePercent),
    requiredSkillsTotal: required.length,
    requiredSkillsCovered: required.filter((s) => s.covered).length,
    averageExperienceYears: avg(members.map((m) => m.yearsOfExperience)),
    totalWorkloadPercent: round1(
      members.reduce((acc, m) => acc + Math.max(0, m.currentWorkloadPercent), 0)
    ),
    averageAvailabilityPercent: avg(
      members.map((m) => clamp(m.availabilityPercent, 0, 100))
    ),
    memberCount: members.length,
  };
}