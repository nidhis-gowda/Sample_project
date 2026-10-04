"""Tests for the optional Python matching service (`ml-service/main.py`).

Run with either:

    cd ml-service
    python -m unittest discover -s . -p "test_*.py"

    # or, from the repository root
    python -m pytest ml-service

The suite drives the *real* HTTP routes through starlette's `TestClient`, so the
FastAPI validation layer is covered too — not just the pure scoring functions.
"""

from __future__ import annotations

import os
import sys
import unittest
import warnings

# starlette ships a deprecated `httpx` shim inside TestClient. The warning is
# third-party noise about which HTTP client TestClient uses internally; it says
# nothing about this service. Silenced narrowly, and only here.
warnings.filterwarnings(
    "ignore",
    message=r"Using `httpx` with `starlette\.testclient` is deprecated",
)

# Make `import main` work no matter which directory the runner is invoked from.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

REQUIRED_SKILLS = [
    {
        "skillId": "s-python",
        "skillName": "Python",
        "category": "Programming",
        "requiredProficiency": 4,
        "importance": "REQUIRED",
    },
    {
        "skillId": "s-sql",
        "skillName": "SQL",
        "category": "Database",
        "requiredProficiency": 3,
        "importance": "REQUIRED",
    },
]


def employee(**overrides) -> dict:
    """A strong backend candidate; every field is overridable per test."""
    data = {
        "employeeId": "emp-1",
        "name": "Ada Lovelace",
        "jobRole": "BACKEND_DEVELOPER",
        "status": "ACTIVE",
        "yearsOfExperience": 8,
        "availabilityPercent": 90,
        "currentWorkloadPercent": 20,
        "skills": [
            {
                "skillId": "s-python",
                "skillName": "Python",
                "category": "Programming",
                "proficiency": 5,
                "yearsOfExperience": 4,
            },
            {
                "skillId": "s-sql",
                "skillName": "SQL",
                "category": "Database",
                "proficiency": 4,
                "yearsOfExperience": 4,
            },
        ],
        "calendarAvailabilityPercent": None,
    }
    data.update(overrides)
    return data


def project(**overrides) -> dict:
    data = {
        "projectId": "prj-1",
        "name": "Banking Modernisation",
        "requiredTeamSize": 3,
        "requiredExperienceYears": 4,
        "daysUntilDeadline": 60,
        "requirements": [dict(item) for item in REQUIRED_SKILLS],
        "preferredRoles": ["BACKEND_DEVELOPER"],
    }
    data.update(overrides)
    return data


class MatchingServiceTestCase(unittest.TestCase):
    """Shared plumbing: a TestClient plus a `match()` helper."""

    def setUp(self) -> None:
        self.client = TestClient(main.app)

    def match(self, employees, proj=None):
        response = self.client.post(
            "/match", json={"employees": employees, "project": proj or project()}
        )
        self.assertEqual(
            response.status_code, 200, msg=f"unexpected status: {response.text}"
        )
        return response.json()


class HealthRouteTest(MatchingServiceTestCase):
    def test_health_reports_engine_and_weights(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)

        body = response.json()
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["engine"], "python")
        self.assertAlmostEqual(sum(body["weights"].values()), 1.0, places=6)

    def test_health_weights_are_identical_to_the_typescript_engine(self):
        """If the weights diverge, the two engines cannot produce equal scores."""
        weights = self.client.get("/health").json()["weights"]
        self.assertEqual(
            weights,
            {
                "skillMatch": 0.45,
                "experience": 0.15,
                "availability": 0.15,
                "workload": 0.15,
                "roleSuitability": 0.10,
            },
        )


