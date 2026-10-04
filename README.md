# SkillAlloc — Smart Employee Skill & Project Allocation Platform

A production-style web application for IT companies to manage **employees, skills,
projects, workloads and allocations**, and to get **transparent, fully explainable
recommendations** for who should work on a project and why.

The system answers one question well: *who should work on this project, and on what
evidence?* — and shows its working at every step.

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [Technology stack](#4-technology-stack)
5. [Database design](#5-database-design)
6. [The matching algorithm](#6-the-matching-algorithm)
7. [API documentation](#7-api-documentation)
8. [Authentication setup](#8-authentication-setup)
9. [Google API setup](#9-google-api-setup)
10. [MongoDB setup](#10-mongodb-setup)
11. [Environment variables](#11-environment-variables)
12. [Installation](#12-installation)
13. [Running locally](#13-running-locally)
14. [Testing](#14-testing)
15. [Screenshots](#15-screenshots)
16. [Security](#16-security)
17. [Future improvements](#17-future-improvements)

---

## 1. Project overview

`SkillAlloc` is a delivery-resource management tool. A project manager creates a
project, defines the skills it needs and the level of proficiency required for each.
The platform then:

- scores every eligible employee against those requirements,
- explains **every** point of that score (components, per-skill comparison, and the
  generated reasons and warnings),
- lets the manager compare candidates and assemble a team,
- tracks the resulting workload and flags over-allocation,
- analyses which project requirements the team still does not cover,
- and recommends internal training to close the remaining gaps.

> **The System Matching Score is decision support, not an objective ranking of
> people.** It is a transparent, deterministic calculation. It is not a
> machine-learning prediction and the application never presents it as one.

---

## 2. Features

### Employees
- Directory with server-side search, department / role / skill / status filters,
  sorting and pagination
- Profiles with skills, certifications, availability, current and previous projects
- Self-service profile editing restricted to a safe field subset
- Skill editor with proficiency (1–5) and years of experience per skill
- Optional Google Calendar availability (free/busy only)

### Skills & departments
- Central skill catalogue with 10 categories
- Skill detail page showing every employee who holds the skill, bucketed by level
- Departments with head counts
- References are enforced: a skill still in use cannot be deleted

### Projects
- Create / edit projects with status, priority, dates, team size and experience target
- **Dynamic required-skill editor** — add or remove requirements with a proficiency
  level and REQUIRED/OPTIONAL importance at any time
- Live staffing calculation in *people-equivalents*
- Per-project team view with skill coverage and remaining gaps

### Matching engine (the core feature)
- Transparent **System Matching Score** from 0–100
- Five weighted components, each individually displayed
- Per-skill comparison: required level vs. employee level, with coverage percentage
- Generated "why recommended" reasons and "watch out" warnings
- Filters: minimum score, department, role, skill, availability, experience,
  maximum projected workload
- Side-by-side comparison of up to three candidates
- Live **Team Builder** with real-time skill coverage recalculation
- One-click allocation of the assembled team

### Workload, gaps & training
- Utilisation bands: Available (0–60%), Moderate (61–80%), High (81–100%),
  Overallocated (>100%)
- Over-allocation is blocked with a clear warning and requires explicit confirmation
- Skill gap analysis per project (coverage % and missing skills)
- Training recommendations that map each gap to the smallest suitable course

### Analytics, reports & notifications
- Dashboard with live KPI tiles and six charts
- Six downloadable reports in **CSV and PDF**, generated in-process
- Notifications for assignments, approvals, skill gaps, training and deadlines
- Global search across employees, skills, projects and departments

---

## 3. Architecture

```
Browser (React)
   │  fetch + SWR-style hooks (hooks/useApi.ts, hooks/useApiData.ts)
   ▼
Next.js App Router
   ├── app/(app)/**        Server Components — read data through services
   ├── app/api/**          Route Handlers — validate → authorise → call service
   └── middleware.ts       Coarse "is signed in" gate only (edge runtime)
   │
   ├── lib/auth/           Permissions, RBAC guards, object-level access
   ├── lib/validators/     Zod schemas shared by forms and API
   ├── lib/matching/       PURE matching engine (no DB, no network)
   ├── lib/api/            Response envelope, error mapping, rate limiting
   ├── services/           Business logic (UI never talks to Mongoose)
   ├── models/             Mongoose schemas + indexes
   └── ml-service/         Optional Python FastAPI mirror of the engine
```

### Design decisions

| Decision | Why |
|---|---|
| **Services layer between UI and models** | Business rules are unit-testable and reused by pages, API routes and scripts. No component imports Mongoose. |
| **Matching engine is pure** | It has no database or network dependency, which makes the scoring rulebook directly unit-testable and identical in the Python service. |
| **Zod at every API boundary** | Forms and API share one schema, so client validation can never drift from server validation. |
| **Middleware performs no role checks** | It runs on the Edge runtime and cannot reach MongoDB. Real authorization happens in server components and route handlers. |
| **Live aggregation + persisted snapshot for workload** | Dashboards always compute live totals (never stale); a `workloads` snapshot is maintained alongside for cheap reporting. |
| **JWT role re-sync every 2 minutes** | An admin role change takes effect without forcing a re-login. |
| **In-process PDF/CSV** | `pdf-lib` plus a small CSV writer. No paid service, no queue, no external dependency. |

---

## 4. Technology stack

**Frontend** — Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS 3.4,
Chart.js 4 (via react-chartjs-2), Heroicons

**Backend** — Next.js Route Handlers (Node runtime), Zod 3.24 validation

**Database** — MongoDB (Atlas) with Mongoose 8.9

**Auth** — Auth.js / NextAuth v5 with Google OAuth, JWT sessions

**Extras** — `pdf-lib` (PDF reports), `tsx` (scripts), `vitest` (tests),
`dotenv` (scripts), optional Python `FastAPI` + `uvicorn`

Everything runs on free tiers: MongoDB Atlas M0, Google Cloud OAuth is free, and no
paid API is used anywhere.

---

## 5. Database design

| Collection | Purpose | Key indexes |
|---|---|---|
| `users` | Auth.js accounts, role, Google tokens | `email` (unique), `googleId` |
| `employees` | People, skills, certifications, availability | `email` (unique), `employeeId` (unique), `name`, `status`, `jobRole`, `departmentId`, `skills.skillId` |
| `skills` | Capability catalogue | `name` (unique), `slug` (unique), `category` |
| `departments` | Org units | `name` (unique), `code` (unique) |
| `projects` | Delivery projects + skill requirements | `code` (unique), `status`, `priority`, `deadline`, `managerId`, `requirements.skillId` |
| `allocations` | Employee ↔ project assignment with percentage | unique compound `(projectId, employeeId, status)`, `employeeId`, `status` |
| `workloads` | Persisted per-employee snapshot | `employeeId` (unique) |
| `training` | Internal course catalogue | `skillName`, `targetProficiency` |
| `notifications` | Per-user notifications | `userId`, `read`, `userId+createdAt` |
| `settings` | Singleton application settings | `key` (unique) |

**Referencing, not duplicating.** Employee skills, project requirements and training
courses all store a `skillId` reference. Skill *names* are resolved at read time, so
renaming a skill updates every screen at once. The only intentional denormalisation
is `allocations.projects[].projectName`, which keeps workload reports fast even if a
project is later renamed.

---

## 6. The matching algorithm

Implemented in [`lib/matching/engine.ts`](lib/matching/engine.ts) — a pure module with
no database or network dependency — and mirrored in
[`ml-service/main.py`](ml-service/main.py).

```
Overall = Skill×0.45 + Experience×0.15 + Availability×0.15
        + Workload×0.15 + RoleSuitability×0.10        →  0–100
```

### 6.1 Skill match (45%)

Each required skill is compared with the employee's proficiency (1–5):

| Coverage | Condition |
|---|---|
| 100% | employee level ≥ required level |
| `level / required` | employee level < required level |
| 0% | skill missing from the profile |

Required skills carry weight `1.0`; optional skills `0.5`, so an optional requirement
has half the influence of a required one. If the project defines no requirements the
component is **100 (neutral)** rather than penalising everyone equally.

### 6.2 Experience (15%)

`score = clamp(yearsOfExperience / effectiveRequiredYears, 0, 1) × 100`

A deadline within **14 days** multiplies the requirement by **1.25**, because short
windows need proven delivery rather than enthusiastic juniors.

### 6.3 Availability (15%)

Uses the availability percentage the employee set. When a Google Calendar is
connected, the calendar-derived figure is **averaged** with the declared one — a more
accurate signal without discarding what the person told us.

### 6.4 Workload (15%)

```
fairShare      = clamp(100 / requiredTeamSize, 10, 60)
projected      = currentAllocation + fairShare
score          = clamp((130 - projected) / 90, 0, 1) × 100
```

The score decays smoothly from 100 to 0 as the projected total approaches 130%.

### 6.5 Role suitability (10%)

`60% × preference + 40% × affinity`

- **Preference**: 100 if the project explicitly lists the role, 70 if it lists a role
  in the same family (e.g. Backend ↔ Frontend), 35 otherwise.
- **Affinity**: the share of required skills whose category naturally belongs to that
  role (a Backend Developer is close to Programming/Backend/Database/Cloud).

### 6.6 Workload bands

| Band | Range |
|---|---|
| Available | 0–60% |
| Moderate | 61–80% |
| High | 81–100% |
| Overallocated | > 100% |

### 6.7 Team coverage

For a candidate team, each requirement takes the **best** proficiency present (one
strong member covers a requirement). Required skills are weighted double optional
ones. The result is an overall coverage percentage, a per-skill breakdown and a list
of missing skills, worst first.

### 6.8 Optional Python service

`lib/matching/python.ts` posts the candidate pool to `MATCHING_SERVICE_URL` when
configured. On any failure — timeout, non-200, malformed payload — it **falls back to
the TypeScript engine** and reports the reason in the API metadata. The application
therefore never depends on the Python service being up.

---

## 7. API documentation

All endpoints return a consistent envelope:

```jsonc
// success
{ "ok": true, "data": { }, "meta": { "page": 1, "total": 20 } }
// failure
{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "…", "fields": { } } }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input (with per-field messages) |
| 401 | Not authenticated |
| 403 | Not authorised |
| 404 | Resource not found |
| 409 | Conflict (duplicate, over-allocation, still referenced) |
| 429 | Rate limited |
| 500 | Internal error (never leaks a stack trace) |

### Employees

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/employees` | `employee:read` |
| POST | `/api/employees` | `employee:create` |
| GET | `/api/employees/:id` | `employee:read` |
| PUT | `/api/employees/:id` | `employee:update` **or** own profile |
| DELETE | `/api/employees/:id` | `employee:delete` |
| PUT | `/api/employees/:id/skills` | `employee:update` **or** own profile |
| POST | `/api/employees/:id/skills` | `employee:update` **or** own profile |
| DELETE | `/api/employees/:id/skills/:skillId` | `employee:update` **or** own profile |
| PUT | `/api/employees/:id/availability` | `employee:update` **or** own profile |

`GET /api/employees` supports `q`, `departmentId`, `jobRole`, `status`, `skillId`,
`sort`, `direction`, `page`, `pageSize`.

### Skills, departments, training

| Method | Endpoint | Permission |
|---|---|---|
| GET / POST | `/api/skills` | `skill:read` / `skill:manage` |
| GET / PUT / DELETE | `/api/skills/:id` | `skill:read` / `skill:manage` |
| GET / POST | `/api/departments` | `employee:read` / `department:manage` |
| GET / PUT / DELETE | `/api/departments/:id` | `employee:read` / `department:manage` |
| GET / POST | `/api/training` | `training:read` / `training:manage` |
| PUT / DELETE | `/api/training/:id` | `training:manage` |
| POST | `/api/training/recommendations` | `training:read` |

### Projects & allocation

| Method | Endpoint | Permission |
|---|---|---|
| GET / POST | `/api/projects` | `project:read` / `project:create` |
| GET / PUT / DELETE | `/api/projects/:id` | `project:read` / `project:update` / `project:delete` |
| POST | `/api/projects/:id/requirements` | `project:update` |
| DELETE | `/api/projects/:id/requirements/:skillId` | `project:update` |
| **GET** | **`/api/projects/:id/recommendations`** | `project:read` |
| POST | `/api/projects/:id/coverage` | `project:read` |
| GET / POST | `/api/projects/:id/allocate` | `allocation:read` / `allocation:manage` |
| GET | `/api/allocations` | `allocation:read` |
| PUT / DELETE | `/api/allocations/:id` | `allocation:manage` |

`GET /api/projects/:id/recommendations` accepts `minScore`, `departmentId`,
`jobRole`, `skillId`, `minAvailability`, `minExperience`, `maxWorkload`, `limit`,
`forceLocal`.

### Analytics, reports, admin

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/dashboard` | `dashboard:read` |
| GET | `/api/workload` | `workload:read` |
| GET | `/api/skill-gaps` | `skillgap:read` |
| GET / POST | `/api/notifications`, `/api/notifications/read-all` | `notification:read` |
| PATCH / DELETE | `/api/notifications/:id` | `notification:read` (owner only) |
| GET | `/api/search` | any signed-in user |
| GET | `/api/reports/:type?format=csv\|pdf` | `report:read` |
| GET / PATCH | `/api/admin/users` | `user:manage` |
| GET / PUT | `/api/admin/settings` | `settings:manage` |
| GET | `/api/calendar/status` | `profile:update:own` |
| POST / DELETE | `/api/calendar/sync` | `profile:update:own` |

Report types: `allocations`, `project-staffing`, `skill-gaps`, `workload`,
`utilization`, `project-progress`.

---

## 8. Authentication setup

1. Create a Google Cloud project: <https://console.cloud.google.com/>
2. Configure the **OAuth consent screen** (External, add your email as a test user).
3. Create an **OAuth client ID** of type *Web application* with the redirect URI:

   ```
   http://localhost:3000/api/auth/callback/google
   ```

4. Copy the client ID and secret into `.env.local`:

   ```env
   AUTH_SECRET=<openssl rand -base64 32>
   GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxx
   ```

**First-login provisioning.** The `signIn` callback checks MongoDB for the email; if
no user exists it creates one (default role `EMPLOYEE`), creates a matching employee
profile, and stores the Google refresh token when calendar scope was granted. The
role is then re-synchronised with the database every two minutes, so promoting someone
to `ADMIN` takes effect without a re-login.

**No password is ever accepted or stored.** A development-only, password-less
provider exists purely so the app is usable without Google credentials; it is gated by
`ENABLE_DEV_CREDENTIALS=true` and must never be enabled in production.

---

## 9. Google API setup

Google Calendar is **optional** and used only to refine availability.

1. Enable the **Google Calendar API** in the same Cloud project.
2. The OAuth scope `https://www.googleapis.com/auth/calendar.readonly` is already
   requested by the provider configuration.
3. An employee connects a calendar from **My profile → Google Calendar**.

**Privacy contract** (enforced in `services/calendarService.ts`):

- only `calendar.readonly` is ever requested;
- only *busy* intervals are read — event titles, attendees and descriptions are never
  fetched or stored;
- a single derived number (free capacity over the next 14 days) is persisted;
- other users only ever see that percentage, never the underlying calendar;
- if the API is unavailable the employee keeps their manual availability and nothing
  breaks.

---

## 10. MongoDB setup

1. Create a free cluster at <https://www.mongodb.com/cloud/atlas/register>.
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → allow your IP (or `0.0.0.0/0` for a demo).
4. Copy the connection string:

   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```

5. Put it in `.env.local`:

   ```env
   MONGODB_URI=mongodb+srv://...
   MONGODB_DB_NAME=skill_allocation
   ```

Indexes are declared in the Mongoose models and are created automatically on first
use (see the [database design](#5-database-design) table).

---

## 11. Environment variables

Copy `.env.example` to `.env.local` and fill in the values. **Never commit
`.env.local`.**

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `MONGODB_DB_NAME` | no | Database name (default `skill_allocation`) |
| `AUTH_SECRET` | yes | Signs the session JWT (`openssl rand -base64 32`) |
| `AUTH_URL` | no | Auth base URL |
| `AUTH_TRUST_HOST` | no | Required behind a proxy |
| `GOOGLE_CLIENT_ID` | for Google login | OAuth client id |
| `GOOGLE_CLIENT_SECRET` | for Google login | OAuth client secret |
| `ENABLE_DEV_CREDENTIALS` | no | `true` enables the password-less demo login (**dev only**) |
| `ADMIN_EMAILS` | no | Comma-separated emails promoted to ADMIN on first login |
| `MATCHING_SERVICE_URL` | no | Enables the Python engine, e.g. `http://127.0.0.1:8000` |
| `NEXT_PUBLIC_APP_NAME` | no | Product name shown in the UI |
| `NEXT_PUBLIC_APP_URL` | no | Public base URL |

---

## 12. Installation

```bash
git clone <your-repo-url>
cd Sample_project
npm install
cp .env.example .env.local     # then edit .env.local
```

Requires **Node.js 20.9+**.

---

## 13. Running locally

```bash
# 1. Load demo data (20 employees, 25 skills, 5 departments, 8 projects, allocations)
npm run seed

# 2. Start the development server
npm run dev
```

Open <http://localhost:3000>.

### Trying the app without Google OAuth

Set `ENABLE_DEV_CREDENTIALS=true` in `.env.local` and use one of the seeded accounts
on the login screen:

| Role | Email |
|---|---|
| ADMIN | `samuel.adeyemi@skillalloc.dev` |
| PROJECT_MANAGER | `alex.morgan@skillalloc.dev` |
| EMPLOYEE | `priya.sharma@skillalloc.dev` |

### All scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run seed` | Seed demo data (skips if data exists) |
| `npm run seed:reset` | Wipe and re-seed |
| `npm run recompute-workload` | Rebuild workload snapshots |
| `npm test` | Run the test suite |
| `npm run typecheck` | TypeScript validation |
| `npm run lint` | ESLint |

### Optional: run the Python matching service

```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Then set `MATCHING_SERVICE_URL=http://127.0.0.1:8000`. The UI shows which engine
answered, and falls back to TypeScript automatically if the service is down.

---

## 14. Testing

```bash
npm test
```

The four vitest suites all cover pure logic (no database required):

| Suite | Coverage |
|---|---|
| `tests/matching-engine.test.ts` | Every scoring rule: skill matching, optional weighting, experience and tight-deadline adjustment, availability with/without a calendar, workload decay, role preference and affinity, grading, ranking and tie-breaking, determinism, team coverage and gap ordering |
| `tests/matching-python.test.ts` | The optional Python-engine gateway (`lib/matching/python.ts`): engine selection, `forceLocal`, result re-ranking and engine tagging on success, and the fallback-to-TypeScript contract on non-200, malformed payload, network error and timeout (driven against a real ephemeral HTTP server) |
| `tests/permissions.test.ts` | The full permission matrix per role, object-level edit access, row-level scoping and the HTTP error contract |
| `tests/validation.test.ts` | Zod schemas for employees, projects, allocations, skills and settings; query-injection defences (regex escaping, sort whitelist) |

The matching tests are the executable specification of the System Matching Score.

The optional Python service carries its own suite (`ml-service/test_main.py`, 18
tests). It is **not** part of `npm test`; run it with:

```bash
cd ml-service && python -m unittest -v
```

It drives the real FastAPI routes through `TestClient` and covers the health and
weights endpoints, the golden score vector, ranking order, missing / partial /
optional skill requirements, workload projection, deadline handling, the
weighted-sum invariant, zero-clamp guards and `422` validation.

---

## 15. Screenshots

Screenshots are not committed to the repository. To generate them:

1. Run `npm run seed && npm run dev`
2. Capture:
   - `/` — public landing page with the scoring explainer
   - `/dashboard` — KPI tiles and the six charts
   - `/employees` — filterable employee directory
   - `/allocation/recommend` — ranked recommendations with an expanded score breakdown
   - `/skill-gaps` — coverage analysis with missing skills
   - `/workload` — utilisation bands per employee
   - `/reports` — CSV/PDF download cards

---

## 16. Security

- **Authorization is enforced on the server.** Middleware only checks "is signed in".
  Every route handler and server component re-checks permissions, so hiding a button is
  never the control.
- **Object-level checks.** An EMPLOYEE can only edit their own profile, and only
  through a schema that strips fields outside the allow list. Managers are scoped to
  projects they manage.
- **Row-level scoping.** Employees only ever receive their own workload rows,
  allocations and notifications.
- **Input validation** with Zod on every body and query string; unknown keys are
  stripped rather than trusted.
- **MongoDB injection defence.** User input is regex-escaped, `sanitizeFilter` and
  `strictQuery` are enabled, and sort fields come from a whitelist.
- **Rate limiting** on API endpoints (in-memory sliding window).
- **No secrets in source control.** Everything sensitive lives in `.env.local`;
  OAuth tokens are stored with `select: false` and never returned by any endpoint.
- **No stack traces in production.** Unknown errors are logged server-side and
  returned as a generic 500.
- **Email as the identity key**, so an account can never be linked to a different
  Google identity.

---

## 17. Future improvements

1. **Learning-to-rank** — once historical allocation outcomes exist, the deterministic
   weights could be tuned from data. The current engine stays as a transparent baseline.
2. **Redis-backed rate limiting and caching** for multi-instance deployments.
3. **SAML / OIDC SSO** for companies that cannot use Google accounts.
4. **Team composition optimisation** — formal assignment solving (Hungarian algorithm)
   over the whole portfolio rather than per project.
5. **Skills decay and re-certification tracking** with time-based confidence.
6. **Calendar write access** to block time automatically when someone is allocated.
7. **Audit log** of every administrative action.
8. **Offline/mobile** PWA for field availability updates.
9. **i18n** and right-to-left support.
10. **Docker Compose** for one-command local deployment including MongoDB.

---

## License

MIT — provided as a portfolio/educational project.