# Aricon Portal — instructions for Claude Code

## What we are building

An e-commerce portal for **Aricon** (construction materials, Karachi, Pakistan) at `https://shop.aricon.com.pk`:

- **Storefront** — customers browse, see bulk prices, order (Cash on Delivery or bank transfer).
- **User panel** (`/account`) — orders, addresses, profile, receipt upload, invoices.
- **Admin panel** (`/admin`) — products, orders, customers, delivery, reports, staff with role-based permissions.
- **Express API** (`/api`) — the single backend for all of the above (and a future mobile app).

The full functional spec is in **`SPEC.md`**. Progress is tracked in **`PROGRESS.md`** (create it in Phase 0).

## Golden rules

1. **Read the relevant `SPEC.md` section before every task.** If the spec is unclear or two parts conflict, stop and ask. Never invent business rules, prices, statuses or permissions.
2. **One phase at a time** (`SPEC.md` §17). Start every phase with a short plan: files to create/change, models, endpoints, tests. Wait for approval before writing code.
3. **Scope is fixed.** Anything in `SPEC.md` §1.3 "Out of scope (Phase 2)" must not be built. Keep code extensible, but do not add those features.
4. **No new dependency without a reason.** Use the stack below. If you think something else is needed, say why and ask.
5. **Finish every phase with:** `pnpm typecheck`, `pnpm lint`, `pnpm test` all green → acceptance criteria from §17 checked → `PROGRESS.md` updated → one commit per logical unit (Conventional Commits, e.g. `feat(api): order placement with stock transaction`).
6. **Secrets never go in git.** Read config from env via a validated `env.ts` (Zod). When you add a variable, add it to `.env.example` with a comment.
7. **Do not delete or rewrite working code outside the task.** Small, reviewable diffs.
8. When a task is done, reply with: what changed, how to test it manually, anything left open.

## Stack (fixed)

| Area | Choice |
|---|---|
| Runtime | Node.js 24 LTS, TypeScript (strict) everywhere |
| Monorepo | pnpm workspaces |
| Web (storefront + user panel + admin) | Next.js App Router, Tailwind CSS, shadcn/ui, TanStack Table (admin tables), TanStack Query (client data), React Hook Form + Zod, Recharts (admin charts) |
| API | Express + TypeScript, Zod validation, Mongoose |
| Database | MongoDB, single-node replica set (transactions required) |
| Sessions | express-session + connect-mongo, httpOnly cookies, bcryptjs |
| Files | Multer (memory) + sharp → Cloudflare R2 via `@aws-sdk/client-s3`; local disk driver in development |
| Jobs | Agenda (MongoDB-backed queue), in the API process |
| Email | Nodemailer (SMTP) |
| PDF / Excel | PDFKit / ExcelJS |
| Logging | pino (+ pino-http) |
| Tests | Vitest, Supertest, mongodb-memory-server (replica set) |
| Deploy | GitHub Actions → rsync/SSH → PM2 + Nginx on Ubuntu (Hostinger KVM 1: 1 vCPU, 4 GB RAM), Cloudflare in front |

## Repo layout

```
aricon-portal/
├── apps/
│   ├── web/                      # Next.js
│   │   ├── app/(shop)/           # home, category, brand, search, product, cart, checkout, auth, pages
│   │   ├── app/(account)/account/
│   │   ├── app/(admin)/admin/
│   │   ├── components/ui/        # shadcn/ui
│   │   ├── components/{shop,account,admin}/
│   │   └── lib/                  # api-server.ts, api-client.ts, formatters, hooks
│   └── api/
│       └── src/
│           ├── config/           # env.ts, db.ts, sessions.ts
│           ├── models/           # Mongoose models
│           ├── modules/<name>/   # routes.ts, service.ts, schemas.ts (per feature)
│           ├── middleware/       # auth, requirePermission, errors, rate limits
│           ├── jobs/             # Agenda job definitions
│           ├── lib/              # storage driver, mailer, pdf, excel, audit, revalidate
│           └── scripts/          # seed-admin.ts, seed-demo.ts
├── packages/shared/src/          # zod schemas, types, permissions, pricing, delivery, order state machine, formatters
├── infra/                        # docker-compose.yml, nginx, pm2, mongod.conf, backup script, DEPLOY.md
├── CLAUDE.md  SPEC.md  PROMPTS.md  PROGRESS.md
└── .github/workflows/            # ci.yml, deploy.yml
```

## Commands (create these root scripts in Phase 0)

