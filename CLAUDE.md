# Aricon Portal — Instructions for Claude Code

## 1. What We Are Building

An e-commerce portal for **Aricon** (construction materials, Karachi, Pakistan) at:

`https://shop.aricon.com.pk`

### Applications

* **Storefront** — customers browse products, view bulk prices, and place orders using Cash on Delivery or bank transfer.
* **User panel** — `/account`

  * Orders
  * Addresses
  * Profile
  * Receipt upload
  * Invoices
* **Admin panel** — `/admin`

  * Products
  * Orders
  * Customers
  * Delivery
  * Reports
  * Staff
  * Role-based permissions
* **API** — `/api`

  * Single backend for storefront, account, admin, and future mobile applications.

The complete functional specification is in `SPEC.md`.

Progress is tracked in `PROGRESS.md`.

---

# 2. Golden Rules

These rules are mandatory.

### 2.1 Read the specification first

Before starting **every task**:

1. Read the relevant section of `SPEC.md`.
2. Check related sections if the task crosses multiple domains.
3. Check `PROGRESS.md` for existing implementation status.
4. Inspect the existing code before proposing changes.

If the specification is unclear or two parts conflict:

**Stop and ask for clarification.**

Never invent:

* Business rules
* Prices
* Order statuses
* Payment rules
* Permissions
* Delivery rules
* Validation rules
* API behavior

The specification is the source of truth.

---

### 2.2 One phase at a time

Follow `SPEC.md §17`.

Before writing code for a phase, provide a short implementation plan containing:

* Files to create
* Files to modify
* Database models/changes
* API endpoints
* Shared schemas/types
* UI changes
* Tests
* Dependencies, if any

**Wait for approval before implementing the phase.**

Do not silently start multiple phases.

---

### 2.3 Fixed scope

Anything listed in:

`SPEC.md §1.3 — Out of scope (Phase 2)`

must not be implemented.

Code may be designed to remain extensible, but Phase 2 functionality must not be built early.

---

### 2.4 No unnecessary dependencies

Use the fixed stack defined below.

Do not install a new dependency simply because it is convenient.

If a new dependency appears necessary:

1. Explain why.
2. Explain why the existing stack cannot solve it.
3. Ask for approval.
4. Only install it after approval.

---

### 2.5 Small and reviewable changes

Do not rewrite working code unnecessarily.

Rules:

* Prefer small diffs.
* Modify only files relevant to the task.
* Reuse existing utilities and patterns.
* Do not rename things without a reason.
* Do not refactor unrelated code.
* Do not "clean up" unrelated files.
* Do not replace an existing implementation unless required.

---

### 2.6 Completion requirements

Every completed phase must finish with:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

All relevant checks must pass.

Then:

1. Verify the acceptance criteria from `SPEC.md §17`.
2. Update `PROGRESS.md`.
3. Explain manual testing steps.
4. Mention anything remaining or intentionally deferred.
5. Create one logical Conventional Commit per logical unit.

Example:

```text
feat(api): add order placement with stock transaction
```

Never create meaningless commits such as:

```text
update stuff
changes
fix
work
```

---

# 3. AI / Vibe Coding Rules

This project is intentionally developed with AI-assisted coding.

AI must behave like a careful senior engineer, not an autonomous code generator.

### Before coding

Always:

```text
Read spec
→ inspect existing implementation
→ understand architecture
→ identify affected files
→ propose plan
→ wait for approval
→ implement
→ test
→ review diff
```

### Do not

* Generate an entire application without phase approval.
* Create duplicate utilities.
* Create duplicate API clients.
* Create duplicate schemas.
* Introduce alternative architecture patterns.
* Guess missing requirements.
* Replace established patterns with personal preferences.
* Add libraries without approval.
* Modify unrelated files.
* Remove existing functionality to make tests pass.

### Prefer

* Existing shared utilities.
* Existing types and Zod schemas.
* Existing NestJS modules/services.
* Existing UI components.
* Existing error handling.
* Existing repository/database patterns.
* Existing authentication and permission infrastructure.

