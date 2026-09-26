# Aricon Portal — prompts for Claude Code

Copy these prompts into Claude Code one phase at a time. `CLAUDE.md` is loaded automatically at the start of every session; `SPEC.md` is read when a prompt asks for it.

## One-time setup

1. Install Node.js 24 LTS, pnpm, Git and Docker Desktop (for the local MongoDB).
2. Create an empty folder `aricon-portal` and put `CLAUDE.md`, `SPEC.md` and `PROMPTS.md` in it.
3. `git init` → commit these three files ("docs: project spec").
4. Create a private GitHub repo (in Aricon's account if possible) and push.
5. Open a terminal in the folder and start Claude Code with `claude`.

## How to work with it

- **One phase per session.** When a phase is committed, start a fresh conversation (`/clear`) for the next phase so old context doesn't confuse it.
- **Always review the plan** it gives before you say `go`. If something in the plan isn't in `SPEC.md`, ask why.
- **Test after each phase yourself** using the steps it gives you. Don't move on with failing tests.
- If it starts inventing things, reply: "That isn't in SPEC.md. Follow §X exactly."
- If you change your mind about a feature, use the change-request prompt at the bottom, so `SPEC.md` stays the source of truth.

---

## Phase 0 — Repository setup

```
Read CLAUDE.md completely, then read SPEC.md sections 0, 1, 3, 15, 17 (Phase 0) and 18.4.

We are starting Phase 0 — Repository setup.

First give me a PLAN only:
- the folder tree you will create,
- every package you will install, with a one-line reason each,
- the root scripts,
- how the design tokens and fonts from §15 will be set up in Tailwind/shadcn,
- how I will verify each acceptance criterion of Phase 0.

Do not write any code until I reply "go".
```

After you approve: `go`

---

## Phase 1 — Shared logic and data layer

```
Read CLAUDE.md, then SPEC.md sections 4, 5, 6 and 17 (Phase 1) and 19.

We are starting Phase 1 — Shared logic and data layer.

Plan first (no code until I say "go"):
- files in packages/shared (schemas, enums, permissions.ts, pricing, delivery fee, order status machine, formatters, phone normalization),
- every Mongoose model with its indexes and hooks,
- the withTransaction helper and the storage driver interface (local + r2),
- seed:admin and seed:demo contents,
- the list of unit tests you will write (the MUST tests in §17 Phase 1 at minimum).

Pricing, tier validation, delivery fee and the state machine must be pure functions with tests before any API uses them.
```

---

## Phase 2a — Customer-facing API

```
Read CLAUDE.md, then SPEC.md sections 6, 7.1, 7.2, 11, 12 and 17 (Phase 2a).

We are starting Phase 2a — Customer-facing API.

Plan first (no code until "go"):
- modules and routes you will add under apps/api/src/modules,
- middleware (customer session, Origin check, rate limits, error handler usage),
- exactly how order placement works step by step (§6.6), including the transaction, the conditional stock update with arrayFilters, idempotency and the 409 cases,
- the facet aggregation for GET /api/products,
- the MUST tests from §17 Phase 2a, including the concurrency test.

Also create apps/api/requests.http with example requests for every endpoint.
```

---

## Phase 2b — Admin API

```
Read CLAUDE.md, then SPEC.md sections 4, 6, 7.1, 7.3, 12.3, 13 and 17 (Phase 2b).

We are starting Phase 2b — Admin API.

Plan first (no code until "go"):
- admin session middleware, requirePermission() and requireAdmin(), forced password change,
- every admin route with its permission (copy the tables from §7.3 and confirm each one),
- field-level checks for products.edit_price and products.edit_stock,
- the audit log helper and which actions call it,
- the Excel import job (§12.3) and export endpoints,
- revalidation calls to Next.js,
- the MUST tests from §17 Phase 2b, including the route-walk test that fails if any admin route has no guard.
```

---

## Phase 3 — Storefront and user panel

```
Read CLAUDE.md, then SPEC.md sections 8, 9, 12.1, 14, 15 and 17 (Phase 3).

We are starting Phase 3 — Storefront and user panel UI in apps/web.

Plan first (no code until "go"):
- the route/file structure under app/(shop) and app/(account),
- apiServer() / apiClient() helpers and how cookies are forwarded,
- the guest cart (localStorage) and merge-after-login flow,
- the component list (header, search suggest, area selector, product card, bulk price ladder, quantity stepper, cart line, checkout sections),
- ISR and revalidation tags, sitemap, robots, JSON-LD,
- how the design direction in §15 is applied (show me the token usage and the bulk price ladder design before building everything).

Build mobile-first and check every page at 390px width. Include loading, empty and error states.
```

---

## Phase 4 — Admin panel

```
Read CLAUDE.md, then SPEC.md sections 4, 10 and 17 (Phase 4).

We are starting Phase 4 — Admin panel UI in apps/web/app/(admin)/admin.

Plan first (no code until "go"):
- admin layout, auth guard (/api/admin/auth/me), forced password change page, Access denied screen,
- sidebar generated from permissions (§10.2),
- the shared DataTable and form field components,
- every admin page from §10.3 to §10.13 with the permission that controls each action,
- the Users page in detail: staff table, add/edit sheet, preset dropdown, grouped checkboxes with tri-state "Select all", dependency auto-ticking, sensitive badges, one-time temporary password dialog, guard-rail messages.

Price fields must be read-only with a lock icon when the user lacks products.edit_price.
```

---

## Phase 5 — Hardening

```
Read CLAUDE.md, then SPEC.md sections 14, 16 and 17 (Phase 5).

We are starting Phase 5 — Hardening.

1. Go through every item of the §16 security checklist. For each: show where it is implemented or fix it, and add a test where possible.
2. Accessibility pass on storefront and admin (keyboard navigation, labels, focus, contrast).
3. Performance: check Lighthouse targets from §14 on home, category and product pages and fix the biggest issues.
4. Light load test of GET /api/products and POST /api/orders (document the command and results in PROGRESS.md).
5. pnpm audit: fix high/critical issues.

Give me a checklist with the status of each item at the end.
```

---

## Phase 6 — Deployment

```
Read CLAUDE.md, then SPEC.md sections 3, 17 (Phase 6) and 18.

We are starting Phase 6 — Deployment to a Hostinger KVM 1 VPS (Ubuntu 24.04) behind Cloudflare, with images on Cloudflare R2.

Create:
- infra/nginx/shop.aricon.com.pk.conf
- infra/ecosystem.config.cjs
- infra/mongod.conf (relevant snippet) and the replica set / user setup commands
- infra/scripts/backup-mongo.sh (+ cron line) and the restore command
- .github/workflows/deploy.yml (build on GitHub, rsync, symlink switch, pm2 reload, health check, automatic rollback, keep 5 releases)
- infra/DEPLOY.md: step-by-step from a fresh VPS, written for someone doing it for the first time: server hardening, swap, Node/pnpm/PM2/Nginx/MongoDB install, Cloudflare DNS + Origin Certificate + SSL mode, R2 buckets + custom domain + API keys, GitHub secrets, first deploy, seed:admin, backups check.

Plan first, then write the files after "go".
```

---

## Review prompt (use at the end of every phase)

```
Before we close this phase: review everything you wrote against the SPEC.md sections for this phase and the security rules in CLAUDE.md. Give me a checklist of gaps, fix them, then run pnpm typecheck, pnpm lint and pnpm test, update PROGRESS.md and commit.
```

## Change request prompt

```
Change request: <describe the change>.
First update SPEC.md (show me the exact diff) and wait for my approval. Then implement it, add or update tests, and update PROGRESS.md.
```

## Bug report prompt

```
Bug: <what happened>
Steps to reproduce: <1, 2, 3>
Expected: <...>
Actual: <...>
Error / logs: <paste>

Find the root cause first and explain it. Write a failing test that reproduces it, then fix it and show the test passing.
```

## PROGRESS.md format (ask Claude Code to keep it like this)

```
# Progress
## Phases
- [x] Phase 0 — Repository setup (date, commit)
- [ ] Phase 1 — ...
## Decisions
- <date>: <decision and reason>
## Known issues / follow-ups
- ...
## Security checklist (Phase 5)
- [ ] ...
```
