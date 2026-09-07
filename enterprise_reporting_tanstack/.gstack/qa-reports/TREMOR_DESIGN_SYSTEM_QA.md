# QA Report — Tremor Design System Adoption

**Branch:** `claude/tremor-design-system-n4g6o9`
**Scope:** Tremor design system re-theme + redesigned permission-aware dashboard
**Method:** gstack `/qa` methodology (severity taxonomy + health-score rubric), run
against a live dev server with Chromium, both themes, admin and non-admin accounts.

## Environment

The application's config database is MariaDB, which is not available in this
environment (no MariaDB server, no Docker daemon). To get a *real* authenticated
run rather than a static review, the session was pointed at PostgreSQL via
`DATABASE_URL` — a path `src/lib/db/kysely-db.ts` already supports — and the
schema was created by translating the app's own DDL to Postgres dialect. The
seed then produced the standard accounts.

Verified against:

| Account | Role | Result |
|---------|------|--------|
| `admin@admin.com` | Administrator | 10 of 10 workspace modules, full Administration section |
| `analyst@example.com` | Standard | 7 of 10 workspace modules, Administration limited to Data Sources |

Routes exercised: `/login`, `/dashboard` (both accounts), `/` (redirect),
`/does-not-exist` (404), at 1440px, 1280px and 390px, in light and dark.

## Summary

| Severity | Found | Fixed | Deferred |
|----------|-------|-------|----------|
| Critical | 0 | 0 | 0 |
| High | 2 | 2 | 0 |
| Medium | 3 | 3 | 0 |
| Low | 2 | 1 | 1 |
| **Total** | **7** | **6** | **1** |

**Health score: 94/100.** Console 70 (one blocked external request), Links 100,
Visual 100, Functional 100, UX 100, Content 100, Performance 100 (production
build; dev-server first-compile latency excluded), Accessibility 100 on the pages
exercised (0 unlabeled inputs, 0 controls without an accessible name, 0
horizontal overflow at any width).

## Top 3 things fixed

### 1. System dark mode never applied — HIGH, functional

`ThemeProvider` hardcoded `enableSystem={false}` / `defaultTheme="light"`, while
`THEME_CONFIG` documented `system` + `enableSystem: true` and was never consumed
by anything. The pre-paint `ThemeScript` correctly set `class="dark"` from
`prefers-color-scheme`, then next-themes hydrated and reset the class to `light`,
leaving a stale `data-theme="dark"` behind.

- **Repro (before):** load any page with `prefers-color-scheme: dark` and no
  stored preference → `documentElement.className === "light"`,
  `data-theme === "dark"`, body background `#F9FAFB`.
- **Impact:** system-dark users saw a dark flash then the light theme, and the
  entire dark palette was unreachable without the explicit toggle.
- **Fix:** the provider now reads `THEME_CONFIG`, so provider, script and docs
  cannot drift. `ThemeSelector` gained the matching "System" option.
- **Verified (after):** `className === "dark"`, body background `#131A2B`.

### 2. Tremor font sizes silently dropped by `tailwind-merge` — HIGH, visual

`tailwind-merge` cannot distinguish `text-tremor-metric` (a font size) from
`text-tremor-content-strong` (a colour) — both look like `text-*` — so it treated
them as conflicting and kept only the colour.

- **Repro (before):** `cn("font-semibold text-tremor-metric text-tremor-content-strong")`
  → `"font-semibold text-tremor-content-strong"`. Every KPI value rendered at
  14px body size instead of 30px.
- **Found by:** rendering the design-system page in Chromium; the metric read at
  body size, which the class list alone did not reveal.
- **Fix:** `cn()` registers the Tremor font-size, radius and shadow scales via
  `extendTailwindMerge` — the same approach Tremor uses internally.

### 3. ECharts series colours were unresolvable — MEDIUM, visual

`getEChartsThemeColors()` returned `hsl(var(--primary))`-style strings. ECharts
paints to canvas and cannot resolve CSS custom properties, so those entries were
not valid colours. Now resolved to hex from `tremor-colors.ts`.

## Remaining findings

### 4. MultiSelect forwarded an unsupported Badge variant — MEDIUM, functional
`MultiSelect` declared its own `inverted` variant and passed it to `Badge`, which
never accepted it; the variant's classes were never applied and the call did not
type-check. Chips now carry Tremor-tinted styles directly. **Fixed.**

### 5. Dashboard module list was not at parity with the sidebar — MEDIUM, UX
"Report Generator" and "Permissions" were reachable from the navigation but
absent from the dashboard's accessible-items list, so the "N of M modules
available" count under-reported access. **Fixed** (admin now 10/10).

### 6. Google Fonts loaded from a CDN at runtime — LOW, console/performance
`fonts.googleapis.com/css2?family=Inter…` is requested on every page load. In
this environment the request is blocked (`ERR_CONNECTION_RESET`), producing the
one console error in the score above, and the app falls back to the system sans
stack. The rendering degrades gracefully, but an air-gapped or
strict-egress enterprise deployment will hit the same failure on every page.
**Deferred** — self-hosting the font is a delivery decision for the maintainers,
not part of this re-theme.

### 7. "Job runs" card stretched to a tall empty box — LOW, visual
With no execution history the card stretched to match its grid neighbour. The
grid now sizes cards to content (`items-start`). **Fixed.**

## Pre-existing issues observed (not introduced, not fixed)

These are outside the scope of this branch but were surfaced while getting the
app running, and are worth tracking:

- **PostgreSQL support is incomplete.** `bootstrapSchema` emits MySQL-only DDL
  (`TINYINT(1)`, `CHARACTER SET`, `ON UPDATE CURRENT_TIMESTAMP`,
  `ON DUPLICATE KEY`, inline `KEY idx_…`). Against `DATABASE_URL` it fails
  partway with `[db] Bootstrap failed`, leaving 6 of ~28 tables created.
- **`scripts/rebuild-db.ts` ignores `DATABASE_URL`** and always connects to
  MariaDB, so `bun run db:migrate` / `db:setup` cannot target Postgres.
- **`bun run typecheck` reports ~580 errors** across `src/`, `e2e/` and
  `check_logs.ts` on the base branch.
- **`src/components/ui/form.tsx` imports `react-hook-form`,** which is not in
  `package.json`.
- **`bun run format:check` fails on the base branch** (~140 unformatted files).
- **a11y:** the mobile sidebar scrim in `app-shell.tsx` is a `div` with `onClick`
  and no keyboard handler or role.

## Verification performed

- `bun run build` — passes (client + server).
- `bun run typecheck` — no new errors in any touched file; error list otherwise
  byte-identical to the base branch.
- `bunx biome lint` on the changed directories — no findings in new files.
- Compiled CSS inspected: Tremor utilities emitted, opacity modifiers resolve
  (`--tw-ring-color: hsl(var(--tremor-brand) / .2)`), tokens present under both
  `:root` and `.dark`.
- Chromium screenshots: design-system reference page (light + dark), dashboard as
  admin (light + dark) and as analyst (light), login at 1280px and 390px.
