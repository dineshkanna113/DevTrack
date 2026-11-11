# Development guide

How to run DevTrack on your machine, run the checks, and add a feature.

## 1. Run it

### Option A: Docker (easiest)

```bash
docker compose up --build
docker compose exec api python -m app.seed
```

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API + Swagger docs | http://localhost:8000/docs |
| PostgreSQL | `localhost:5432`, user/password/db all `devtrack` |

Demo login: `demo@devtrack.dev` / `DemoPass123!`.

### Option B: without Docker

**Backend** (Python 3.12):

```bash
cd devtrack-backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env              # then edit DATABASE_URL
alembic upgrade head              # create the tables
python -m app.seed                # optional demo data
uvicorn app.main:app --reload     # http://localhost:8000/docs
```

No PostgreSQL handy? SQLite works for local development:

```bash
set DATABASE_URL=sqlite:///./devtrack.db        # macOS/Linux: export DATABASE_URL=...
```

**Frontend** (Node 20+, **64-bit**):

```bash
cd devtrack-frontend
npm install
cp .env.example .env              # VITE_API_URL=http://localhost:8000
npm run dev                       # http://localhost:5173
```

### Settings (environment variables)

| Variable | Where | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | API | local PostgreSQL | `postgres://…` URLs are accepted and converted |
| `SECRET_KEY` | API | dev-only value | **Required in production**; the API refuses to start without it |
| `ENVIRONMENT` | API | `development` | `production` turns on the secret check |
| `CORS_ORIGINS` | API | `http://localhost:5173` | Comma-separated list of web app URLs |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | API | `1440` | Login lifetime (24 h) |
| `ANTHROPIC_API_KEY` | API | empty | Empty turns AI triage off |
| `AI_MODEL` | API | `claude-opus-5-5` | Claude model for triage |
| `VITE_API_URL` | Web | `http://localhost:8000` in dev | **Required for production builds**; the build fails without it |

## 2. Checks (the same ones CI runs)

```bash
# backend
cd devtrack-backend
ruff check . && ruff format --check .     # lint + formatting
mypy app                                  # strict type check
pytest                                    # tests + coverage report (CI needs ≥ 90%)

# frontend
cd devtrack-frontend
npm run lint
npm run typecheck
npm test
VITE_API_URL=https://example.invalid npm run build
```

CI (`.github/workflows/ci.yml`) also runs the migrations against a real PostgreSQL: `alembic upgrade head`, then `alembic check`, then a full downgrade and upgrade, then the seed script. Then it builds both Docker images.

## 3. Changing the database

1. Edit the model in `app/models.py`.
2. Generate a migration and **read it before committing**. Autogenerate misses some things, like data changes and renamed columns:
   ```bash
   alembic revision --autogenerate -m "add story points"
   ```
3. Apply it: `alembic upgrade head`.
4. Prove models and migrations agree: `alembic check` should print `No new upgrade operations detected.`
5. Test the way back: `alembic downgrade -1`, then `alembic upgrade head`.

To upgrade an old v1 database, which has no migration history, run `alembic stamp 0001` once, then `alembic upgrade head`.

## 4. Recipe: add a field end to end

Example: give issues **story points** (a number from 1 to 13).

| Step | File | Change |
|---|---|---|
| 1. Table | `app/models.py` | `story_points: Mapped[int \| None] = mapped_column(Integer)` on `Issue` |
| 2. Migration | `alembic/versions/` | `alembic revision --autogenerate -m "issue story points"` |
| 3. Input rules | `app/schemas.py` | Add `story_points: int \| None = Field(None, ge=1, le=13)` to `IssueCreate` and `IssueUpdate`; add `story_points: int \| None` to `IssueOut` |
| 4. History | `app/services/issues.py` | Nothing: `update_issue` already records any changed field |
| 5. Tests | `tests/test_issues.py` | Create with points, update them, reject `20` with 422 |
| 6. Types | `devtrack-frontend/src/lib/types.ts` | Add `story_points: number \| null` to `Issue` and `IssueCreate` |
| 7. UI | `CreateIssueModal.tsx`, `IssueDetailModal.tsx`, `KanbanBoard.tsx` | Input in the forms, badge on the card |
| 8. Check | — | Run all checks in section 2 |

Rules of thumb:
- Business rules go in **services**, never in routes or components.
- Permission checks go in **`app/api/deps.py`** as dependencies, never inline in a route.
- New API calls go in **`src/lib/api.ts`**, and the matching hook in **`src/hooks/queries.ts`**.
- Every bug fix gets a test that fails without the fix.

## 5. Windows notes

- **Use 64-bit Node.js.** Tailwind CSS v4 ships native binaries only for 64-bit. On 32-bit Node, `npm run dev` fails with `Cannot find module '../lightningcss.win32-ia32-msvc.node'`. Check with `node -p process.arch`; it should print `x64`.
- **Port 8000 may be taken** by WSL or Docker Desktop relays. If `http://localhost:8000/health` answers something that isn't DevTrack, run the API on another port (`uvicorn app.main:app --port 8010`) and set `VITE_API_URL=http://127.0.0.1:8010`.
- In Git Bash, activate the venv with `source .venv/Scripts/activate`.

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Web app says "Cannot reach the server" | API not running, or wrong `VITE_API_URL` | Start the API; check the URL in `.env`; restart `npm run dev` |
| Browser console shows a CORS error | Web app's URL isn't in `CORS_ORIGINS` | Add it, comma-separated, and restart the API |
| `ValueError: SECRET_KEY must be set in production` | `ENVIRONMENT=production` with the default secret | Set a real `SECRET_KEY` (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `/health` returns 503 | API can't reach the database | Check `DATABASE_URL` and that PostgreSQL is running |
| Login returns 429 | Too many wrong passwords | Wait for the time in `Retry-After`, or restart the API in development |
| AI button missing | No `ANTHROPIC_API_KEY` | Set it and restart; `/health` should show `"ai_enabled": true` |
| `alembic check` reports changes | Model edited without a migration | Generate one (section 3) |
| Production build error about `VITE_API_URL` | Variable not set for the build | Set it in the hosting dashboard or shell |
