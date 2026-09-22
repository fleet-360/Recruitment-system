@AGENTS.md

# CRM השמה — recruitment/placement CRM

Web app for a recruitment company: candidates, business clients (companies → branches → jobs), placements, installment billing, and a business portal. UI is Hebrew RTL. Talk to the user in English; write Notion and UI text in Hebrew.

## Notion is the source of truth — read it, log to it

Project page: https://app.notion.com/p/3e320f5aa25e808289fcd56b1c0be747 (use the Notion MCP tools; fetch by ID).

| Page | ID | What goes there |
|---|---|---|
| איפיון (scope, in/out, scope changes) | `3e320f5aa25e8045a28ac35ca9b71d84` | scope decisions |
| דרישות (REQ-xx / NFR-xx) | `3e320f5aa25e80a98c4de1664f2e60d0` | requirement IDs + acceptance criteria |
| תהליכים (Mermaid flows) | `3e320f5aa25e8099ae02ecc699df3c00` | process flows + decisions |
| מודל נתונים (Mermaid ERD) | `3e320f5aa25e808fa90ef94f62deaf59` | must match `prisma/schema.prisma` |
| מסכים (S-xx office, B-xx portal) | `3e320f5aa25e8037817dfd498d10f08f` | screens, design principles, edge cases |
| מאגר ידע (decision log, conventions, gotchas) | `3e320f5aa25e807dad35f2726bd24cbd` | dated log line for every decision/step |
| סביבות (env var NAMES only, never values) | `3e320f5aa25e8015a2f3eefea458803c` | environments, env vars |
| עלייה לאוויר | `3e320f5aa25e8041b992f0588c29f518` | deployment |
| Kickoff meeting notes | `3e320f5aa25e803291bff1545d557ce7` | original client input (read-only) |

**Tasks** live in the shared משימות database (data source `collection://f398fa67-0edf-4c24-9009-9d7ab09c1c1c`), linked to the project via the `פרויקט` relation. Titles are numbered in build order (`NN · name`). Fields: `סוג` (פיצ׳ר / באג / עדכון), `סטטוס` (לביצוע → בתהליך → בבדיקה → הושלם), `תיאור` (REQ/S ids + the seed data it needs). The next task is the lowest-numbered one that isn't done.

**At the start of a session:** fetch מאגר ידע and the open tasks (and the page relevant to the task) before proposing work.
**While working:** set the task to בתהליך when you start it, בבדיקה when the code is done but not yet checked in the browser or approved by the user, and הושלם when it's approved (and committed). New work, bugs or follow-ups → a new task with the next free number.
**After every decision or finished step:** add a dated Hebrew line to מאגר ידע, and update the affected spec page (schema change → ERD page; new screen → מסכים; flow change → תהליכים). Record *why*, not just what.

## Working methodology

1. Go step by step: spec → ERD → flows → stack → build, one feature at a time. The build order and status are in מאגר ידע.
2. Before building a feature, ask the open questions that change the design; record the answers in Notion. Don't ask what the spec already answers.
3. Each feature step ships **seed data**:
   - Real reference data (lists, cities) → `prisma/seed.ts` (always runs).
   - Fictional demo data → a new section in `prisma/demo.ts`, only via `npm run seed:demo`, never in production. Idempotent, made-up names, phones `050-555xxxx`.
4. Work on a feature branch (`feature/<name>`); commit only when the user asks.
5. Before calling a step done: `npx tsc --noEmit`, `npm run lint`, `npm test`, and check the screens in the browser.

## Stack

Next.js 16 (App Router, TS) · PostgreSQL 17 (Docker) · Prisma 7 (`prisma-client` generator → `src/generated/prisma`, `@prisma/adapter-pg`, `prisma.config.ts`) · Auth.js v5 (email+password for everyone; Google invite-only, hidden until `AUTH_GOOGLE_ID` is set) · Tailwind v4 · lucide-react. Hosting: a VPS with Docker Compose (app + Postgres + Caddy); CV files on the VPS disk.

- Next 16 is newer than your training data: read `node_modules/next/dist/docs/` before using an API. `middleware` is now `proxy`; `params`/`searchParams` are async.
- Keep `prisma` and `@prisma/client` on the same version (the npm `latest` tag pointed at an 8.0 RC).

```
docker compose up -d db        # local Postgres
npx prisma migrate dev         # apply migrations
# non-interactive (Claude): prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<ts>_<name>/migration.sql && npx prisma migrate deploy; restart `npm run dev` after a schema change
npm run seed:demo              # reference data + demo data (or: npx prisma db seed)
npm run dev                    # http://localhost:3000
npm test                       # node:test via tsx, files: src/**/*.test.ts
```

## Code conventions

- **Permissions go through one layer.** Scope every candidate query with `candidateWhere(user)` from `src/lib/access.ts`; business users get only `businessCandidateSelect` (name, city, summary, placement status — no phone, CV, ID or internal notes).
- **Every office page and every server action calls `requireOffice()`** (or `requireAdmin()` for settings). Layouts don't protect server actions.
- **Editable lists** live in the single `LookupValue` table (keyed by `listKey`). Never delete a value — set `isActive=false`. When a form shows a list, keep a record's current (possibly inactive) value selectable with `withCurrent()`, or saving clears it.
- Forms with `useActionState` submit via `<form onSubmit={keepValues(action)}>` (`src/lib/keep-values.ts`), not `action={action}` — React 19 resets the form after an action, so a validation error would wipe what the user typed. New-item forms clear with `key={state?.savedAt}`.
- Validate form input with zod on the server; lookup ids from forms must be checked against the expected list.
- Status changes and money changes write an `Activity` row in the same transaction (audit, NFR-03).
- Uploads: outside `/public`, random file names, served only by `/api/files/[id]` after a permission check.
- UI: soft glass design from the client's example (`glass`, `bg-primary-gradient` teal, `bg-accent-gradient` violet in `globals.css`), mobile-first, RTL. List screens are tables; filters apply on change (`AutoFilterForm`) with a clear-filters button; destructive actions confirm first.
- Keep it simple: no abstractions or dependencies until a second use needs them. Mark deliberate shortcuts with a `ponytail:` comment naming the limit and the upgrade path.