```
pnpm install
docker compose -f infra/docker-compose.yml up -d   # local MongoDB replica set
pnpm dev              # api (4000) + web (3000) together
pnpm typecheck        # all packages
pnpm lint
pnpm test
pnpm build
pnpm --filter api seed:admin   # first ADMIN account
pnpm --filter api seed:demo    # demo catalog, areas, customers, staff
```

## Code conventions

- **No `any`.** Use `unknown` + Zod parsing at boundaries.
- **One source of truth:** Zod schemas, enums (order status, payment status, roles), permissions, pricing and delivery-fee functions live in `packages/shared` and are imported by both apps. Never re-implement pricing in the UI.
- **Money is an integer number of PKR** (e.g. `425`), never a float. Display only through `formatPKR()` from shared → `"Rs 125,000"`.
- **Dates** stored in UTC, shown in `Asia/Karachi`. Order numbers use the Karachi year.
- **Phone numbers** stored as `+923XXXXXXXXX`; accept `03XX...`, `3XX...`, `+923XX...` via `normalizePkPhone()`.
- **API layers:** route → Zod validate (body, query, params) → service (business logic) → response. No business logic in route handlers, no DB calls in Next.js.
- **API response shape:** `{ data }`, lists `{ data, meta: { page, pageSize, total } }`, errors `{ error: { code, message, details? } }` with correct HTTP status. Error codes are listed in `SPEC.md` §7.1.
- **Errors:** throw `AppError(code, status, message, details?)`; one central error handler; no stack traces in production responses.
- **Mongoose:** models in `api/src/models`, `.lean()` for reads, indexes declared in the schema, `mongoose.set('sanitizeFilter', true)`. Multi-document writes (orders, stock, cancels) go through the `withTransaction()` helper.
- **Next.js:** Server Components by default; `"use client"` only for interactivity. Server-side data via `apiServer()` (calls `INTERNAL_API_URL`, forwards cookies); browser calls via `apiClient()` to same-origin `/api`.
- **UI:** shadcn/ui components, design tokens from `SPEC.md` §15, mobile-first, labels on every input, visible focus, 44px minimum tap targets. UI copy in English, sentence case, plain words; button text says what happens ("Place order", then "Order placed").
- **Files:** kebab-case; React components PascalCase; one module folder per feature in the API.

## Security rules (non-negotiable)

- Permissions come only from `packages/shared/src/permissions.ts`. **Every** `/api/admin/*` route declares `requirePermission(...)` or `requireAdmin()`. Hiding UI is never security.
- Two separate sessions: customers use cookie `aricon_sid` (store `userSessions`); staff use `aricon_admin_sid` (store `adminSessions`). `/api/admin/*` reads only the admin session; everything else reads only the customer session.
- Signup always creates `role: CUSTOMER`; any `role`/`permissions` in a public request body is ignored. Only an ADMIN can change roles or permissions. There must always be at least one active ADMIN.
- Field-level checks: price fields need `products.edit_price`, stock changes need `products.edit_stock` — enforced in the API, read-only in the UI.
- State-changing requests must come from our own origin (Origin check) except `POST /api/public/rfp` (CORS allowlist). Cookies: httpOnly, `Secure` in production, `SameSite=Lax`.
- Rate limits on login, signup, forgot password, receipt upload and RFP. Account lockout after 5 failed logins (15 minutes).
- Uploads: check real file type by magic bytes, enforce size limits, re-encode images with sharp. Receipts are private and only served through 10-minute presigned URLs after a permission check.
- Never log passwords, reset tokens, session ids or full request bodies of auth routes.
- Every admin write that changes prices, stock, order status, payments, customer status, staff, roles, permissions or settings writes an `auditLogs` entry.

## Server constraints (1 vCPU, 4 GB RAM)

- Nothing is built on the server. Builds run in GitHub Actions.
- Heavy work (Excel import, image downloads, emails) runs as Agenda jobs with low concurrency; `sharp.concurrency(1)` in production.
- Queries must use the indexes in `SPEC.md` §5; list endpoints are always paginated (max 100).
- Next.js pages for home/category/product use ISR (revalidate 300 s) plus on-demand revalidation from the API when catalog data changes. Images use a custom `next/image` loader pointing at the pre-sized R2 files (no server-side image optimization).

## Testing expectations

- Unit tests (Vitest) for everything in `packages/shared`: pricing and bulk tiers, cart totals, delivery fee, order state machine, permission dependencies, phone normalization.
- API tests (Supertest + in-memory replica set) for auth, permission checks (403s), order placement, concurrency (no overselling), idempotency, price-change conflict, cancel/return restock, receipt flow, field-level price/stock permissions.
- The minimum tests per phase are listed in `SPEC.md` §17.
