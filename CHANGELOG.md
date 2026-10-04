# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **The Team Builder endpoint could not be committed.** `.gitignore` contained an
  unanchored `coverage/` entry, which also matched the *real source directory*
  `app/api/projects/[id]/coverage/`. Git silently excluded the route, so the
  published tree shipped without `POST /api/projects/:id/coverage` even though a
  local build produced it happily. Build and coverage artefacts are now anchored
  to the repository root (`/out/`, `/build/`, `/dist/`, `/coverage/`).
- **README permission table.** `/api/projects/:id/recommendations` and
  `/api/projects/:id/coverage` were documented as requiring `project:read`. Both
  endpoints actually enforce `matching:read` — ranking the whole company is a
  management capability that `EMPLOYEE` deliberately lacks. The documentation now
  matches the enforced code.

### Added

- CI guard that fails the pipeline if any file under `app/`, `components/`,
  `lib/`, `services/`, `models/`, `hooks/`, `types/`, `utils/`, `scripts/` or
  `tests/` is excluded by `.gitignore`, so a silently-dropped source file can no
  longer reach `main` unnoticed.

## [1.0.0] - 2026-10-04

First complete release of **SkillAlloc** — a smart employee skill and project
allocation platform. It answers one question well: *who should work on this
project, and on what evidence?* — and shows its working at every step.

### Added

**Core domain**
- Employee directory with server-side search, department / role / skill / status
  filters, sorting and pagination
- Employee profiles with skills, certifications, availability, current and previous
  projects, plus a self-service editor restricted to a safe field subset
- Skill editor storing proficiency (1–5) and years of experience per skill
- Skill catalogue with 10 categories and reference-protected deletes
- Departments with head counts
- Projects with required skills, required proficiency, per-requirement importance,
  preferred roles, team size and deadline

**Explainable matching**
- Deterministic System Matching Score with a published, weighted breakdown:
  skill match 45%, experience 15%, availability 15%, workload 15%, role
  suitability 10%
- Per-skill comparison, human-readable reasons and warnings, letter grading, and
  budget-aware team assembly
- Team coverage analysis and ordered skill-gap reporting
- Internal training recommendations to close the remaining gaps

**Operations**
- Workload tracking with projected load and over-allocation flags
- Reporting with CSV and PDF export
- Global search across employees, skills, projects and departments
- Dashboard, notifications and user profile
- Admin area for users (role, active flag, display name) and application settings
- Authentication with Auth.js v5 (Google OAuth), plus password-less dev credentials
  for local use
- Optional Google Calendar availability (free/busy only), with sync and status routes
- In-memory, per-process API rate limiting applied to every route handler, with a
  documented path to a Redis-backed limiter for multi-instance deployments
- `GET /api/health` readiness endpoint that pings the database and the optional
  Python service, returning `503 degraded` (never throwing) when a dependency is down
- Optional FastAPI matching service (`ml-service/`) that mirrors the TypeScript
  engine, with automatic fallback to TypeScript when it is unreachable or slow
- Seed script (20 employees, 25 skills, 5 departments, 8 projects) and a workload
  recompute script

**Quality and tooling**
- 104 TypeScript tests across four vitest suites covering the matching engine, the
  Python gateway, the permission matrix and the validation schemas
- 18 Python tests driving the FastAPI routes through a real `TestClient`
- GitHub Actions CI: typecheck, lint, test and build on Node 20.x and 22.x, a
  Python 3.12 job for the matching service, and an advisory `npm audit`
- `LICENSE` (MIT), `CONTRIBUTING.md`, `.editorconfig` and `.gitattributes`

### Changed
- Python dependency pins relaxed to compatible version ranges so `ml-service`
  installs against current interpreters (previously pinned to exact versions)
- `eslint.ignoreDuringBuilds` is now `false`, so ESLint errors fail the production
  build instead of being silently skipped
- `poweredByHeader` disabled so `X-Powered-By` is no longer advertised

### Fixed
- Removed stray build and verification artefacts from the working tree
- `.gitignore` extended to cover Python bytecode, local logs and generated
  `*-out.txt` dumps

### Security
- Added `Content-Security-Policy` and the accompanying hardening headers:
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `X-DNS-Prefetch-Control` and
  `Strict-Transport-Security`
- Authorization is enforced server-side on every route rather than only in
  middleware, and the live permission matrix is covered by tests

[Unreleased]: https://example.com/compare/v1.0.0...HEAD
[1.0.0]: https://example.com/releases/tag/v1.0.0
