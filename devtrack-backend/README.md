# DevTrack API

FastAPI service for DevTrack. See the [root README](../README.md) for the full picture.

```bash
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                                 # point DATABASE_URL at Postgres
alembic upgrade head
python -m app.seed                                   # optional demo data
uvicorn app.main:app --reload                        # http://localhost:8000/docs
```

Quality gates (same as CI):

```bash
ruff check . && ruff format --check .
mypy app
pytest
```

## Layout

```
app/
  core/        settings, security (bcrypt + JWT), request logging
  db/          engine/session, declarative base with naming conventions
  models.py    SQLAlchemy 2.0 typed models
  schemas.py   Pydantic v2 request/response models
  api/         dependencies (auth, RBAC) and routers
  services/    business logic: issues, stats, AI triage (Claude)
alembic/       migrations, including a v1 -> v2 data migration
tests/         pytest suite (SQLite in-memory, Claude client mocked)
```

### Upgrading an existing v1 database

v1 created its tables with `create_all()` and had no migration history. Mark it as
the baseline once, then migrate:

```bash
alembic stamp 0001
alembic upgrade head
```
