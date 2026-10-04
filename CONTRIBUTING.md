# Contributing to SkillAlloc

Thanks for helping improve SkillAlloc. This guide covers local setup, the
conventions this codebase already follows, and the gates CI enforces.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 20.9.0 (CI: 20.x and 22.x) | declared in `package.json` → `engines` |
| npm | ships with Node | use `npm ci` so `package-lock.json` is respected |
| MongoDB | 6.x / 7.x | Atlas free tier works; a local `mongod` is faster |
| Python | >= 3.12 | **optional** — only for the FastAPI matching service |

---

## Getting started

```bash
npm ci                      # reproducible install
cp .env.example .env.local  # then fill in MONGODB_URI and AUTH_SECRET
npm run seed                # 20 employees, 25 skills, 5 departments, 8 projects
npm run dev                 # http://localhost:3000
```

Generate `AUTH_SECRET` with `npx auth secret`. README §11 documents every
environment variable.

---

## Before you open a pull request

These are exactly the gates CI runs — all four must pass:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # vitest run
npm run build       # next build (eslint.ignoreDuringBuilds is false)
```

If you touched the matching service:

```bash
cd ml-service
python -m venv .venv
.venv/Scripts/activate          # Windows;  source .venv/bin/activate elsewhere
pip install -r requirements-dev.txt
python -m unittest -v
```

---

## Conventions

- **TypeScript strict.** Avoid `any` in new code — use `unknown` plus a Zod parse.
- **Validate every request body** with the schemas in `lib/validation/`.
- **Authorize on the server.** Middleware only answers *"is signed in?"*; each route
  re-checks the role. Never rely on hidden UI for access control.
- **Use the shared response helpers** in `lib/api/response.ts` so the error contract
  stays uniform.
- **The matching engine is pure.** `lib/matching/engine.ts` must stay free of I/O.
  Its weights (`MATCH_WEIGHTS`) are load-bearing and are mirrored in
  `ml-service/main.py`; changing one without the other is a bug.
- **Explainability is a feature.** Every new scoring rule needs a human-readable
  reason or warning, plus a test.
- Whitespace is governed by `.editorconfig` (2 spaces, LF) and `.gitattributes`.
  Keep diffs free of whitespace-only churn.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <imperative summary>
```

`type` ∈ `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`.

```
feat(matching): weight optional skills at half of required importance
fix(api): return 409 instead of 500 when a skill is still in use
test(python): cover the /health probe timeout path
```

---

## Tests

Tests live in `tests/` and cover pure logic — **no database is required**.

| Area | Command |
|---|---|
| TypeScript (4 suites, 104 tests) | `npm test` |
| Python service (1 suite, 18 tests) | `cd ml-service && python -m unittest -v` |

`tests/matching-engine.test.ts` is the executable specification of the System
Matching Score. Change a scoring rule there first and let it tell you what else moved.

---

## Reporting bugs and requesting features

Open an issue with the expected behaviour, the observed behaviour, and the smallest
reproduction you can manage. For scoring problems, include the employee's skills, the
project requirements and the full score breakdown — that is usually enough to pinpoint
the cause exactly.