When unsure, ask instead of guessing.

---

# 4. Stack

The stack is fixed unless explicitly changed.

| Area                | Choice                                     |
| ------------------- | ------------------------------------------ |
| Runtime             | Node.js 24 LTS                             |
| Language            | TypeScript, strict mode                    |
| Package manager     | pnpm                                       |
| Monorepo            | Turborepo + pnpm workspaces                |
| Web                 | Next.js App Router + React                 |
| Styling             | Tailwind CSS                               |
| UI                  | shadcn/ui                                  |
| Tables              | TanStack Table                             |
| Client data         | TanStack Query                             |
| Forms               | React Hook Form + Zod                      |
| Charts              | Recharts                                   |
| API                 | NestJS + TypeScript                        |
| API validation      | Zod                                        |
| API architecture    | NestJS modules/controllers/services        |
| Database            | MongoDB                                    |
| ODM                 | Mongoose                                   |
| MongoDB             | Single-node replica set                    |
| Transactions        | MongoDB transactions                       |
| Sessions            | express-session + connect-mongo            |
| Cookies             | httpOnly cookies                           |
| Password hashing    | bcryptjs                                   |
| Files               | Multer memory storage + sharp              |
| Object storage      | Cloudflare R2 via `@aws-sdk/client-s3`     |
| Development storage | Local disk driver                          |
| Jobs                | Agenda                                     |
| Email               | Nodemailer                                 |
| PDF                 | PDFKit                                     |
| Excel               | ExcelJS                                    |
| Logging             | pino + pino-http                           |
| Tests               | Vitest + Supertest + mongodb-memory-server |
| Deployment          | GitHub Actions → rsync/SSH → PM2 + Nginx   |
| Server              | Ubuntu, Hostinger KVM 1                    |
| Server resources    | 1 vCPU, 4 GB RAM                           |
| CDN / proxy         | Cloudflare                                 |

---

# 5. Repository Architecture

This is a Turborepo monorepo.

```text
aricon-portal/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   │   ├── (shop)/
│   │   │   ├── (account)/
│   │   │   └── (admin)/
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── shop/
│   │   │   ├── account/
│   │   │   └── admin/
│   │   │
│   │   └── lib/
│   │       ├── api-server.ts
│   │       ├── api-client.ts
│   │       ├── formatters/
│   │       └── hooks/
│   │
│   └── api/
│       └── src/
│           ├── config/
│           ├── models/
│           ├── modules/
│           ├── middleware/
│           ├── jobs/
│           ├── lib/
│           └── scripts/
│
├── packages/
│   └── shared/
│       └── src/
│           ├── schemas/
│           ├── types/
│           ├── permissions.ts
│           ├── pricing/
│           ├── delivery/
│           ├── order-state-machine/
│           └── formatters/
│
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/
│   ├── pm2/
│   ├── mongod.conf
│   ├── backup/
│   └── DEPLOY.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── CLAUDE.md
├── SPEC.md
├── PROMPTS.md
├── PROGRESS.md
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

---

# 6. Application Responsibilities

## 6.1 `apps/web`

Next.js frontend containing:

* Storefront
* Customer account
* Admin panel

The frontend must never connect directly to MongoDB.

All business data goes through the NestJS API.

---

## 6.2 `apps/api`

NestJS backend.

Responsibilities:

* Authentication
* Authorization
* Business logic
* Database access
* Orders
* Products
* Inventory
* Payments
* Delivery
* Files
* Email
* Background jobs
* Admin operations
* Audit logging

The API must remain independent from the Next.js application so a future mobile application can consume the same API.

---

## 6.3 `packages/shared`

The single source of truth for logic shared between web and API.

Examples:

* Zod schemas
* Types
* Enums
* Permissions
* Pricing
* Bulk pricing
* Delivery fees
* Order state machine
* Phone normalization
* Money formatting
* Shared formatters

Do not duplicate these rules inside individual applications.

---

# 7. Root Commands

The following commands must be available from the repository root:

```bash
pnpm install
```

Start local MongoDB:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Start all development applications:

```bash
pnpm dev
```

Type checking:

```bash
pnpm typecheck
```

Lint:

```bash
pnpm lint
```

Tests:

```bash
pnpm test
```

Build:

```bash
pnpm build
```

Seed admin:

```bash
pnpm --filter api seed:admin
```

Seed demo data:

```bash
pnpm --filter api seed:demo
```

Turborepo should orchestrate application/package tasks.

---

# 8. API Architecture

The API uses NestJS.

Follow this general flow:

```text
HTTP Request
    ↓
