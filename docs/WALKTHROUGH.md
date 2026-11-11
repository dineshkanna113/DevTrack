# Walkthrough: one bug report, start to finish

This guide follows a single bug report through DevTrack. At each step you see three things:

- **What the user sees** in the browser.
- **What happens** behind the screen, in plain words.
- **Where the code is**, so you can open the file and read along.

The story: *Priya, a developer on the "DevTrack Platform" project, finds that login breaks for emails with capital letters. She reports it, the AI sorts it, a teammate fixes it, and the dashboard updates.*

Run the app locally first (see the main [README](../README.md#try-it-in-2-minutes)) so you can click along.

---

## Step 0. The big picture

DevTrack has three running parts:

1. **The web app** (`devtrack-frontend/`). React code that runs in the browser. It draws the screens and talks to the API.
2. **The API** (`devtrack-backend/`). A Python program. It checks who you are, applies the rules, and reads and writes the database.
3. **The database** (PostgreSQL). Stores everything permanently.

The web app never touches the database directly. It always asks the API, and the API decides what is allowed.

Inside the API, code is split into layers. Each layer has one job:

| Layer | Folder | Job | Example |
|---|---|---|---|
| Routes | `app/api/routes/` | Receive the HTTP request, return the response | "POST /issues arrived" |
| Dependencies | `app/api/deps.py` | Check login and permissions before the route runs | "Is Priya a member of this project?" |
| Schemas | `app/schemas.py` | Validate input, shape output | "Title must be 3–200 characters" |
| Services | `app/services/` | Business rules | "Give the issue the next number, record history" |
| Models | `app/models.py` | Database tables as Python classes | `Issue`, `Project`, `User` |

This split is why the code is easy to test: services can be tested without HTTP, and routes stay short.

---

## Step 1. Priya signs in

**What she sees:** the sign-in page. She types her email and password, or clicks **Try the demo account**.

**What happens:**

1. The form checks the email looks valid before sending anything (Zod schema).
2. The web app sends the email and password to `POST /api/v1/auth/login`.
3. The API first asks the **login rate limiter**: has this address failed too often recently? After 5 wrong passwords for one account (or 20 from one address) in 15 minutes, it answers `429 Too Many Requests` and says how long to wait. This stops password-guessing bots.
4. The API loads the user and compares the password with the stored **bcrypt hash**. The real password is never stored. If the email doesn't exist, it still runs one bcrypt check against a dummy hash, so a wrong email and a wrong password take the same time. Otherwise an attacker could tell which emails are registered.
5. If the password is right, the API creates a **JWT** (a signed token that says "this is user 7, valid for 24 hours") and sends it back.
6. The web app stores the token and attaches it to every later request as `Authorization: Bearer <token>`.

**Where the code is:**

| What | File |
|---|---|
| Sign-in page and form validation | `devtrack-frontend/src/pages/AuthPages.tsx` |
| Login call, token storage, auto-attach token | `devtrack-frontend/src/lib/api.ts` (`api.login`, `tokenStore`, the request interceptor) |
| Logged-in state shared by every page | `devtrack-frontend/src/auth/AuthContext.tsx` |
| Login endpoint | `devtrack-backend/app/api/routes/auth.py` (`login`) |
| Rate limiter | `devtrack-backend/app/core/rate_limit.py` |
| Password hashing and JWT | `devtrack-backend/app/core/security.py` |

> If the token expires, the API answers `401`. A response interceptor in `api.ts` notices, clears the token, and the app sends Priya back to the sign-in page.

---

## Step 2. She opens her project

**What she sees:** a list of projects she belongs to. She clicks **DevTrack Platform** and sees the board.

**What happens:**

1. The page asks the API for `GET /api/v1/projects`.
2. Before the route runs, a dependency called `get_current_user` reads the token, checks its signature and expiry, and loads Priya from the database. No valid token, no access.
3. The route returns only the projects where Priya is a **member** (a row in the `project_members` table). Admins see all projects.
4. Opening one project calls `GET /api/v1/projects/{id}`. The dependency `get_project_for_member` checks membership. If Priya isn't a member, she gets **404 Not Found**, not "403 Forbidden". That way nobody can probe which project ids exist.

**Where the code is:**

| What | File |
|---|---|
| Who-is-logged-in and permission checks | `devtrack-backend/app/api/deps.py` (`get_current_user`, `get_project_for_member`, `require_project_owner`) |
| Project endpoints | `devtrack-backend/app/api/routes/projects.py` |
| Projects page | `devtrack-frontend/src/pages/ProjectsPage.tsx` |
| Pages that need login | `devtrack-frontend/src/auth/RequireAuth.tsx` |

> **Data fetching on the web side:** pages don't call the API directly. They use hooks like `useProjects()` from `src/hooks/queries.ts`. These come from TanStack Query, which caches answers, refreshes stale data, and shows loading states. Two pages asking for the same data share one request.

---

## Step 3. She writes the bug, and AI sorts it

**What she sees:** she clicks **New issue** and types:

> *login dont work* — *Users with Mixed@Case.com emails get "invalid credentials".*

She clicks **Triage with AI**. A few seconds later a box suggests: type **Bug**, priority **Critical**, title *"Login fails for emails with uppercase letters"*. If an open issue already described the same problem, the box would list it under *Possible duplicates*. She clicks **Apply suggestions**.

**What happens:**

1. The web app sends the draft to `POST /api/v1/projects/{id}/ai/triage`.
2. The API loads the project's 50 newest open issues. These are the duplicate candidates.
3. It sends Claude the draft plus those titles. The draft is wrapped in XML tags, and the instructions tell Claude to treat it as data, not as instructions. That guards against someone typing "ignore your rules" into a bug report.
4. It uses **structured outputs**: Claude must answer in a fixed shape, with `type` from {bug, feature, task, improvement} and `priority` from {low, medium, high, critical}. No free-text parsing is needed.
5. The API **double-checks the answer**. If Claude names a duplicate id that wasn't in the candidate list, it is dropped. Made-up ids never reach the screen.
6. Errors become clear HTTP codes: busy (429), not configured (503), refused (422), upstream problem (502).

If there is no `ANTHROPIC_API_KEY`, the endpoint answers 503, `/health` reports `ai_enabled: false`, and the web app hides the AI button. The rest of the app is unaffected.

**Where the code is:**

| What | File |
|---|---|
| New-issue form and AI box | `devtrack-frontend/src/components/issues/CreateIssueModal.tsx` |
| AI endpoint | `devtrack-backend/app/api/routes/ai.py` |
| Prompt, Claude call, answer checks | `devtrack-backend/app/services/ai_triage.py` (`ClaudeTriager.triage`) |
| Tests that use a fake Claude | `devtrack-backend/tests/test_ai.py` |

> **Why a fake in tests?** The Claude client sits behind a small interface (`Triager`). Tests plug in a fake that returns a fixed answer, so they run fast, cost nothing, and never need the network.

---

## Step 4. She saves it, and it becomes DT-15

**What she sees:** the issue appears in the *To do* column as **DT-15** (the demo project already has DT-1 to DT-14).

**What happens:**

1. The web app sends `POST /api/v1/projects/{id}/issues`.
2. **Pydantic** checks the input: title length, allowed priority values, valid date. Bad input gets a `422` that names the field.
3. If an assignee is chosen, the service checks that person is a project member.
4. The service gets the next issue number with one atomic database statement: `UPDATE projects SET issue_counter = issue_counter + 1 … RETURNING issue_counter`. Two people saving at the same moment can never get the same number. A unique constraint on `(project_id, number)` backs this up.
5. It saves the issue and writes a `created` row into the **activity log**.

**Where the code is:**

| What | File |
|---|---|
| Endpoint | `devtrack-backend/app/api/routes/issues.py` (`create_issue`) |
| Numbering, assignee check, history | `devtrack-backend/app/services/issues.py` (`create_issue`, `_record`) |
| Table definitions | `devtrack-backend/app/models.py` (`Issue`, `Activity`) |
| Input rules | `devtrack-backend/app/schemas.py` (`IssueCreate`) |

---

## Step 5. A teammate drags it to "In progress"

**What they see:** Marcus drags DT-15 from *To do* to *In progress*. The card moves instantly, and a toast says "DT-15 → In progress".

**What happens:**

1. The card moves on screen **before** the server answers. This is an **optimistic update**: the app assumes success and updates its cached lists right away.
2. In the background it sends `PATCH /api/v1/issues/{id}` with `{"status": "in_progress"}`.
3. If the server refuses, for example because the network dropped, the app **rolls the card back** and shows the error. Either way it then re-fetches, so the screen matches the database.
4. On the server, `update_issue` compares old and new values. For each field that really changed it writes an activity row, like "status: todo → in_progress". Setting the same value twice records nothing.
5. Moving an issue to **Done** stamps `resolved_at`; moving it out clears it. The dashboard uses this.

The board also works **without a mouse**: focus a card, press Space, use the arrow keys, press Space again.

**Where the code is:**

| What | File |
|---|---|
| Board and drag-and-drop | `devtrack-frontend/src/components/issues/KanbanBoard.tsx` |
| Optimistic update and rollback | `devtrack-frontend/src/hooks/queries.ts` (`useUpdateIssue`) |
| Change detection and history | `devtrack-backend/app/services/issues.py` (`update_issue`) |
| Issue detail, comments, history | `devtrack-frontend/src/components/issues/IssueDetailModal.tsx` |

---

## Step 6. The lead checks the dashboard

**What they see:** counts of open, done and overdue issues, a 14-day chart of created vs resolved, and breakdowns by status and priority. Each chart has a **Show table** button.

**What happens:**

1. The page calls `GET /api/v1/projects/{id}/stats`.
2. The service counts with `GROUP BY` queries in the database, not in Python, so it stays fast as data grows.
3. The 14-day series is filled day by day, so days with no activity still appear as zero.
4. Charts load **on demand**: the chart library is only downloaded when someone opens the dashboard, which keeps the first page load small.

**Where the code is:**

| What | File |
|---|---|
| Dashboard and charts | `devtrack-frontend/src/pages/DashboardPage.tsx` |
| Stats endpoint | `devtrack-backend/app/api/routes/projects.py` (`get_stats`) |
| Counting logic | `devtrack-backend/app/services/stats.py` (`project_stats`) |

---

## Step 7. What keeps it working

These parts never show on screen, but they keep the app safe to change.

**Database migrations** (`devtrack-backend/alembic/versions/`). When the tables change, a migration file changes them in a controlled, reversible way. `0002` moved every v1 user's issues into their own project without losing data. CI runs the migrations against a real PostgreSQL on every push, and checks the models and migrations agree.

**Tests.**
- Backend tests (`devtrack-backend/tests/`) use a fresh in-memory database per test, fake the AI, and cover login, permissions, issues, stats, rate limiting and health checks. Coverage is about 97%.
- Frontend tests (`*.test.tsx`) render real components and click them like a user would.

**CI** (`.github/workflows/ci.yml`). Every push runs lint, type checks, all tests, the migrations, a production build, and the Docker image builds. A red check means something broke.

**Health check** (`GET /health`). Reports whether the database answers and whether AI is on. It returns **503** when the database is down, so hosting platforms can see the service is unhealthy and restart it or alert you.

---

## Glossary

| Term | Meaning here |
|---|---|
| **API** | The Python program the web app talks to. |
| **Endpoint / route** | One URL the API answers, like `POST /api/v1/issues`. |
| **JWT** | A signed login token. The API can check it without a database lookup of sessions. |
| **bcrypt** | A slow-on-purpose password hash, so stolen hashes are hard to crack. |
| **ORM (SQLAlchemy)** | Lets the code use Python classes instead of writing SQL by hand. |
| **Migration (Alembic)** | A versioned script that changes the database tables safely. |
| **Pydantic schema** | A description of valid input/output. Bad input is rejected automatically. |
| **Optimistic update** | Show the change immediately, undo it if the server says no. |
| **Structured output** | Asking the AI for an answer in a fixed JSON shape. |
| **Rate limiting** | Refusing requests that come too often, to stop abuse. |
| **CI** | Automatic checks that run on every push to GitHub. |
