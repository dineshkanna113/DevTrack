# Explaining DevTrack in an interview

Answers you can adapt, in your own words. Every claim here is true of the code, and the file to point at is named.

## The 30-second version

> "DevTrack is an issue tracker, like a small Jira, that I built end to end. The backend is FastAPI with PostgreSQL. The frontend is React with TypeScript. Teams create projects, file issues with keys like DT-12, and move them across a Kanban board. Every change is kept in an audit log. The part I'm proudest of is the AI triage: Claude reads a new bug report and suggests a type, a priority and a clearer title, and flags likely duplicates. It's tested to 97% coverage on the backend, and CI runs the database migrations against real PostgreSQL on every push."

## The 2-minute version (architecture)

1. **Shape:** a React single-page app talks to a REST API over JSON with a JWT bearer token. The API is layered: routes, then dependencies for auth and permissions, then services for business rules, then SQLAlchemy models. Pydantic validates everything at the edge.
2. **Data:** users, projects with members, issues, comments and an activity log. Alembic manages schema changes, including a reversible data migration from my v1 schema.
3. **Hard parts:** race-free issue numbering, permission checks that can't be forgotten, optimistic UI with rollback, and making an LLM feature reliable.
4. **Quality:** about 44 backend and 24 frontend tests, strict mypy, Ruff, ESLint, and GitHub Actions that also builds the Docker images.
5. **Ops:** Docker, a Render blueprint for the API and database, Vercel for the frontend, and a health check that returns 503 when the database is down.

## Design decisions and trade-offs

| Decision | Why | Trade-off I accepted |
|---|---|---|
| Layered API (routes → deps → services → models) | Rules testable without HTTP; permissions in one place | More files than a "fat routes" app |
| Permissions as FastAPI dependencies | A route can't forget the check: it's in the signature | Slightly more indirection when reading a route |
| 404 instead of 403 for non-members | Doesn't reveal which ids exist | Debugging "why 404?" is a bit harder |
| Issue number via `UPDATE … RETURNING` | Atomic at the database; no lock code in Python | One write on `projects` per new issue (a hot row at very high volume) |
| Enums stored as text | Adding a status is a code change, not `ALTER TYPE` | The database won't reject a bad value; Pydantic does |
| JWT in `localStorage` | Simple; works across tabs | Readable by XSS. Next step: `httpOnly` cookie + CSRF token |
| In-memory login rate limiter | Zero infrastructure; correct for one process | Needs Redis once there are several replicas |
| Optimistic Kanban updates | Board feels instant | Must handle rollback and re-sync (done in `useUpdateIssue`) |
| LLM with structured outputs | Valid JSON, allowed values only | Tied to providers that support schema-constrained output |
| AI behind an interface + DI | Tests use a fake: fast, free, deterministic | A thin extra abstraction |

## Questions you'll likely get

**How do you stop two people from getting the same issue number?**
One atomic statement increments a per-project counter and returns the new value: `UPDATE projects SET issue_counter = issue_counter + 1 … RETURNING issue_counter`. The database serialises the two updates. A unique constraint on `(project_id, number)` is the backstop. (`app/services/issues.py`, `create_issue`)

**How do permissions work? Could a route forget to check?**
Checks are FastAPI dependencies like `get_project_for_member` and `require_project_owner`. A route declares them in its parameters, and FastAPI runs them first. Tests cover a non-member getting 404 and a member getting 403 on owner-only actions. (`app/api/deps.py`, `tests/test_projects.py`)

**How do you make an LLM feature reliable in production?**
Four ways. One: structured outputs, so the response always matches a schema with allowed values. Two: I validate the output, dropping duplicate ids the model wasn't given. Three: errors map to clear HTTP codes, including refusals and rate limits. Four: the feature is optional, so without a key the endpoint returns 503 and the UI hides the button. Prompt injection is reduced by wrapping user text in tags and telling the model to treat it as data. (`app/services/ai_triage.py`)

**How did you test the AI part without calling the API?**
The route depends on a `Triager` interface through `get_triager()`. In tests I override that dependency with a fake that returns a fixed suggestion. A separate unit test mocks the Anthropic client to check the exact request: model, schema and fallbacks. (`tests/test_ai.py`)

**What happens if the server rejects a drag on the board?**
The card moves immediately (optimistic update). On error, the hook restores the cached snapshot it saved, shows a toast, and re-fetches. (`src/hooks/queries.ts`, `useUpdateIssue`)

**Tell me about a migration.**
v1 had no migration history and a flat schema. I wrote a baseline migration matching v1 exactly, then `0002`. It creates a personal project per user, numbers their issues, maps old statuses and labels, resolves assignee emails to user ids, and lowercases emails. It's reversible, and CI runs upgrade → `alembic check` → downgrade → upgrade on PostgreSQL. (`alembic/versions/0002_projects_workflow.py`)

**How do you protect login?**
bcrypt hashes, signed JWTs with required claims, and a rate limiter: 5 failures per account per address, 20 per address, in 15 minutes, then 429 with `Retry-After`. Unknown emails still run a bcrypt check against a dummy hash, so response time doesn't reveal which emails exist. (`app/core/rate_limit.py`, `app/api/routes/auth.py`)

**What breaks first at scale, and what would you do?**
1. The in-memory rate limiter with several API replicas: move it to Redis.
2. The list endpoint's `ILIKE` search on large tables: add PostgreSQL full-text search with a GIN index.
3. The stats endpoint recomputing on every load: cache it per project, or keep counters updated on write.
4. The issue-counter row on very busy projects: acceptable until thousands of issues per second.

**What was the hardest bug?**
Pick one you remember well. Real ones from this project:
- A Vitest test called the mocked login twice. `beforeEach(() => mock.mockReset())` *returned* the mock, and Vitest runs a function returned from `beforeEach` as cleanup. Braces fixed it.
- The live demo silently called `localhost:8000` because the production build had no `VITE_API_URL`. I added a build-time guard so it can't happen again.
- dnd-kit gives the draggable `<li>` `role="button"`, which nested a button inside a button. I restored `role="listitem"` for correct accessibility.

## Numbers you can quote

| Metric | Value |
|---|---|
| API routes | 20 |
| Backend tests / coverage | about 44 / 97% |
| Frontend tests | 24 |
| CI jobs | backend, frontend, Docker |
| Production JS for the first screen | about 48 KB of app code; charts load only on the dashboard |

## Honest limitations

Say these before they're found. It reads as maturity.

- Tokens in `localStorage` (XSS-readable). No refresh tokens.
- Rate limiting is per process.
- No real-time updates: other users' changes appear on the next refresh or refocus.
- No ownership transfer: deleting a user deletes the projects they own.
- No end-to-end browser tests yet; component tests and API tests cover the logic.

## What I'd do next

1. Move auth to an `httpOnly` cookie with CSRF protection and refresh tokens.
2. Add real-time board updates over WebSockets.
3. Add Playwright end-to-end tests for sign-in → create issue → drag → dashboard.
4. Add an ownership-transfer endpoint and soft-delete for users.
5. Add PostgreSQL full-text search for issues.
6. Add email or Slack notifications on assignment.