class MatchRouteTest(MatchingServiceTestCase):
    def test_response_is_tagged_as_the_python_engine(self):
        body = self.match([employee()])
        self.assertEqual(body["engine"], "python")
        self.assertEqual(body["results"][0]["engine"], "python")
        self.assertEqual(len(body["results"]), 1)

    def test_fixture_produces_a_stable_score_vector(self):
        """Golden test: guards against accidental changes to the scoring maths."""
        result = self.match([employee()])["results"][0]

        self.assertEqual(result["overallScore"], 96.3)
        self.assertEqual(
            result["components"],
            {
                "skillMatch": 100.0,
                "experience": 100.0,
                "availability": 90.0,
                "workload": 85.6,
                "roleSuitability": 100.0,
            },
        )
        self.assertEqual(result["projectedWorkloadPercent"], 53.0)
        self.assertEqual(result["fairShareAllocationPercent"], 33)
        self.assertEqual(result["grade"], "STRONG")
        self.assertEqual(
            result["reasons"],
            [
                "Strong Python experience (level 5/5).",
                "Strong SQL experience (level 4/5).",
            ],
        )
        self.assertEqual(result["warnings"], [])

    def test_results_are_ranked_by_overall_score_descending(self):
        strong = employee(employeeId="emp-strong", name="Strong")
        middle = employee(
            employeeId="emp-middle",
            name="Middle",
            yearsOfExperience=4,
            availabilityPercent=50,
            currentWorkloadPercent=60,
        )
        weak = employee(
            employeeId="emp-weak",
            name="Weak",
            yearsOfExperience=0,
            availabilityPercent=10,
            currentWorkloadPercent=95,
            skills=[],
        )

        results = self.match([weak, strong, middle])["results"]
        scores = [item["overallScore"] for item in results]

        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertEqual([item["employeeId"] for item in results][0], "emp-strong")
        self.assertEqual([item["employeeId"] for item in results][-1], "emp-weak")


    def test_exceeding_a_requirement_counts_as_strong_coverage(self):
        result = self.match([employee()])["results"][0]

        self.assertEqual(result["components"]["skillMatch"], 100.0)
        self.assertEqual(result["requiredSkillsCovered"], 2)
        self.assertEqual(result["requiredSkillsTotal"], 2)
        self.assertEqual(
            [item["status"] for item in result["skillBreakdown"]],
            ["strong", "strong"],
        )
        self.assertEqual(sorted(result["matchedSkillIds"]), ["s-python", "s-sql"])
        self.assertEqual(result["missingSkillIds"], [])
        self.assertEqual(result["partialSkillIds"], [])

    def test_missing_skill_is_surfaced_in_breakdown_and_warnings(self):
        result = self.match([employee(skills=[])])["results"][0]

        statuses = {item["skillId"]: item["status"] for item in result["skillBreakdown"]}
        self.assertEqual(statuses, {"s-python": "missing", "s-sql": "missing"})
        self.assertEqual(sorted(result["missingSkillIds"]), ["s-python", "s-sql"])
        self.assertEqual(result["matchedSkillIds"], [])
        self.assertEqual(result["requiredSkillsCovered"], 0)
        self.assertEqual(result["components"]["skillMatch"], 0.0)
        self.assertTrue(
            any("missing" in warning.lower() for warning in result["warnings"]),
            msg=f"expected a missing-skill warning, got {result['warnings']}",
        )

    def test_project_without_requirements_makes_skill_match_neutral(self):
        result = self.match([employee()], project(requirements=[]))["results"][0]

        self.assertEqual(result["components"]["skillMatch"], 100.0)
        self.assertEqual(result["skillBreakdown"], [])
        self.assertEqual(result["requiredSkillsTotal"], 0)


    def test_partial_coverage_lands_between_gap_and_meets(self):
        # Python level 3 against a required level of 4 -> ratio 0.75 -> partial.
        result = self.match(
            [
                employee(
                    skills=[
                        {
                            "skillId": "s-python",
                            "skillName": "Python",
                            "category": "Programming",
                            "proficiency": 3,
                            "yearsOfExperience": 2,
                        }
                    ]
                )
            ]
        )["results"][0]

        statuses = {item["skillId"]: item["status"] for item in result["skillBreakdown"]}
        self.assertEqual(statuses["s-python"], "partial")
        self.assertEqual(statuses["s-sql"], "missing")
        self.assertEqual(result["partialSkillIds"], ["s-python"])
        # (0.75 * 1) / (1 + 1) * 100 == 37.5
        self.assertEqual(result["components"]["skillMatch"], 37.5)

    def test_optional_skills_carry_half_the_weight_of_required_ones(self):
        required_sql = project(requirements=[dict(item) for item in REQUIRED_SKILLS])
        optional_sql = project(
            requirements=[
                dict(REQUIRED_SKILLS[0]),
                {**REQUIRED_SKILLS[1], "importance": "OPTIONAL"},
            ]
        )
        # Knows Python, has never touched SQL.
        python_only = employee(skills=[employee()["skills"][0]])

        required = self.match([python_only], required_sql)["results"][0]
        optional = self.match([python_only], optional_sql)["results"][0]

        # 100/2 == 50.0 when SQL is required, 100/1.5 == 66.7 when it is optional.
        self.assertEqual(required["components"]["skillMatch"], 50.0)
        self.assertEqual(optional["components"]["skillMatch"], 66.7)

    def test_workload_projection_and_fair_share_use_the_declared_team_size(self):
        result = self.match([employee()])["results"][0]

        # fair_share(3) == clamp(round(100 / 3) == 33, 10, 60) == 33
        self.assertEqual(result["fairShareAllocationPercent"], 33)
        # projected == round((20 + 33) * 10) / 10 == 53.0
        self.assertEqual(result["projectedWorkloadPercent"], 53.0)
        # (130 - 53) / 90 == 0.8555... -> 85.6
        self.assertEqual(result["components"]["workload"], 85.6)


    def test_tight_deadline_raises_the_experience_expectation(self):
        # 4 years against a 4-year expectation: satisfied on a relaxed schedule
        # (score 100) but only 4/5 of the raised expectation on a tight one.
        relaxed = self.match([employee(yearsOfExperience=4)])["results"][0]
        tight = self.match(
            [employee(yearsOfExperience=4)], project(daysUntilDeadline=7)
        )["results"][0]

        self.assertEqual(relaxed["components"]["experience"], 100.0)
        self.assertEqual(tight["components"]["experience"], 80.0)

    def test_overall_score_is_the_weighted_sum_of_its_components(self):
        result = self.match([employee()])["results"][0]

        expected = sum(
            result["components"][key] * weight
            for key, weight in main.MATCH_WEIGHTS.items()
        )
        self.assertAlmostEqual(result["overallScore"], round(expected, 1), places=1)

    def test_zero_team_size_and_zero_experience_expectation_are_survivable(self):
        """Guards the `max(1, ...)` clamps against ZeroDivisionError."""
        result = self.match(
            [employee(yearsOfExperience=0)],
            project(requiredTeamSize=1, requiredExperienceYears=0, daysUntilDeadline=0),
        )["results"][0]

        self.assertGreaterEqual(result["overallScore"], 0)
        self.assertLessEqual(result["overallScore"], 100)
        # fair_share(1) clamps the 100% fair share down to the configured maximum.
        self.assertEqual(result["fairShareAllocationPercent"], 60)

    def test_empty_candidate_pool_returns_no_results(self):
        body = self.match([])
        self.assertEqual(body["results"], [])
        self.assertEqual(body["engine"], "python")


class ValidationTest(MatchingServiceTestCase):
    """FastAPI must reject malformed payloads rather than score them."""

    def test_proficiency_above_five_is_rejected(self):
        bad = employee(
            skills=[
                {
                    "skillId": "s-python",
                    "skillName": "Python",
                    "category": "Programming",
                    "proficiency": 9,
                    "yearsOfExperience": 1,
                }
            ]
        )
        response = self.client.post(
            "/match", json={"employees": [bad], "project": project()}
        )
        self.assertEqual(response.status_code, 422)

    def test_unknown_importance_value_is_rejected(self):
        bad_project = project(
            requirements=[{**REQUIRED_SKILLS[0], "importance": "NICE_TO_HAVE"}]
        )
        response = self.client.post(
            "/match", json={"employees": [employee()], "project": bad_project}
        )
        self.assertEqual(response.status_code, 422)

    def test_missing_project_is_rejected(self):
        response = self.client.post("/match", json={"employees": [employee()]})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()