Controller
    ↓
Validation
    ↓
Guard / Permission
    ↓
Service
    ↓
Repository / Mongoose
    ↓
MongoDB
```

Controllers must remain thin.

Business logic belongs in services.

Database operations must not be implemented directly inside controllers.

---

## 8.1 NestJS module structure

Each feature should follow:

```text
modules/
└── products/
    ├── products.module.ts
    ├── products.controller.ts
    ├── products.service.ts
    ├── schemas.ts
    ├── dto/
    └── tests/
```

Use the same structure consistently across modules.

---

# 9. API Validation

All external input must be validated.

Validate:

* Body
* Query parameters
* Route parameters
* Headers where required
* File metadata where applicable

Use Zod at API boundaries.

Never trust:

* Browser validation
* UI state
* Client-provided roles
* Client-provided permissions
* Client-provided prices
* Client-provided totals

---

# 10. API Response Format

Successful single-resource response:

```json
{
  "data": {}
}
```

Paginated response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

Error response:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Use correct HTTP status codes.

Error codes must follow `SPEC.md §7.1`.

---

# 11. Error Handling

Use a central application error abstraction.

```text
AppError
```

Conceptually:

```text
AppError(code, status, message, details?)
```

Use one centralized NestJS exception/error handling mechanism.

Production responses must never expose:

* Stack traces
* Internal MongoDB errors
* Secrets
* Session identifiers
* Sensitive implementation details

---

# 12. Database Rules

MongoDB is the database.

Mongoose models belong in:

```text
apps/api/src/models/
```

Rules:

* Use `.lean()` for read-only queries where appropriate.
* Declare indexes in schemas.
* Enable:

```ts
mongoose.set('sanitizeFilter', true);
```

* Follow the indexes defined in `SPEC.md §5`.
* All list endpoints must be paginated.
* Maximum page size is 100.

---

# 13. Transactions

MongoDB transactions are required for multi-document writes.

Examples:

* Order placement
* Stock deduction
* Order cancellation
* Stock restoration
* Payment state changes where multiple documents are affected

Use a shared transaction helper such as:

```text
withTransaction()
```

Never manually implement inconsistent transaction patterns across modules.

---

# 14. Shared Business Rules

Business logic that must remain identical between frontend and backend belongs in:

```text
packages/shared/
```

Examples:

```text
pricing
delivery fees
bulk pricing
order states
permissions
phone normalization
formatPKR
```

Never calculate authoritative prices in the frontend.

The backend is always authoritative for:

* Product prices
* Bulk pricing
* Discounts
* Delivery charges
* Order totals
* Stock
* Permissions

The frontend may display calculated values but must never be trusted as the source of truth.

---

# 15. Money

All money values are integer PKR.

Correct:

```ts
425
125000
```

Incorrect:

```ts
425.50
125000.75
```

Never use floating point values for monetary amounts.

Display money using:

```ts
formatPKR()
```

Example:

```text
Rs 125,000
```

---

# 16. Dates and Time

Store dates in UTC.

Display dates in:

```text
Asia/Karachi
```

Order numbers use the Karachi year.

Do not implement ad-hoc timezone conversions throughout the application.

Use centralized date/time utilities.

---

# 17. Phone Numbers

Canonical storage format:

```text
+923XXXXXXXXX
```

The system accepts:

```text
03XX...
3XX...
+923XX...
```

Normalize using:

```text
normalizePkPhone()
```

Do not create separate phone normalization logic in individual modules.

---

# 18. Next.js Rules

Use Next.js App Router.

Server Components are the default.

Only use:

```text
"use client"
```

when client-side interactivity is actually required.

Avoid turning entire pages into Client Components unnecessarily.

---

## 18.1 Server-side API calls

Use:

```text
apiServer()
```

for server-side requests.

It calls:

```text
INTERNAL_API_URL
```

and forwards the required cookies.

---

## 18.2 Browser API calls

Use:

```text
apiClient()
```

for browser-side requests.

Browser requests should use the application's same-origin:

```text
/api
```

Do not expose internal backend URLs unnecessarily to the browser.

---

## 18.3 No database access from Next.js

Never import:

* Mongoose
* MongoDB clients
* Database models
* API database repositories

into `apps/web`.

Next.js communicates with the NestJS API only.

---

# 19. Frontend Data Fetching

Use:

* Server Components for initial server-rendered data.
* TanStack Query for client-side data fetching, caching and mutations where appropriate.
* React Hook Form + Zod for forms.
* Shared Zod schemas from `packages/shared` wherever applicable.

Do not introduce another data-fetching library.

---

# 20. UI Rules

Use:

* Tailwind CSS
* shadcn/ui
* TanStack Table
* Recharts

Design must be:

* Mobile-first
* Accessible
* Consistent
* Simple
* Production-oriented

Every form input must have a visible label.

Interactive elements must have visible focus states.

Minimum touch target:

```text
44px
```

UI copy:

* English
* Sentence case
* Plain words
* No unnecessary technical terminology

Button text should describe the action.

Good:

```text
Place order
Upload receipt
Save address
Cancel order
```

Avoid:

```text
Submit
Process
Execute
Continue
```

when a more specific action is available.

---

# 21. E-commerce SEO / Rendering

Public storefront pages must be designed with SEO in mind.

Relevant pages include:

```text
/
 /category/*
 /brand/*
 /search
 /product/*
```

Use Next.js server rendering/ISR as appropriate.

Home, category and product pages should use:

```text
revalidate: 300
```

Catalog changes should trigger on-demand revalidation from the API.

Do not make public product pages dependent entirely on client-side rendering.

---

# 22. Images

Product images are stored in Cloudflare R2.

Use pre-sized R2 images.

Next.js must use a custom `next/image` loader pointing to the pre-sized R2 files.

Do not rely on server-side Next.js image optimization because the production server has limited resources.

---

# 23. Authentication

Use:

```text
express-session
connect-mongo
bcryptjs
```

Sessions use httpOnly cookies.

Production cookies must be:

```text
httpOnly
secure
sameSite=lax
```

---

# 24. Separate Customer and Admin Sessions

There are two completely separate sessions.

### Customer

Cookie:

```text
aricon_sid
```

Storage:

```text
userSessions
```

Used by:

```text
/api/*
```

except admin routes.

### Admin/staff

Cookie:

```text
aricon_admin_sid
```

Storage:

```text
adminSessions
```

Used by:

```text
/api/admin/*
```

Admin routes must never authenticate using the customer session.

Customer routes must never use the admin session.

---

# 25. Authorization

Permissions are defined only in:

```text
packages/shared/src/permissions.ts
```

Every:

```text
/api/admin/*
```

route must explicitly declare the required permission or admin requirement.

Use:

```text
requirePermission(...)
```

or:

```text
requireAdmin()
```

Hiding a UI button is **not** authorization.

Authorization must always be enforced server-side.

---

# 26. Roles

Public signup always creates:

```text
role: CUSTOMER
```

Never accept public request values for:

```text
role
permissions
```

Only an authorized ADMIN may modify roles or permissions.

There must always be at least one active ADMIN.

---

# 27. Field-level Permissions

Price changes require:

```text
products.edit_price
```

Stock changes require:

```text
products.edit_stock
```

These permissions must be enforced in the API.

The frontend only controls visibility and user experience.

---

# 28. Origin / CSRF Protection

State-changing requests must originate from our own origin.

Exception:

```text
POST /api/public/rfp
```

may use the configured CORS allowlist.

Cookies:

```text
httpOnly
Secure in production
SameSite=Lax
```

---

# 29. Rate Limiting and Account Security

Rate limits are required for:

* Login
* Signup
* Forgot password
* Receipt upload
* RFP submission

Account lockout:

```text
5 failed login attempts
→ 15 minute lockout
```

Never log:

* Passwords
* Reset tokens
* Session IDs
* Authentication secrets
* Full request bodies from auth routes

---

# 30. File Upload Security

Uploads must:

1. Validate real file type using magic bytes.
2. Enforce configured size limits.
3. Re-encode images using `sharp`.
4. Never trust only the file extension or MIME type.
5. Store files using the configured storage driver.

Development:

```text
Local disk
```

Production:

```text
Cloudflare R2
```

Receipts are private.

Receipts must only be served through:

```text
10-minute presigned URLs
```

after a permission check.

---

# 31. Audit Logging

Every admin write that changes any of the following must create an `auditLogs` entry:

* Prices
* Stock
* Order status
* Payments
* Customer status
* Staff
* Roles
* Permissions
* Settings

Audit logs must contain enough information to determine:

* Who performed the action
* What changed
* When it changed
* Relevant resource/entity

Never store passwords, tokens or other secrets in audit logs.

---

# 32. Background Jobs

Use Agenda with MongoDB.

Heavy work must not block HTTP requests.

Examples:

* Excel imports
* Image downloads
* Email sending
* Other expensive asynchronous operations

Use low concurrency because production runs on:

```text
1 vCPU
4 GB RAM
```

Production:

```ts
sharp.concurrency(1)
```

---

# 33. Email

Use Nodemailer with SMTP.

SMTP configuration must come from environment variables.

Never hard-code:

* SMTP credentials
* Host
* Password
* API keys

---

# 34. PDF / Excel

Use:

```text
PDFKit
ExcelJS
```

Do not add another PDF or Excel library without explicit approval.

Heavy report/export operations should run through Agenda when appropriate.

---

# 35. Logging

Use:

```text
pino
pino-http
```

Logs must be structured.

Never log:

* Passwords
* Session IDs
* Reset tokens
* Authentication credentials
* Sensitive request bodies

Production logs should be useful for debugging without exposing customer secrets.

---

# 36. Environment Variables

All configuration must be loaded through a validated:

```text
env.ts
```

using Zod.

Never access secrets through scattered direct environment reads.

When adding an environment variable:

1. Add it to `env.ts`.
2. Add it to `.env.example`.
3. Add a useful comment explaining it.
4. Never commit the actual secret.

Secrets never go into Git.

---

# 37. Testing

Testing stack:

```text
Vitest
Supertest
mongodb-memory-server
```

MongoDB tests must use a replica set because production transactions require replica-set behavior.

---

## 37.1 Shared package tests

Unit tests are required for:

* Pricing
* Bulk tiers
* Cart totals
* Delivery fees
* Order state machine
* Permission dependencies
* Phone normalization
* Formatters where business-critical

---

## 37.2 API tests

Tests must cover at minimum the requirements defined by `SPEC.md §17`.

Important scenarios include:

* Authentication
* Permission checks
* 403 responses
* Order placement
* Concurrent stock updates
* No overselling
* Idempotency
* Price-change conflicts
* Cancellation
* Return/restock
* Receipt flow
* Price permission checks
* Stock permission checks

Do not remove security or business-rule tests simply to make the suite pass.

---

# 38. Server Constraints

Production server:

```text
Hostinger KVM 1
1 vCPU
4 GB RAM
Ubuntu
```

The production server must not build the application.

Builds happen in GitHub Actions.

Deployment:

```text
GitHub Actions
    ↓
Build
    ↓
Tests
    ↓
SSH / rsync
    ↓
Ubuntu VPS
    ↓
PM2
    ↓
Nginx
    ↓
Cloudflare
```

---

# 39. Production Processes

Use PM2 to manage:

```text
Next.js web
NestJS API
```

Do not introduce unnecessary processes.

Background Agenda jobs run inside the API process unless the specification explicitly requires otherwise.

---

# 40. Nginx

Nginx handles:

* Reverse proxy
* HTTPS termination where applicable
* Web traffic routing
* API routing
* Request limits where appropriate

Expected architecture:

```text
Internet
   ↓
Cloudflare
   ↓
Nginx
   ├── shop.aricon.com.pk → Next.js
   └── shop.aricon.com.pk/api → NestJS
```

The exact routing must follow the deployment specification.

---

# 41. Deployment

Deployment is handled through GitHub Actions.

Production flow:

```text
git push
    ↓
GitHub Actions
    ↓
Install dependencies
    ↓
Typecheck
    ↓
Lint
    ↓
Tests
    ↓
Build
    ↓
rsync / SSH
    ↓
PM2 reload
```

The production server must not contain development secrets in Git.

---

# 42. Naming Conventions

Files:

```text
kebab-case
```

React components:

```text
PascalCase
```

NestJS classes:

```text
PascalCase
```

Variables/functions:

```text
camelCase
```

Constants:

```text
SCREAMING_SNAKE_CASE
```

One feature/module per API module.

---

# 43. TypeScript Rules

TypeScript must use strict mode.

Do not use:

```ts
any
```

Use:

```ts
unknown
```

and validate unknown external data with Zod.

Avoid unnecessary type assertions:

```ts
as SomeType
```

Prefer actual validation and type narrowing.

Do not disable TypeScript strictness to bypass errors.

---

# 44. Shared Types

Shared types belong in:

```text
packages/shared
```

when they are genuinely shared between applications.

Do not duplicate:

```text
OrderStatus
PaymentStatus
Role
Permission
Product schema
Pricing rules
Delivery rules
```

across frontend and backend.

There must be one source of truth.

---

# 45. API Contract

The frontend and backend communicate through explicit API contracts.

When changing an API:

1. Check `SPEC.md`.
2. Check shared schemas/types.
3. Update API implementation.
4. Update frontend consumers.
5. Update tests.
6. Check backwards compatibility where relevant.

Do not silently change response shapes.

---

# 46. Business Logic Ownership

The backend owns all authoritative business decisions.

The frontend must never be trusted for:

```text
Price
Discount
Stock
Order total
Delivery fee
Permissions
Order status
Payment status
```

The frontend may calculate/display temporary UI values for UX, but the API must recalculate and validate everything important.

---

# 47. Manual Testing

When completing a feature, provide concise manual testing instructions.

Example:

```text
1. Start MongoDB.
2. Start the development environment.
3. Open /admin/products.
4. Create a product.
5. Change its price with an authorized account.
6. Verify the audit log.
7. Verify the API response.
```

Do not claim a feature was manually tested if it was not.

---

# 48. Phase Completion Response

After completing a task/phase, respond with exactly these categories:

### What changed

Short summary of implementation.

### How to test

Commands and manual steps.

### Tests

Mention:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

and their result.

### Anything left open

Mention remaining work, limitations, or intentional deferrals.

### Commit

Provide the Conventional Commit message used/recommended.

---

# 49. Git Rules

Use Conventional Commits.

Examples:

```text
feat(api): add product catalog module
feat(web): add product listing page
feat(shared): add bulk pricing rules
fix(api): prevent duplicate order placement
fix(web): handle expired customer session
test(api): add concurrent stock tests
refactor(api): extract transaction helper
chore(infra): configure production pm2
```

One logical unit per commit.

Do not mix unrelated changes in one commit.

---

# 50. Final Principle

Build the smallest correct implementation that satisfies `SPEC.md`.

Priorities:

```text
Correctness
    ↓
Security
    ↓
Business rules
    ↓
Maintainability
    ↓
Testing
    ↓
Performance
    ↓
UI polish
```

Do not optimize prematurely.

Do not invent requirements.

Do not over-engineer.

Do not add Phase 2 functionality.

**Read the spec, understand the existing code, plan first, get approval, implement narrowly, test thoroughly, and leave the repository cleaner than you found it.**
