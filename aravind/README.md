# Aravind — standalone Project Management Tracker

Separate app that uses the same `ProjectDashboardPage` UI, with a local Node API and SQLite database.

## Data

| File | What it is |
|------|------------|
| `projects.json` / `tasks.json` / `subtasks.json` | Mapped dashboard rows used to seed the DB |
| `data/projects.raw.json` (and tasks/subtasks) | Raw Kissflow dump (empty if access keys are 401) |
| `data/snapshot.json` | Last dump attempt |
| `backend/data/pm_tracker.db` | SQLite database |

Kissflow list APIs currently return **401** for the configured access keys. Re-run the dump when keys have case/process permission:

```bash
npm run dump
```

## Run

```bash
cd aravind
npm install
npm run seed
npm run dev
```

- UI: http://localhost:4173/
- API: http://localhost:8787/api/dashboard

## API

- `GET /api/projects` `GET /api/tasks` `GET /api/subtasks`
- `GET /api/dashboard`
- `POST /api/projects` `POST /api/tasks` `POST /api/subtasks`
