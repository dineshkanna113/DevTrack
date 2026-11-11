# DevTrack Web

The React 19 + TypeScript web app for DevTrack. It draws every screen and talks to the API over JSON.

New here? The [walkthrough](../docs/WALKTHROUGH.md) shows which file handles each screen, and [ARCHITECTURE.md](../docs/ARCHITECTURE.md#8-frontend-structure) explains the folder layout and rules.

## Run it

Needs **64-bit** Node.js 20+ (check: `node -p process.arch` should print `x64`).

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8000
npm run dev               # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with instant reload |
| `npm run build` | Type-check and build to `dist/`. **Fails unless `VITE_API_URL` is set**, so a deploy can't point at `localhost` by mistake |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm run typecheck` | `tsc` in strict mode |
| `npm test` | Vitest + React Testing Library |

## Where things are

| Folder | What's in it |
|---|---|
| `src/pages/` | One file per screen: sign-in, projects, board/list, dashboard |
| `src/components/issues/` | Board, issue cards, new-issue dialog (with AI triage), issue detail dialog |
| `src/components/ui.tsx` | Buttons, inputs, dialogs, badges: the shared UI kit |
| `src/components/Layout.tsx` | The app shell: sidebar, top bar, mobile menu |
| `src/index.css` | Design tokens (colours for light and dark mode) |
| `src/lib/api.ts` | Every API call, the login token, error messages |
| `src/hooks/queries.ts` | Data loading and caching (TanStack Query), including optimistic board moves |
| `src/auth/` | Logged-in state and the guard for private pages |

> **Windows note:** Tailwind CSS v4 ships native binaries for 64-bit Node only. On 32-bit Node, `npm run dev` fails with `lightningcss.win32-ia32-msvc.node`. Install the x64 build of Node.js.
