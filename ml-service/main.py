"""
Optional Python matching service.

This is a *mirror* of the TypeScript engine in `lib/matching/engine.ts`, exposed
over HTTP so the scoring can also be served from Python. It is entirely
optional: the Next.js application falls back to its own TypeScript engine
whenever this service is unreachable, so the product works without it.

Run it with:

    cd ml-service
    pip install -r requirements.txt
    uvicorn main:app --port 8000

Then set MATCHING_SERVICE_URL=http://127.0.0.1:8000 in the Next.js .env.local.

Privacy: the service is stateless. It receives the candidate pool and the
project requirements, and returns scored results. Nothing is persisted.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="SkillAlloc matching service",
    description="Optional Python mirror of the System Matching Score.",
    version="1.0.0",
)

# --------------------------------------------------------------------------
# Weights and tuning constants (kept identical to the TypeScript engine)
# --------------------------------------------------------------------------

MATCH_WEIGHTS: Dict[str, float] = {
    "skillMatch": 0.45,
    "experience": 0.15,
    "availability": 0.15,
    "workload": 0.15,
    "roleSuitability": 0.10,
}

OPTIONAL_SKILL_WEIGHT = 0.5
PROJECTED_WORKLOAD_ZERO_POINT = 130
PROJECTED_WORKLOAD_RANGE = 90
FAIR_SHARE_MIN = 10
FAIR_SHARE_MAX = 60
TIGHT_DEADLINE_DAYS = 14
TIGHT_DEADLINE_EXPERIENCE_MULTIPLIER = 1.25
ROLE_PREFERENCE_WEIGHT = 0.6
ROLE_AFFINITY_WEIGHT = 0.4

GRADE_THRESHOLDS = {"strong": 85, "good": 70, "fair": 55}

ROLE_SKILL_AFFINITY: Dict[str, List[str]] = {
    "PROJECT_MANAGER": ["Management", "Data"],
    "TECH_LEAD": [
        "Programming",
        "Backend",
        "Frontend",
        "Database",
        "Cloud",
        "DevOps",
        "Management",
    ],
    "BACKEND_DEVELOPER": ["Programming", "Backend", "Database", "Cloud"],
    "FRONTEND_DEVELOPER": ["Programming", "Frontend"],
    "FULLSTACK_DEVELOPER": ["Programming", "Frontend", "Backend", "Database"],
    "MOBILE_DEVELOPER": ["Programming", "Frontend", "Backend"],
    "QA_ENGINEER": ["Testing", "Programming"],
    "DEVOPS_ENGINEER": ["DevOps", "Cloud", "Security"],
    "DATA_ENGINEER": ["Data", "Database", "Programming", "Cloud"],
    "SECURITY_ENGINEER": ["Security", "DevOps", "Cloud"],
    "UI_UX_DESIGNER": ["Frontend", "Management"],
    "BUSINESS_ANALYST": ["Management", "Data"],
}

ROLE_FAMILIES: Dict[str, str] = {
    "PROJECT_MANAGER": "MANAGEMENT",
    "BUSINESS_ANALYST": "MANAGEMENT",
    "TECH_LEAD": "ENGINEERING",
    "BACKEND_DEVELOPER": "ENGINEERING",
    "FRONTEND_DEVELOPER": "ENGINEERING",
    "FULLSTACK_DEVELOPER": "ENGINEERING",
    "MOBILE_DEVELOPER": "ENGINEERING",
    "DEVOPS_ENGINEER": "PLATFORM",
    "SECURITY_ENGINEER": "PLATFORM",
    "DATA_ENGINEER": "DATA",
    "QA_ENGINEER": "QUALITY",
    "UI_UX_DESIGNER": "DESIGN",
}


# --------------------------------------------------------------------------
# Request / response models (wire-compatible with types/matching.ts)
# --------------------------------------------------------------------------


class SkillRequirement(BaseModel):
    skillId: str
    skillName: str
    category: str
    requiredProficiency: int = Field(ge=1, le=5)
    importance: Literal["REQUIRED", "OPTIONAL"] = "REQUIRED"


class EmployeeSkill(BaseModel):
    skillId: str
    skillName: str
    category: str
    proficiency: int = Field(ge=1, le=5)
    yearsOfExperience: float = 0


class Employee(BaseModel):
    employeeId: str
    name: str
    jobRole: str
    status: Optional[str] = "ACTIVE"
    yearsOfExperience: float = 0
    availabilityPercent: float = Field(default=100, ge=0, le=100)
    currentWorkloadPercent: float = 0
    skills: List[EmployeeSkill] = []
    calendarAvailabilityPercent: Optional[float] = None


class Project(BaseModel):
    projectId: str
    name: str
    requiredTeamSize: int = Field(default=1, ge=1)
    requiredExperienceYears: float = 0
    daysUntilDeadline: int = 0
    requirements: List[SkillRequirement] = []
    preferredRoles: List[str] = []


class MatchRequest(BaseModel):
    employees: List[Employee]
    project: Project


class MatchResponse(BaseModel):
    results: List[Dict[str, Any]]
    engine: Literal["python"] = "python"


# --------------------------------------------------------------------------
# Engine (mirrors lib/matching/engine.ts)
# --------------------------------------------------------------------------


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def round1(value: float) -> float:
    return round(value + 1e-9, 1)


def fair_share(team_size: int) -> float:
    size = max(1, int(round(team_size or 1)))
    return clamp(round(100 / size), FAIR_SHARE_MIN, FAIR_SHARE_MAX)


def skill_coverage_status(actual: Optional[int], required: int) -> str:
    if actual is None:
        return "missing"
    if required <= 0:
        return "strong" if actual > 0 else "gap"
    ratio = actual / required
    if ratio > 1:
        return "strong"
    if ratio == 1:
        return "meets"
    if ratio >= 0.6:
        return "partial"
    return "gap"


def explain_skill(name: str, required: int, actual: Optional[int], status: str) -> str:
    if status == "strong":
        return f"{name}: level {actual} exceeds the required level {required}."
    if status == "meets":
        return f"{name}: level {actual} exactly meets the requirement."
    if status == "partial":
        return f"{name}: level {actual} is close to the required level {required} but below it."
    if status == "gap":
        return f"{name}: level {actual} is well below the required level {required}."
    return f"{name}: skill is missing (required level {required})."


def compute_skill_match(
    requirements: List[SkillRequirement], skills: List[EmployeeSkill]
) -> Dict[str, Any]:
    by_id = {skill.skillId: skill for skill in skills}
    breakdown: List[Dict[str, Any]] = []

    for req in requirements:
        owned = by_id.get(req.skillId)
        actual = owned.proficiency if owned else None
        status = skill_coverage_status(actual, req.requiredProficiency)
        coverage = 0.0 if actual is None else clamp(actual / req.requiredProficiency, 0, 1) if req.requiredProficiency > 0 else 1.0
        breakdown.append(
            {
                "skillId": req.skillId,
                "skillName": req.skillName,
                "category": req.category,
                "importance": req.importance,
                "requiredProficiency": req.requiredProficiency,
                "actualProficiency": actual,
                "yearsOfExperience": owned.yearsOfExperience if owned else 0,
                "coverage": round(coverage, 4),
                "status": status,
                "explanation": explain_skill(
                    req.skillName, req.requiredProficiency, actual, status
                ),
            }
        )

    if not breakdown:
        return {"score": 100.0, "breakdown": []}

    weighted = 0.0
    weight_sum = 0.0
    for item in breakdown:
        weight = 1.0 if item["importance"] == "REQUIRED" else OPTIONAL_SKILL_WEIGHT
        weighted += item["coverage"] * weight
        weight_sum += weight

    return {
        "score": round1((weighted / weight_sum) * 100) if weight_sum else 0.0,
        "breakdown": breakdown,
    }


def compute_experience_score(
    employee_years: float, required_years: float, days_until_deadline: int
) -> Dict[str, Any]:
    tight = days_until_deadline <= TIGHT_DEADLINE_DAYS
    multiplier = TIGHT_DEADLINE_EXPERIENCE_MULTIPLIER if tight else 1.0
    effective = max(1.0, required_years * multiplier)
    score = round1(clamp(employee_years / effective, 0, 1) * 100)
    return {
        "score": score,
        "effectiveRequiredYears": round(effective, 2),
        "tightDeadline": tight,
    }


def compute_availability_score(declared: float, calendar: Optional[float]) -> Dict[str, float]:
    declared = clamp(declared, 0, 100)
    if calendar is None:
        return {"score": round1(declared), "effectivePercent": declared}
    effective = round((declared + clamp(calendar, 0, 100)) / 2)
    return {"score": round1(effective), "effectivePercent": effective}


def compute_workload_score(current: float, share: float) -> Dict[str, float]:
    current = max(0.0, current)
    projected = round((current + share) * 10) / 10
    score = round1(
        clamp(
            (PROJECTED_WORKLOAD_ZERO_POINT - projected) / PROJECTED_WORKLOAD_RANGE, 0, 1
        )
        * 100
    )
    return {"score": score, "projected": projected}


def compute_role_suitability(
    role: str, requirements: List[SkillRequirement], preferred_roles: List[str]
) -> float:
    preferred = [item for item in preferred_roles if item]
    if not preferred:
        preference = 100.0
    elif role in preferred:
        preference = 100.0
    elif any(ROLE_FAMILIES.get(item) == ROLE_FAMILIES.get(role) for item in preferred):
        preference = 70.0
    else:
        preference = 35.0

    affinity = 100.0
    if requirements:
        categories = ROLE_SKILL_AFFINITY.get(role, [])
        covered = sum(1 for req in requirements if req.category in categories)
        affinity = round1((covered / len(requirements)) * 100)

    return round1(preference * ROLE_PREFERENCE_WEIGHT + affinity * ROLE_AFFINITY_WEIGHT)


def grade_for(score: float) -> str:
    if score >= GRADE_THRESHOLDS["strong"]:
        return "STRONG"
    if score >= GRADE_THRESHOLDS["good"]:
        return "GOOD"
    if score >= GRADE_THRESHOLDS["fair"]:
        return "FAIR"
    return "WEAK"


def match_employee(employee: Employee, project: Project) -> Dict[str, Any]:
    skill_result = compute_skill_match(project.requirements, employee.skills)
    breakdown = skill_result["breakdown"]

    experience = compute_experience_score(
        employee.yearsOfExperience,
        project.requiredExperienceYears,
        project.daysUntilDeadline,
    )
    availability = compute_availability_score(
        employee.availabilityPercent, employee.calendarAvailabilityPercent
    )
    share = fair_share(project.requiredTeamSize)
    workload = compute_workload_score(employee.currentWorkloadPercent, share)
    role_score = compute_role_suitability(
        employee.jobRole, project.requirements, project.preferredRoles
    )

    components = {
        "skillMatch": skill_result["score"],
        "experience": experience["score"],
        "availability": availability["score"],
        "workload": workload["score"],
        "roleSuitability": role_score,
    }
    overall = round1(sum(components[key] * MATCH_WEIGHTS[key] for key in MATCH_WEIGHTS))

    required_items = [item for item in breakdown if item["importance"] == "REQUIRED"]
    covered = [item for item in required_items if item["status"] in ("strong", "meets")]

    reasons: List[str] = []
    for item in breakdown:
        if item["status"] == "strong":
            reasons.append(
                f"Strong {item['skillName']} experience "
                f"(level {item['actualProficiency']}/5)."
            )
        elif item["status"] == "meets":
            reasons.append(
                f"Meets the required {item['skillName']} level "
                f"({item['requiredProficiency']}/5)."
            )
    if not reasons:
        reasons.append(
            "No single outstanding factor - this is the best overall compromise "
            "across all scoring dimensions."
        )

    warnings: List[str] = []
    for item in breakdown:
        if item["status"] == "missing":
            warnings.append(
                f"{item['skillName']} is missing from this employee's profile "
                f"(required {item['requiredProficiency']}/5)."
            )
        elif item["status"] in ("gap", "partial"):
            warnings.append(
                f"{item['skillName']} proficiency below requirement "
                f"({item['actualProficiency']} vs {item['requiredProficiency']} required)."
            )
    if employee.currentWorkloadPercent > 100:
        warnings.append(
            f"Already overallocated at {employee.currentWorkloadPercent}% before this allocation."
        )
    elif workload["projected"] > 100:
        warnings.append(
            f"Projected workload of {workload['projected']}% exceeds 100% - "
            "consider reducing other allocations."
        )
    if not breakdown:
        warnings.append(
            "Project has no skill requirements yet, so the skill component is "
            "neutral for everyone."
        )

    return {
        "employeeId": employee.employeeId,
        "employeeName": employee.name,
        "jobRole": employee.jobRole,
        "overallScore": overall,
        "components": components,
        "weights": MATCH_WEIGHTS,
        "skillBreakdown": breakdown,
        "matchedSkillIds": [i["skillId"] for i in breakdown if i["status"] in ("strong", "meets")],
        "missingSkillIds": [i["skillId"] for i in breakdown if i["status"] in ("gap", "missing")],
        "partialSkillIds": [i["skillId"] for i in breakdown if i["status"] == "partial"],
        "requiredSkillsCovered": len(covered),
        "requiredSkillsTotal": len(required_items),
        "projectedWorkloadPercent": workload["projected"],
        "fairShareAllocationPercent": share,
        "reasons": reasons,
        "warnings": warnings,
        "grade": grade_for(overall),
        "engine": "python",
    }


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------


@app.get("/health")
def health() -> Dict[str, Any]:
    """Liveness probe used by the Next.js service before trusting the engine."""
    return {"status": "ok", "engine": "python", "weights": MATCH_WEIGHTS}


@app.post("/match", response_model=MatchResponse)
def match(request: MatchRequest) -> MatchResponse:
    """Score every candidate against the project and return them ranked."""
    results = [match_employee(employee, request.project) for employee in request.employees]
    results.sort(
        key=lambda item: (
            -item["overallScore"],
            -item["components"]["skillMatch"],
            item["employeeName"],
        )
    )
    return MatchResponse(results=results)