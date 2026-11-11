# DevTrack API

The Python backend of DevTrack. It handles accounts, permissions, projects, issues, stats and AI triage, and stores everything in PostgreSQL.

New here? Start with the [walkthrough](../docs/WALKTHROUGH.md), which follows one request through this code. Diagrams are in [ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Run it

```bash
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                                 # point DATABASE_URL at Postgres (or sqlite:///./devtrack.db)
alembic upgrade head                                 # create the tables
python -m app.seed                                   # optional demo data
uvicorn app.main:app --reload                        # http://localhost:8000/docs
```

All settings are listed in [DEVELOPMENT.md](../docs/DEVELOPMENT.md#settings-environment-variables).

## Checks (same as CI)

```bash
ruff check . && ruff format --check .
mypy app
pytest            # coverage report included; CI requires at least 90%
```

## Where things are

```
app/
  main.py        creates the app: middleware, routers, /health
  core/          settings, password hashing + JWT, login rate limiter, request logging
  db/            database engine/session, base class with constraint naming rules
  models.py      the tables (SQLAlchemy 2.0, fully typed)
  schemas.py     what the API accepts and returns (Pydantic v2)
  api/
    deps.py      "who is logged in" and "may they do this" checks
    routes/      one file per area: auth, projects, issues, ai
  services/      business rules: issues (numbering, history), stats, AI triage
  seed.py        demo data: python -m app.seed
alembic/         database migrations, including the v1 -> v2 data migration
tests/           pytest suite: fresh in-memory database per test, Claude faked
```

The rule for adding code: **routes stay thin, rules go in services, permission checks go in `deps.py`.** There's a step-by-step recipe in [DEVELOPMENT.md](../docs/DEVELOPMENT.md#4-recipe-add-a-field-end-to-end).

## Upgrading an existing v1 database

v1 created its tables with `create_all()` and kept no migration history. Mark it as the baseline once, then migrate:

```bash
alembic stamp 0001
alembic upgrade head
```
