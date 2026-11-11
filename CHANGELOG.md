# Changelog

## Unreleased

### Interface
- Redesigned the web app. A sidebar now lists your projects, and the top bar shows breadcrumbs and a profile menu. On phones the sidebar opens as a slide-in menu.
- Board columns have status-coloured markers and count chips. Each issue card shows its key, priority, type, due date and assignee in fixed places.
- New split-screen sign-in and sign-up pages, with a product overview beside the form.
- Project cards show open, done and total counts. The dashboard cards include a short explanation under each number.
- Colours now come from light and dark design tokens in `src/index.css`. Inter and JetBrains Mono fonts are loaded from Google Fonts.
- The layout patterns come from the Watermelon UI "Jobtracker" dashboard, rebuilt with plain Tailwind (no new dependencies).

## 2.1.0 — 2026-11-09

### Security
- **Login rate limiting.** After 5 failed logins for one account from one address, or 20 from one address, within 15 minutes, `POST /auth/login` answers `429 Too Many Requests` with a `Retry-After` header. A successful login resets the account's counter.
- **No email discovery by timing.** Logins for unknown emails now run the same bcrypt check (against a dummy hash) as wrong passwords, so response time no longer reveals which emails are registered.

### Reliability
- **`/health` returns 503 when the database is unreachable** (it returned 200 before). Hosting health checks now detect a broken database instead of serving an app that fails every request.
- **Production web builds fail without `VITE_API_URL`.** Previously such a build silently pointed the app at `http://localhost:8000`, which is what broke the live demo.

### Fixes
- Issue history now shows display labels for priority and type ("High to Critical"), as it already did for status, instead of raw values ("high to critical").

### Documentation
- Rewrote the README in plain language, with screenshots and a two-minute quick start.
- Added `docs/WALKTHROUGH.md`: one bug report followed through every layer, with file references.
- Added `docs/ARCHITECTURE.md`: system, data model, request flow, permissions, security, AI and frontend diagrams.
- Added `docs/DEVELOPMENT.md`: setup, checks, migrations, an add-a-field recipe, Windows notes, troubleshooting.
- Added `docs/DEPLOYMENT.md`: Render and Vercel setup, and the steps to fix the current live demo.
- Added `docs/INTERVIEW_GUIDE.md`: pitches, design trade-offs, likely questions, honest limitations.

## 2.0.0 — 2026-10-25

Rebuilt from v1 into a team issue tracker:
- Projects with members and roles, issue keys (`DT-12`), statuses, priorities, types, due dates, comments, activity log.
- Search, filters, sorting and pagination; dashboard stats.
- AI triage with Claude (type, priority, title, summary, duplicates).
- TypeScript frontend with a drag-and-drop Kanban board, dark mode and charts.
- Alembic migrations, including a reversible v1 → v2 data migration.
- pytest, Vitest, Ruff, mypy, ESLint; GitHub Actions CI; Docker; Render blueprint.
