# DevTrack Web

React 19 + TypeScript SPA for DevTrack. See the [root README](../README.md).

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8000
npm run dev               # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm run typecheck` | `tsc` in strict mode |
| `npm test` | Vitest + React Testing Library |

> **Windows note:** Tailwind CSS v4 ships native binaries for 64-bit Node only.
> If `npm run dev` fails with `lightningcss.win32-ia32-msvc.node`, install the
> x64 build of Node.js.
