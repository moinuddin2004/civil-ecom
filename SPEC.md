# Aricon Portal — Functional & Technical Specification

Version 1.0 · Scope: Phase 1 (launch). Read `CLAUDE.md` first.

---

## 0. How to use this spec

- Sections are numbered; `CLAUDE.md` and `PROMPTS.md` refer to them (e.g. "§6.8").
- **MUST** = required for acceptance. **SHOULD** = expected unless there is a good reason. **MAY** = optional.
- When something is not covered here, ask before implementing. Do not add Phase 2 features (§1.3).
- All money values are **integer PKR**. All example prices are demo data.

---

## 1. Overview

### 1.1 Business context

Aricon Engineering Consultants (Karachi) is launching an online store for construction materials: cement, tiles, plywood, paint, waterproofing, electrical, plumbing and hardware. Customers are homeowners and contractors, mostly on mobile phones, often on building sites. Materials are bought in quantity, so **bulk (tiered) pricing** is central. Aricon delivers with its own riders to a list of areas; each area has its own delivery charge.

### 1.2 Users

| User | Needs |
|---|---|
| Customer (homeowner/contractor) | Find the right product, see the real price for their quantity, check delivery to their area, order with COD or bank transfer, track orders, reorder, download invoices |
| Staff | Handle orders (confirm, assign rider, dispatch, mark COD collected, verify bank receipts), manage catalog and stock — only what their permissions allow |
| Admin | Everything, plus staff & permissions, settings (bank accounts, policies), audit logs |

### 1.3 Out of scope (Phase 2 — do NOT build)

Online payments (cards / JazzCash / Easypaisa gateway), SMS/WhatsApp notifications and SMS OTP login, wallet/cashback, discount coupons, construction cost calculator, price-list pages with PDF download, delivery time slots, contractor credit accounts, rider app, mobile apps, blog. Guest checkout is intentionally not supported.

Design for extension: `paymentMethod` is an enum that can grow; notifications go through one `notify()` service that currently sends email only.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| Product | A catalog item (e.g. "UltraTech PPC Cement") with one or more variants |
| Variant | A sellable unit with its own SKU, price, bulk tiers and stock (e.g. "50 kg bag") |
| Bulk tier | A lower unit price that applies from a minimum quantity (e.g. 10+ bags at Rs 415) |
| Unit | What one quantity means: bag, piece, sheet, litre, box, roll, metre, sq ft |
| Delivery area | A named area Aricon delivers to (e.g. "Gulshan-e-Iqbal"), with fee and free-delivery threshold |
| Rider | A delivery person (no login) assigned to orders |
| Receipt | Proof of a bank transfer uploaded by the customer |
| Staff | A user with role `STAFF`, with a list of permissions |

---

## 3. Architecture

### 3.1 Domains and processes

| Address | Served by |
|---|---|
| `https://shop.aricon.com.pk/*` | Nginx → Next.js (`127.0.0.1:3000`) — storefront, `/account`, `/admin` |
| `https://shop.aricon.com.pk/api/*` | Nginx → Express (`127.0.0.1:4000`); Express mounts all routes under `/api` |
| `https://images.aricon.com.pk/*` | Cloudflare R2 public bucket `aricon-public` (custom domain) |
| R2 private bucket `aricon-private` | Receipts, import files, database backups (never public) |

- Next.js server components call the API at `INTERNAL_API_URL=http://127.0.0.1:4000`, forwarding the incoming `cookie` header. Browser code calls same-origin `/api/...`.
- Next.js exposes `POST /_internal/revalidate` (header `x-revalidate-secret`) that the API calls after catalog/home changes. Nginx MUST block `/_internal` from the internet.
- Express uses `app.set('trust proxy', 1)`; Nginx passes the real client IP from Cloudflare (`CF-Connecting-IP`).

### 3.2 Sessions

| | Customer | Staff/Admin |
|---|---|---|
| Cookie | `aricon_sid` | `aricon_admin_sid` |
| Store collection | `userSessions` | `adminSessions` |
| Used by | all `/api/*` except `/api/admin/*` | only `/api/admin/*` |
| Lifetime | 30 days, rolling | 12 hours absolute |
| Session data | `{ userId }` only | `{ userId }` only |

Both cookies: `httpOnly`, `Secure` (production), `SameSite=Lax`, `path=/`. User role, status and permissions are **loaded from the database on every request** (cache at most 30 s in memory), so changes apply immediately. A customer cannot log into admin and staff/admins cannot log into the storefront (see §6.11).

### 3.3 Local development

- `infra/docker-compose.yml`: MongoDB with replica set `rs0` on `localhost:27017` (init script runs `rs.initiate()`).
- Storage driver `local` in development: files under `apps/api/.uploads/{public,private}`; public files served at `/api/dev-files/*` (development only). `r2` driver in production. Both implement one `Storage` interface (`put`, `delete`, `getPublicUrl`, `getSignedUrl`).
- Email in development: log to console (or Mailpit if available); never send real mail from dev.

### 3.4 Environment variables

API (`apps/api/.env`): `NODE_ENV`, `PORT=4000`, `MONGODB_URI`, `SESSION_SECRET_USER`, `SESSION_SECRET_ADMIN`, `APP_URL=https://shop.aricon.com.pk`, `RFP_CORS_ORIGINS=https://aricon.com.pk,https://www.aricon.com.pk`, `STORAGE_DRIVER=local|r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `PUBLIC_IMAGE_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `WEB_INTERNAL_URL=http://127.0.0.1:3000`, `REVALIDATE_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed only).

Web (`apps/web/.env`): `INTERNAL_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_IMAGE_BASE_URL`, `REVALIDATE_SECRET`.

All env is validated with Zod at startup; the process exits with a clear message if something is missing.

---

## 4. Roles and permissions

### 4.1 Roles

| Role | Logs in at | Access |
|---|---|---|
| `ADMIN` | `/admin/login` | Everything, including admin-only areas (§4.3) |
| `STAFF` | `/admin/login` | Only the permissions in `user.permissions` |
| `CUSTOMER` | `/login` | Storefront and own account only |

### 4.2 Permission catalog

Defined once in `packages/shared/src/permissions.ts`. The admin UI (checkboxes, sidebar), the API (`requirePermission`) and the seed scripts all read this list.

| Group | Key | Label (UI) | Depends on | Sensitive |
|---|---|---|---|---|
| Dashboard | `dashboard.view` | View sales dashboard | – | |
| Orders | `orders.view` | View orders and invoices | – | |
| Orders | `orders.create` | Create orders for customers | `orders.view`, `customers.view` | |
| Orders | `orders.discount` | Give a discount when creating an order | `orders.view`, `customers.view`, `orders.create` | yes |
| Orders | `orders.update_status` | Confirm, dispatch and deliver orders | `orders.view` | |
| Orders | `orders.cancel` | Cancel and return orders | `orders.view` | ✓ |
| Orders | `orders.assign_rider` | Assign riders | `orders.view` | |
| Orders | `orders.cod_collect` | Mark cash on delivery collected | `orders.view` | |
| Orders | `orders.verify_payment` | Approve or reject bank receipts | `orders.view` | |
| Orders | `orders.export` | Export orders to Excel | `orders.view` | |
| Products | `products.view` | View products | – | |
| Products | `products.create` | Create products | `products.view` | |
| Products | `products.edit` | Edit product details and images | `products.view` | |
| Products | `products.edit_price` | Change prices and bulk tiers | `products.view` | ✓ |
| Products | `products.edit_stock` | Adjust stock | `products.view` | ✓ |
| Products | `products.archive` | Hide and archive products | `products.view` | |
| Products | `products.import` | Import products from Excel | `products.view` | |
| Products | `products.export` | Export products to Excel | `products.view` | |
| Catalog | `categories.manage` | Manage categories | – | |
| Catalog | `brands.manage` | Manage brands | – | |
| Customers | `customers.view` | View customers | – | |
| Customers | `customers.block` | Block and unblock customers | `customers.view` | |
| Customers | `customers.delete` | Delete and restore customer accounts | `customers.view` | ✓ |
| Customers | `customers.export` | Export customers to Excel | `customers.view` | ✓ |
| Delivery | `delivery_areas.manage` | Manage delivery areas and charges | – | |
| Delivery | `riders.manage` | Manage riders | – | |
| Content | `homepage.manage` | Manage homepage banners and featured products | – | |
| Reports | `reports.view` | View reports | – | |
| Reports | `reports.export` | Export reports to Excel | `reports.view` | |
| Stock | `stock_movements.view` | View stock history | – | |

Shape:

```ts
export const PERMISSIONS = [
  { key: 'orders.cancel', group: 'Orders', label: 'Cancel and return orders',
    dependsOn: ['orders.view'], sensitive: true },
  // ...
] as const;
export type Permission = (typeof PERMISSIONS)[number]['key'];
export const PERMISSION_PRESETS = { orderManager: [...], catalogManager: [...], accountantViewer: [...] };
export function withDependencies(perms: Permission[]): Permission[]; // adds dependsOn keys
export function hasPermission(user, perm): boolean; // ADMIN → always true
```

### 4.3 Admin-only (no checkbox, `requireAdmin()`)

| Area | Reason |
|---|---|
| Staff management: create staff, change role, permissions, reset staff passwords, block staff | Prevents staff from escalating their own access |
| Settings: store info, bank accounts, payment methods, COD limit, pages/policies, notification emails | Prevents bank-account fraud |
| Audit logs | Oversight of all staff actions |

### 4.4 Presets (UI shortcuts only — the database stores only the permission list)

| Preset | Permissions |
|---|---|
| Order Manager | `orders.view`, `orders.create`, `orders.update_status`, `orders.assign_rider`, `orders.cod_collect`, `orders.verify_payment`, `customers.view` |
| Catalog Manager | all `products.*`, `categories.manage`, `brands.manage`, `stock_movements.view` |
| Accountant / Viewer | `dashboard.view`, `reports.view`, `reports.export`, `orders.view` |

New staff default: `orders.view`, `orders.update_status`.

### 4.5 Rules

1. `withDependencies()` is applied when saving permissions (API) and when ticking checkboxes (UI).
2. Unknown permission keys are rejected (400).
3. `orders.view` includes the customer name, phone and address **of that order** (needed for delivery). The customer directory needs `customers.view`.
4. Cannot demote, block or delete the last active ADMIN. An admin cannot change their own role, block themselves or delete their own account.
5. Blocking a staff member or changing their role deletes all their `adminSessions`.
6. Every role/permission/status change writes an `auditLogs` entry with before/after.
7. Customer accounts cannot be converted to staff. Staff are created only through "Add staff" with their own email.

---

## 5. Data model (MongoDB / Mongoose)

General rules:

- Every collection has `createdAt` / `updatedAt` (Mongoose `timestamps: true`).
- Money fields are integers (PKR). Validate with `Number.isInteger` and `min: 0`.
- Nothing referenced by orders is hard-deleted: use `status`.
- Slugs: lowercase, `a-z0-9-`, unique per collection, generated from the name and editable.
- "Snapshot" = a copy of data at the time of the event, never updated later.

### 5.1 `users`

| Field | Type | Rules |
|---|---|---|
| `name` | string | required, 2–80 chars |
| `email` | string | required, lowercase, unique among accounts without `deletedAt` |
| `phone` | string | `+923XXXXXXXXX`; required for `CUSTOMER`, optional for staff; unique among accounts without `deletedAt` when present |
| `passwordHash` | string | bcryptjs, cost 12; never returned by the API |
| `role` | enum `ADMIN` \| `STAFF` \| `CUSTOMER` | default `CUSTOMER` |
| `permissions` | string[] | only meaningful for `STAFF`; validated against catalog |
| `status` | enum `active` \| `blocked` | default `active` |
| `deletedAt` | Date? | soft-deleted accounts cannot sign in; user and order history is retained |
| `companyName` | string? | customers (contractors) |
| `addresses` | Address[] | customers only, max 10 |
| `mustChangePassword` | boolean | default false; true for new staff and after admin reset |
| `failedLogins` | number | default 0 |
| `lockedUntil` | Date? | set after 5 failures |
| `lastLoginAt` | Date? | |

**Address (embedded, has `_id`):** `label` (e.g. "Site – Gulshan"), `contactName`, `phone`, `line1`, `line2?`, `landmark?`, `areaId` (ref `deliveryAreas`), `city`, `isDefault`. Exactly one default when addresses exist.

Indexes: `email` unique among accounts without `deletedAt`; `phone` unique partial among accounts without `deletedAt`; `{ role: 1, status: 1 }`; text-ish search via regex on `name`/`email`/`phone` in admin (paginated).

### 5.2 `userSessions`, `adminSessions`

Created by connect-mongo (TTL handled by the store). Session payload: `{ userId }`.

### 5.3 `passwordResets`

`userId`, `tokenHash` (SHA-256 of a 32-byte random token), `expiresAt` (TTL index, 60 min), `usedAt?`.

### 5.4 `categories`

| Field | Type | Rules |
|---|---|---|
| `name` | string | required |
| `slug` | string | unique |
| `parentId` | ObjectId? | null = top level; max depth 2 |
| `description` | string? | shown on category page, SEO |
| `imageKey` | string? | R2 key |
| `sortOrder` | number | default 0 |
| `showOnHome` | boolean | category tiles on home |
| `status` | `active` \| `hidden` | |

Indexes: `slug` unique; `{ parentId: 1, sortOrder: 1 }`.

### 5.5 `brands`

`name`, `slug` (unique), `logoKey?`, `status` (`active` | `hidden`), `sortOrder`.

### 5.6 `products`

| Field | Type | Rules |
|---|---|---|
| `name` | string | required, 3–150 chars |
| `slug` | string | unique |
| `brandId` | ObjectId | required |
| `brandName` | string | denormalized from brand (updated when brand is renamed) |
| `categoryId` | ObjectId | required (leaf or top-level) |
| `categoryPath` | ObjectId[] | `[parentId, categoryId]` or `[categoryId]`; computed |
| `type` | string? | e.g. "Emulsion", "Primer", "PPC"; used as a filter |
| `unit` | enum | `bag`, `piece`, `sheet`, `litre`, `box`, `roll`, `metre`, `sqft`, `kg`, `set` |
| `description` | string | Markdown, max 20,000 chars |
| `specifications` | `{ label, value }[]` | max 40 rows |
| `images` | `{ _id, key, alt }[]` | ordered; first = main image; max 10 |
| `variants` | Variant[] | at least 1 |
| `filters` | `{ type: string[], packSize: string[], grade: string[], colour: string[], size: string[] }` | computed from active variants on every save |
| `minPrice`, `maxPrice` | int | computed from active variants' `price` |
| `totalStock` | int | computed sum of active variants' stock |
| `isFeatured` | boolean | default false |
| `relatedProductIds` | ObjectId[] | optional, max 8 |
| `seo` | `{ title?, description? }` | optional overrides |
| `status` | `active` \| `hidden` \| `archived` | only `active` is visible in the store |

**Variant (embedded, has `_id`):**

| Field | Type | Rules |
|---|---|---|
| `sku` | string | required, uppercase, unique across all products |
| `label` | string | e.g. "50 kg bag, OPC 53" |
| `options` | `{ packSize?, grade?, colour?, size? }` | strings |
| `mrp` | int | ≥ `price` |
| `price` | int | > 0 |
| `bulkTiers` | `{ minQty: int, price: int }[]` | max 5; see §6.1 validation |
| `stock` | int | ≥ 0 (never negative) |
| `lowStockThreshold` | int | default from settings (5) |
| `isActive` | boolean | inactive variants are hidden in the store |

Indexes: `slug` unique; `variants.sku` unique; `{ status: 1, categoryPath: 1, minPrice: 1 }`; `{ status: 1, brandId: 1 }`; `{ status: 1, createdAt: -1 }`; `{ isFeatured: 1, status: 1 }`; text index on `name` (weight 10) and `brandName` (weight 5).

A pre-save hook recomputes `categoryPath`, `filters`, `minPrice`, `maxPrice`, `totalStock` and upper-cases SKUs.

### 5.7 `carts`

`userId` (unique), `items: { productId, variantId, qty }[]` (max 50 lines). Prices are **never** stored in carts; they are computed on every read.

### 5.8 `deliveryAreas`

| Field | Type | Rules |
|---|---|---|
| `name` | string | e.g. "Gulshan-e-Iqbal", unique per city |
| `city` | string | default "Karachi" |
| `isServiceable` | boolean | false = shown as "Not delivering yet" |
| `deliveryFee` | int? | null → `settings.defaultDeliveryFee` |
| `freeDeliveryAbove` | int? | null → no free delivery |
| `sortOrder` | number | |

Index: `{ city: 1, name: 1 }` unique.

### 5.9 `riders`

`name`, `phone`, `isActive`.

### 5.10 `orders`

| Field | Type | Rules |
|---|---|---|
| `orderNumber` | string | unique, `ARC-{YYYY}-{000123}` (§6.9) |
| `userId` | ObjectId | required |
| `user` | `{ name, email, phone }` | snapshot |
| `shippingAddress` | Address fields + `areaName` | snapshot |
| `deliveryAreaId` | ObjectId | |
| `items` | OrderItem[] | ≥ 1 |
| `subtotal` | int | sum of `lineTotal` |
| `deliveryFee` | int | |
| `discountAmount` | int | staff discount on the subtotal (§6.6c), default 0; absent on older orders |
| `discountReason` | string? | required when `discountAmount > 0` |
| `discountByUserId` | ObjectId? | the staff member who gave it |
| `trackingCode` | string | 6 digits (`100000`–`999999`), unique per order (§6.6b); older orders get one at start-up |
| `total` | int | `subtotal - discountAmount + deliveryFee` |
| `paymentMethod` | `COD` \| `BANK_TRANSFER` | |
| `paymentStatus` | `PENDING` \| `AWAITING_VERIFICATION` \| `PAID` \| `REJECTED` \| `REFUNDED` | |
| `receipts` | Receipt[] | bank transfer only |
| `status` | `NEW` \| `CONFIRMED` \| `DISPATCHED` \| `DELIVERED` \| `CANCELLED` \| `RETURNED` | default `NEW` |
| `statusHistory` | `{ status, at, byUserId?, byType: 'customer' \| 'staff' \| 'system', note? }[]` | append-only |
| `riderId` | ObjectId? | |
| `rider` | `{ name, phone }?` | snapshot at assignment |
| `codCollected` | `{ amount, at, byUserId, note? }?` | `note` is the reason when `amount ≠ total` |
| `customerNote` | string? | max 500 |
| `internalNote` | string? | staff only, max 2,000 |
| `cancelReason` | string? | |
| `idempotencyKey` | string | from checkout header |

**OrderItem:** `productId`, `variantId`, `sku`, `productName`, `variantLabel`, `brandName`, `unit`, `imageKey?`, `qty`, `mrp`, `basePrice` (variant price), `unitPrice` (after tier), `appliedTierMinQty?`, `lineTotal`.

**Receipt (embedded, has `_id`):** `key` (private R2), `mimeType`, `sizeBytes`, `uploadedAt`, `status` (`pending` | `approved` | `rejected`), `reviewedByUserId?`, `reviewedAt?`, `rejectReason?`.

Indexes: `orderNumber` unique; `{ userId: 1, createdAt: -1 }`; `{ userId: 1, idempotencyKey: 1 }` unique; `{ status: 1, createdAt: -1 }`; `{ paymentStatus: 1, createdAt: -1 }`; `{ riderId: 1, status: 1 }`; `{ 'user.phone': 1 }`.

### 5.11 `counters`

`{ _id: 'order-2026', seq: number }` — incremented with `findOneAndUpdate({ $inc: { seq: 1 } }, { upsert: true, new: true })` inside the order transaction.

### 5.12 `stockMovements`

`productId`, `variantId`, `sku`, `change` (int, + or −), `stockAfter`, `reason` (`ORDER` | `CANCEL` | `RETURN` | `ADJUST` | `IMPORT`), `refType?` (`order` | `import`), `refId?`, `note?`, `byUserId?`, `at`.

Indexes: `{ variantId: 1, at: -1 }`, `{ at: -1 }`, `{ reason: 1, at: -1 }`.

### 5.13 `homepage` (single document, `_id: 'home'`)

`banners: { _id, desktopKey, mobileKey?, alt, link?, isActive, sortOrder }[]` (max 8), `featuredProductIds: ObjectId[]` (max 12), `dealProductIds: ObjectId[]` (max 12). Category tiles come from `categories.showOnHome`. New arrivals = latest 12 active products.

### 5.14 `settings` (single document, `_id: 'settings'`)

| Field | Notes |
|---|---|
| `storeName`, `phone`, `whatsapp`, `email`, `address` | shown in footer/contact |
| `orderNotificationEmails: string[]` | new order + receipt alerts |
| `rfpEmail` | where company-website inquiries go |
| `paymentMethods: { cod: boolean, bankTransfer: boolean }` | at least one must be true |
| `codMaxOrderAmount: int?` | COD not offered above this total; null = no limit |
| `defaultDeliveryFee: int` | used when an area has no fee |
| `bankAccounts: { _id, bankName, accountTitle, accountNumber, iban?, raastId? }[]` | shown for bank transfer |
| `bankTransferInstructions: string` | Markdown |
| `lowStockDefault: int` | default 5 |
| `pages: { about, faq, contact, refundPolicy, deliveryPolicy, privacyPolicy, terms }` | Markdown each |

### 5.15 `importJobs`

`fileKey` (private), `status` (`QUEUED` | `RUNNING` | `DONE` | `FAILED`), `totalRows`, `processedRows`, `summary: { created, updated, failed }`, `errors: { row, sku?, message }[]` (max 500 stored), `createdByUserId`, `startedAt?`, `finishedAt?`.

### 5.16 `auditLogs`

`actorId`, `actorName` (snapshot), `actorRole`, `action` (e.g. `product.price_changed`, `order.status_changed`, `order.payment_approved`, `user.role_changed`, `user.permissions_changed`, `user.blocked`, `settings.updated`, `stock.adjusted`), `entity` (`product` | `order` | `user` | `settings` | `deliveryArea` | `homepage` | ...), `entityId`, `before?`, `after?` (only changed fields), `ip`, `userAgent`, `at`.

Indexes: `{ at: -1 }`, `{ entity: 1, entityId: 1, at: -1 }`, `{ actorId: 1, at: -1 }`.

### 5.17 Agenda

Agenda uses its own `agendaJobs` collection.

---

## 6. Business rules

All functions in this section live in `packages/shared` (pure, unit-tested) unless they need the database.

### 6.1 Unit price and bulk tiers

```ts
getUnitPrice(variant, qty): { unitPrice: number; appliedTierMinQty: number | null }
```

- Sort tiers by `minQty` ascending. The applied tier is the one with the **largest `minQty` ≤ qty**. No tier applies → `unitPrice = variant.price`.
- Example: price 425, tiers `[{10,415},{30,405},{50,395}]` → qty 9 → 425; qty 10 → 415; qty 49 → 405; qty 50 → 395.
- `nextTier(variant, qty)` returns the next tier (for the nudge "Add 3 more to pay Rs 405 each") or null.

Tier validation (API rejects with `VALIDATION_ERROR`):

- `minQty` ≥ 2 and strictly increasing; `price` strictly decreasing; every tier price < `variant.price`; `mrp` ≥ `price`; max 5 tiers.

### 6.2 Line and cart totals

- `lineTotal = unitPrice × qty`. "You save" on a line = `(mrp − unitPrice) × qty` when positive.
- `computeCart(lines, area?, settings)` returns lines with prices, `subtotal`, `deliveryFee`, `total`, `amountToFreeDelivery`, and `issues[]`.
- Line issues (block checkout until fixed): `PRODUCT_UNAVAILABLE` (product not active / variant inactive), `OUT_OF_STOCK` (stock 0), `QTY_EXCEEDS_STOCK` (qty > stock; UI offers "Set to {stock}").
- Qty per line: integer 1–9,999.

### 6.3 Guest cart and merge

- Guests keep the cart in `localStorage` key `aricon_cart_v1` = `{ items: [{ productId, variantId, qty }] }`. The UI prices it with `POST /api/cart/quote`.
- After login or signup the browser calls `POST /api/cart/merge`: same variant → quantities are added (capped at stock and 9,999); then `localStorage` is cleared.
- Logged-in carts are stored in `carts`.

### 6.4 Delivery fee

```ts
getDeliveryFee(subtotal, area, settings): { fee: number; amountToFreeDelivery: number | null }
```

- Area must be `isServiceable`; otherwise checkout is blocked with "We don't deliver to {area} yet."
- `baseFee = area.deliveryFee ?? settings.defaultDeliveryFee`.
- If `area.freeDeliveryAbove` is set and `subtotal ≥ freeDeliveryAbove` → fee 0; else fee = `baseFee` and `amountToFreeDelivery = freeDeliveryAbove − subtotal`.
- The storefront remembers the selected area in cookie `aricon_area` (areaId) for estimates; checkout always uses the area of the chosen address.

### 6.5 Payment methods at checkout

- `COD`: offered when `settings.paymentMethods.cod` and (`codMaxOrderAmount` is null or `total ≤ codMaxOrderAmount`). Otherwise show: "Cash on delivery is available for orders up to Rs X."
- `BANK_TRANSFER`: offered when `settings.paymentMethods.bankTransfer`. Checkout shows bank accounts and instructions. Receipt upload is optional at checkout and can be done later from the order page.
- New order `paymentStatus`: `PENDING` for both. Uploading a receipt → `AWAITING_VERIFICATION`.

### 6.6 Placing an order (`POST /api/orders`)

Requires a customer session (`CUSTOMER`, `active`) and header `Idempotency-Key` (UUID v4).

1. If an order with the same `{ userId, idempotencyKey }` exists → return it (200) without creating a new one.
2. Load cart, address (must belong to the user), area, settings. Validate: cart not empty, no line issues, area serviceable, payment method allowed.
3. Recompute every price on the server with §6.1–6.4. The client sends `expectedTotal`; if it differs → `409 PRICE_CHANGED` with the new cart (UI shows "Prices changed, please review").
4. In **one transaction** (`withTransaction`):
   - For each line: `updateOne({ _id: productId, status: 'active' }, { $inc: { 'variants.$[v].stock': -qty } }, { arrayFilters: [{ 'v._id': variantId, 'v.stock': { $gte: qty }, 'v.isActive': true }] })`. If `modifiedCount === 0` → abort with `409 OUT_OF_STOCK` and details.
   - Recompute `totalStock` for touched products.
   - Increment `counters` and build `orderNumber`.
   - Insert the order with snapshots, `status: NEW`, `statusHistory: [{ status: 'NEW', byType: 'customer' }]`.
   - Insert `stockMovements` (`reason: ORDER`).
   - Empty the user's cart.
5. After commit: queue emails (customer "Order placed", staff "New order"), return `201 { data: order }`.

Concurrency test (MUST): two parallel orders for the last 5 units with qty 5 each → exactly one succeeds.

### 6.6a Orders created by staff (`POST /api/admin/orders`)

Staff with `orders.create` place an order for an existing, active `CUSTOMER` (phone or counter orders). It follows §6.6 with these differences:

- Staff choose the customer, one of that customer's saved addresses, the lines (`productId`, `variantId`, `qty`) and the payment method. Prices, bulk tiers, delivery fee, stock and payment-method rules are the server's (§6.1–6.5); staff cannot override any of them.
- The lines come from the request: the customer's own cart is not read or changed.
- `expectedTotal` comes from `POST /api/admin/orders/quote`; a mismatch returns `409 PRICE_CHANGED`. Not enough stock returns `409 OUT_OF_STOCK`. A blocked customer or an address that isn't theirs returns `400`.
- `statusHistory[0]` is `{ status: 'NEW', byType: 'staff' }`; an `order.created` audit log entry is written in the same transaction.
- The customer gets the normal "Order placed" email and staff the "New order" email. Idempotency is per `{ userId, Idempotency-Key }` as in §6.6.

### 6.6b Public order tracking (`POST /api/public/track-order`)

Every order gets a random, unique **6-digit tracking code** when it is placed (by the customer or by staff). Anyone who has the code can check where the order is without signing in.

- The code is shown with a copy button on the order placed page, in the customer's order list and order page, in the "Order placed" email and on the admin order page; staff can also find an order by it in the orders search.
- Body `{ code }` (6 digits).
- Returns only `{ orderNumber, status, createdAt, history: [{ status, at }], riderName }`. `riderName` (name only, no phone) appears once the order is `DISPATCHED` or `DELIVERED`. No address, items, prices, customer name, phone or notes.
- A code that matches no order gives `404 NOT_FOUND`. The data is small on purpose (status trail and rider name only), because the code is the only proof.
- Rate limit: 10 requests per 15 minutes per IP (`429`). Same-origin only (the Origin check stays on). The storefront page is `/track-order`, linked from the header and footer.

### 6.6c Staff discount on orders they create

Staff with `orders.discount` (in addition to `orders.create`) can take a fixed amount of rupees off an order they create (§6.6a). Customers can't, and the customer checkout is unchanged.

- Body fields `discountAmount` (whole rupees, > 0) and `discountReason` (required, up to 300 characters).
- The discount comes off the **products subtotal**, never the delivery fee, and can't be more than the subtotal (`400`). `total = subtotal − discountAmount + deliveryFee`, calculated by the server; `expectedTotal` must be that discounted total (`409 PRICE_CHANGED` otherwise). The COD limit (§6.5) is checked against the discounted total.
- Without `orders.discount` a request with a discount is `403`.
- Stored on the order (`discountAmount`, `discountReason`, `discountByUserId`), written to the `order.created` audit entry, and shown on the invoice, the "Order placed" email, the customer's order page and the admin order page.
- Revenue in reports is after discounts; the sales report also shows the discounts given.

### 6.7 Order status machine

Defined in `packages/shared/src/order-status.ts` as a table used by API and UI.

| From → To | Permission | Conditions | Side effects |
|---|---|---|---|
| `NEW → CONFIRMED` | `orders.update_status` | Bank transfer: `paymentStatus === PAID` | Email "Order confirmed" |
| `CONFIRMED → DISPATCHED` | `orders.update_status` | A rider is assigned | Email "Order on the way" (rider name/phone) |
| `DISPATCHED → DELIVERED` | `orders.update_status` | – | Email "Order delivered". COD: UI prompts to mark cash collected |
| `NEW → CANCELLED` | `orders.cancel` (staff) or the customer | Customer may cancel only while `NEW` and no receipt is `approved` | Restock (`CANCEL`), email "Order cancelled", `cancelReason` required |
| `CONFIRMED → CANCELLED` | `orders.cancel` | – | Restock, email, reason required |
| `DELIVERED → RETURNED` | `orders.cancel` | – | Restock (`RETURN`); if `paymentStatus === PAID` → `REFUNDED` (money is refunded outside the system) |

- Any other transition → `409 INVALID_TRANSITION`.
- Every transition appends to `statusHistory` and writes an audit log (staff actions).
- Status changes that restock run in a transaction.

### 6.8 Payments

**COD:** `POST /api/admin/orders/:id/cod-collected { amount }` (`orders.cod_collect`), allowed when status is `DISPATCHED` or `DELIVERED`. Sets `codCollected` and `paymentStatus = PAID`. If `amount ≠ total`, a note is required. The note is saved on the order (`codCollected.note`) and in the audit log (which keeps both amounts). The admin order page shows expected, collected, short or extra, and the reason; the orders list marks short or extra orders; the COD report totals them and lists the orders (§7.3).

**Bank transfer receipts:**

- Customer uploads `jpg/png/webp/pdf` ≤ 5 MB; max 3 receipts in `pending` at once; allowed while order is `NEW` or `CONFIRMED` and `paymentStatus` is not `PAID`.
- Upload → receipt `pending`, `paymentStatus = AWAITING_VERIFICATION`, staff email "Receipt uploaded".
- Approve (`orders.verify_payment`) → receipt `approved`, `paymentStatus = PAID`, customer email "Payment received".
- Reject with reason → receipt `rejected`; if no other pending receipt → `paymentStatus = REJECTED`; customer email "Payment receipt not accepted" with reason and a link to upload again.
- Staff view a receipt through `GET .../receipts/:receiptId/url` → 10-minute presigned URL.

### 6.9 Order numbers

`ARC-{YYYY}-{seq padded to 6}` where YYYY is the current year in Asia/Karachi and the counter id is `order-{YYYY}` (resets every year). Example: `ARC-2026-000123`.

### 6.10 Stock

- Stock changes only through: order placement, cancel/return restock, manual adjustment (`products.edit_stock`, reason required), Excel import (`products.edit_stock` needed for stock columns).
- Every change writes `stockMovements` with `stockAfter`.
- `isLowStock = stock ≤ lowStockThreshold` (dashboard widget, product list filter).
- Product edit endpoints never accept `stock`; stock uses its own endpoint.

### 6.11 Authentication

- **Customer signup:** name, email, phone, password (8–72 chars, at least one letter and one number), optional company. Email and phone must be unique → `409 EMAIL_TAKEN` / `PHONE_TAKEN`. Creates `CUSTOMER` and logs in.
- **Customer login:** `identifier` = email or phone (normalized) + password. Only `CUSTOMER` accounts. Staff/admin credentials on the storefront → same generic error as wrong password.
- **Admin login:** email + password, only `ADMIN`/`STAFF`. If `mustChangePassword` → session is limited to `/api/admin/auth/*` until the password is changed.
- **Lockout:** 5 failed logins → `lockedUntil = now + 15 min` → `423 ACCOUNT_LOCKED`. Success resets `failedLogins`.
- **Blocked** accounts → `403 ACCOUNT_BLOCKED` on login; existing sessions are deleted when blocked.
- **Forgot password (customers):** always respond 200 with a generic message. Token valid 60 minutes, single use; after reset all of that user's sessions are deleted. Staff passwords are reset by an ADMIN (temporary password shown once in the admin UI, `mustChangePassword = true`).
- Session id is regenerated on login.

### 6.12 Soft delete

- Users (customers and staff): set `deletedAt`; retain the user and all order/audit history. Deleted users cannot sign in. Admins can restore accounts; customers require `customers.delete`, and staff deletion/restoration is ADMIN-only. Do not hard-delete users.
- Products: `hidden` (not in store, still editable) or `archived` (not in store, hidden from default admin lists). Products are never hard-deleted.
- Categories/brands: `hidden`; cannot hide a category that still has active products (409 with a count).
- Delivery areas: set `isServiceable = false` instead of delete if used by any address or order.
- Riders: `isActive = false`.

### 6.13 Formatting

- `formatPKR(125000)` → `"Rs 125,000"` (international grouping, no decimals).
- Dates in UI: `26 Sep 2026, 4:05 pm` (Asia/Karachi).
- Unit display: `Rs 425 / bag`.

---

## 7. API

### 7.1 Conventions

- Base path `/api`, JSON only (except file uploads: `multipart/form-data`; downloads: PDF/XLSX).
- Pagination: `?page=1&pageSize=20` (max 100) → `meta: { page, pageSize, total }`.
- Sorting: `?sort=createdAt:desc` (whitelisted fields per endpoint).
- Every body, query and params object is validated with a strict Zod schema (unknown keys rejected).
- Error codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `ACCOUNT_BLOCKED` (403), `EMAIL_NOT_VERIFIED` (403), `NOT_FOUND` (404), `CONFLICT` (409), `EMAIL_TAKEN` (409), `PHONE_TAKEN` (409), `OUT_OF_STOCK` (409), `PRICE_CHANGED` (409), `INVALID_TRANSITION` (409), `ACCOUNT_LOCKED` (423), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_FILE` (415), `RATE_LIMITED` (429), `INTERNAL` (500).
- Rate limits (per IP, plus per identifier for login): customer login 10/15 min, admin login 5/15 min, signup 5/hour, forgot password 3/hour, receipt upload 10/hour, RFP 5/hour.
- Origin check on all non-GET requests except `POST /api/public/rfp`.

### 7.2 Public and customer endpoints

**Health**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ status: 'ok', db: 'ok' }` |

**Customer auth**

| Method | Path | Body / notes |
|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, phone, password, companyName? }` → logs in |
| POST | `/api/auth/login` | `{ identifier, password }` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | current customer or 401 |
| POST | `/api/auth/forgot-password` | `{ email }` → always 200 |
| POST | `/api/auth/reset-password` | `{ token, password }` |

**Catalog (public, only `active` data)**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/home` | banners, category tiles, featured, deals, new arrivals (12), brands |
| GET | `/api/categories` | tree with counts of active products |
| GET | `/api/categories/:slug` | category + children + breadcrumbs |
| GET | `/api/brands` | active brands |
| GET | `/api/products` | query: `category`, `brand` (comma list), `q`, `minPrice`, `maxPrice`, `type`, `packSize`, `grade`, `colour`, `size`, `inStock`, `sort` = `relevance` \| `price_asc` \| `price_desc` \| `newest`, `page`, `pageSize` → `{ data: ProductCard[], meta, facets }` |
| GET | `/api/products/:slug` | full product (active variants only) |
| GET | `/api/products/:slug/related` | `relatedProductIds` or same category, max 8 |
| GET | `/api/search/suggest?q=` | ≥ 2 chars; up to 6 products, 3 categories, 3 brands |
| GET | `/api/delivery-areas` | all areas with `isServiceable`, fee, `freeDeliveryAbove` |
| GET | `/api/settings/public` | store contact, WhatsApp, enabled payment methods, COD limit |
| GET | `/api/pages/:key` | `about`, `faq`, `contact`, `refund-policy`, `delivery-policy`, `privacy-policy`, `terms` |

`facets` = for the current filtered result set (ignoring the facet's own filter): brands with counts, price min/max, and values with counts for `type`, `packSize`, `grade`, `colour`, `size`. The UI shows a facet only when it has ≥ 2 values. Implement with one aggregation using `$facet`.

`ProductCard` = `{ id, slug, name, brandName, unit, imageKey, minPrice, maxPrice, mrpOfMin, lowestTierPrice, inStock, variantCount, defaultVariantId }`.

**Cart**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/cart/quote` | guest: `{ items, areaId? }` → priced cart, no session needed |
| GET | `/api/cart` | customer: priced cart (`?areaId=` for estimate) |
| PUT | `/api/cart/items` | `{ variantId, qty }`; qty 0 removes |
| DELETE | `/api/cart/items/:variantId` | |
| POST | `/api/cart/merge` | `{ items }` after login |

**Orders (customer)**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/orders` | header `Idempotency-Key`; `{ addressId, paymentMethod, customerNote?, expectedTotal }` (§6.6) |
| GET | `/api/orders` | own orders, paginated, newest first |
| GET | `/api/orders/:orderNumber` | own order only (else 404) |
| POST | `/api/orders/:orderNumber/cancel` | `{ reason }` (§6.7) |
| POST | `/api/orders/:orderNumber/receipts` | multipart `file` (§6.8) |
| GET | `/api/orders/:orderNumber/invoice` | PDF |
| POST | `/api/orders/:orderNumber/reorder` | adds available items to cart, returns cart + skipped items |

**Account (customer)**

| Method | Path | Notes |
|---|---|---|
| PATCH | `/api/account/profile` | `{ name, phone, companyName }` |
| POST | `/api/account/change-password` | `{ currentPassword, newPassword }`; other sessions deleted |
| GET | `/api/account/addresses` | |
| POST | `/api/account/addresses` | max 10 |
| PATCH | `/api/account/addresses/:id` | |
| DELETE | `/api/account/addresses/:id` | |
| POST | `/api/account/addresses/:id/default` | |

**Company website inquiries**

| Method | Path | Notes |
|---|---|---|
| POST | `/api/public/track-order` `{ code }` | public, same-origin, 10 per 15 min per IP (§6.6b) |
| POST | `/api/public/rfp` | CORS only from `RFP_CORS_ORIGINS`; `{ company, contactPerson, email, phone?, location?, service, brief, website }` (`website` = honeypot, must be empty); emails `settings.rfpEmail`; nothing stored |

### 7.3 Admin endpoints (`/api/admin/*`, admin session)

`perm` column: a permission key, `ADMIN` (= `requireAdmin()`), or `any staff` (= any logged-in ADMIN/STAFF).

**Auth**

| Method | Path | perm | Notes |
|---|---|---|---|
| POST | `/api/admin/auth/login` | – | `{ email, password }` |
| POST | `/api/admin/auth/logout` | any staff | |
| GET | `/api/admin/auth/me` | any staff | `{ user, permissions (effective), mustChangePassword }` |
| POST | `/api/admin/auth/change-password` | any staff | allowed even when `mustChangePassword` |

**Dashboard**

| Method | Path | perm | Notes |
|---|---|---|---|
| GET | `/api/admin/dashboard` | any staff | returns only widgets the user may see: sales today/7d/30d + chart (`dashboard.view`), orders by status (`orders.view`), receipts awaiting verification (`orders.verify_payment`), COD to collect (`orders.cod_collect` or `dashboard.view`), low-stock variants (`products.view`) |

**Orders**

| Method | Path | perm |
|---|---|---|
| GET | `/api/admin/orders` (filters: `status`, `paymentStatus`, `paymentMethod`, `from`, `to`, `areaId`, `riderId`, `q` = order number / phone / name) | `orders.view` |
| GET | `/api/admin/orders/:id` | `orders.view` |
| GET | `/api/admin/orders/product-options?q=` | `orders.create` (active variants by name/SKU) |
| POST | `/api/admin/orders/quote` `{ userId, addressId, items, discountAmount? }` | `orders.create` (server-priced, nothing saved; a discount also needs `orders.discount`) |
| POST | `/api/admin/orders` header `Idempotency-Key`; `{ userId, addressId, items, paymentMethod, customerNote?, discountAmount?, discountReason?, expectedTotal }` (§6.6a, §6.6c) | `orders.create` (`orders.discount` for a discount) |
| POST | `/api/admin/orders/:id/status` `{ to, note?, reason? }` | `orders.update_status`; `CANCELLED`/`RETURNED` need `orders.cancel` |
| POST | `/api/admin/orders/:id/rider` `{ riderId }` | `orders.assign_rider` |
| POST | `/api/admin/orders/:id/cod-collected` `{ amount, note? }` | `orders.cod_collect` |
| GET | `/api/admin/orders/:id/receipts/:receiptId/url` | `orders.view` |
| POST | `/api/admin/orders/:id/receipts/:receiptId/approve` | `orders.verify_payment` |
| POST | `/api/admin/orders/:id/receipts/:receiptId/reject` `{ reason }` | `orders.verify_payment` |
| PATCH | `/api/admin/orders/:id/internal-note` `{ internalNote }` | `orders.update_status` |
| GET | `/api/admin/orders/:id/invoice` | `orders.view` |
| GET | `/api/admin/orders/export` (same filters) | `orders.export` |

**Products and stock**

| Method | Path | perm |
|---|---|---|
| GET | `/api/admin/products` (filters: `q`, `categoryId`, `brandId`, `status`, `lowStock`) | `products.view` |
| GET | `/api/admin/products/:id` | `products.view` |
| POST | `/api/admin/products` (full product incl. variants and prices; initial stock allowed only with `products.edit_stock`, else 0) | `products.create` |
| PATCH | `/api/admin/products/:id` (details, images, specs, SEO, variant labels/options; any change to `mrp`/`price`/`bulkTiers` needs `products.edit_price`; `stock` is rejected) | `products.edit` |
| POST | `/api/admin/products/:id/variants` | `products.edit` + `products.edit_price` |
| PATCH | `/api/admin/products/:id/variants/:variantId` | `products.edit` (+ `products.edit_price` for price fields) |
| POST | `/api/admin/products/:id/stock-adjustments` `{ variantId, change, reason }` | `products.edit_stock` |
| POST | `/api/admin/products/:id/status` `{ status }` | `products.archive` |
| POST | `/api/admin/uploads/product-image` (multipart) → `{ key }` | `products.create` or `products.edit` |
| GET | `/api/admin/products/import-template` | `products.import` |
| POST | `/api/admin/products/import` (multipart xlsx) → `{ jobId }` | `products.import` |
| GET | `/api/admin/import-jobs/:id` | `products.import` |
| GET | `/api/admin/products/export` | `products.export` |
| GET | `/api/admin/stock-movements` (filters: `sku`, `productId`, `reason`, `from`, `to`) | `stock_movements.view` |

**Catalog**

| Method | Path | perm |
|---|---|---|
| GET | `/api/admin/categories`, `/api/admin/brands` | `products.view` or the manage permission |
| POST/PATCH | `/api/admin/categories(/:id)` | `categories.manage` |
| POST/PATCH | `/api/admin/brands(/:id)` | `brands.manage` |
| POST | `/api/admin/uploads/category-image`, `/api/admin/uploads/brand-logo` | respective manage permission |

**Customers**

| Method | Path | perm |
|---|---|---|
| GET | `/api/admin/customers` (`q`, `status`) — includes order count and total spent | `customers.view` |
| GET | `/api/admin/customers/:id` — profile, addresses, recent orders | `customers.view` |
| POST | `/api/admin/customers/:id/block` / `unblock` | `customers.block` |
| DELETE | `/api/admin/customers/:id` — soft-delete and revoke sessions | `customers.delete` |
| POST | `/api/admin/customers/:id/restore` — clear `deletedAt` | `customers.delete` |
| GET | `/api/admin/customers/export` | `customers.export` |
| DELETE | `/api/admin/staff/:id` — soft-delete; last-admin and self-delete guards apply | ADMIN |
| POST | `/api/admin/staff/:id/restore` | ADMIN |

**Delivery**

| Method | Path | perm |
|---|---|---|
| GET/POST/PATCH | `/api/admin/delivery-areas(/:id)` | `delivery_areas.manage` |
| GET | `/api/admin/riders` | `riders.manage` or `orders.assign_rider` |
| POST/PATCH | `/api/admin/riders(/:id)` | `riders.manage` |

**Homepage**

| Method | Path | perm |
|---|---|---|
| GET/PUT | `/api/admin/homepage` | `homepage.manage` |
| POST | `/api/admin/uploads/banner` (multipart, `variant=desktop\|mobile`) | `homepage.manage` |

**Reports**

| Method | Path | perm |
|---|---|---|
| GET | `/api/admin/reports/sales?from&to&groupBy=day\|month` — orders count, revenue (excl. cancelled/returned, after discounts), average order, products subtotal, discounts, delivery fees, collected vs still to collect, a series with collected per period, and a by-payment-method breakdown | `reports.view` |
| GET | `/api/admin/reports/top-products?from&to&limit=20` — by quantity and revenue | `reports.view` |
| GET | `/api/admin/reports/cod?from&to` — COD expected vs collected, short and extra, still to collect; by rider and by day; and the list of orders collected short or extra with their reasons | `reports.view` |
| GET | `/api/admin/reports/:report/export` | `reports.export` |

**Staff, permissions, settings, audit (ADMIN only)**

| Method | Path | perm | Notes |
|---|---|---|---|
| GET | `/api/admin/permissions` | any staff | catalog, groups, dependencies, sensitive flags, presets (for UI) |
| GET | `/api/admin/staff` | ADMIN | |
| POST | `/api/admin/staff` | ADMIN | `{ name, email, phone?, role, permissions }` → returns `temporaryPassword` once |
| PATCH | `/api/admin/staff/:id` | ADMIN | `{ name?, phone?, role?, permissions?, status? }` (§4.5 rules) |
| POST | `/api/admin/staff/:id/reset-password` | ADMIN | returns new `temporaryPassword` once |
| POST | `/api/admin/staff/:id/verify-email` | ADMIN | marks the staff member's email verified (audit `user.email_verified`); for when the verification email can't be delivered |
| GET/PUT | `/api/admin/settings` | ADMIN | |
| GET | `/api/admin/audit-logs` (`actorId`, `entity`, `entityId`, `action`, `from`, `to`) | ADMIN | |

Temporary passwords: 12 random characters (no ambiguous characters), shown once in the UI, never emailed or logged.

---

## 8. Storefront (`apps/web/app/(shop)`)

### 8.1 Routes

| Route | Page | Rendering |
|---|---|---|
| `/` | Home | ISR 300 s |
| `/category/[slug]` | Category listing (sub-category chips, filters, sort, pagination) | ISR 300 s for page 1 without filters; dynamic otherwise |
| `/brand/[slug]` | Brand listing | as above |
| `/search?q=` | Search results | dynamic, `noindex` |
| `/product/[slug]` | Product detail | ISR 300 s |
| `/cart` | Cart | dynamic, `noindex` |
| `/checkout` | Checkout (login required → `/login?next=/checkout`) | dynamic, `noindex` |
| `/checkout/success/[orderNumber]` | Order placed | dynamic, `noindex` |
| `/login`, `/signup`, `/forgot-password`, `/reset-password?token=` | Auth | dynamic, `noindex` |
| `/pages/[key]` | About, FAQ, Contact, policies (Markdown from settings) | ISR 3600 s |
| `not-found`, `error` | Friendly 404 / error with search box and link home | |

### 8.2 Global layout

- **Header:** logo, search bar with suggestions (debounced 250 ms, keyboard navigable), delivery area selector ("Delivering to Gulshan-e-Iqbal" → dialog with area list; unserviceable areas shown disabled), account menu (login / my account / logout), cart icon with item count.
- **Category menu:** top-level categories with sub-categories (mega menu on desktop, drawer on mobile).
- **Footer:** contact (phone, WhatsApp, email, address from settings), links to `/pages/*`, payment methods accepted (Cash on delivery, Bank transfer).
- **Floating WhatsApp button** (settings.whatsapp) on mobile, above the sticky bars.

### 8.3 Home

Banners carousel (swipe on mobile, respects reduced motion), category tiles, featured products, deals, new arrivals, brands strip. Sections with no data are not rendered.

### 8.4 Product card

Image (`/300/`), brand, name, price line (`Rs 425 / bag`, or `From Rs 395 / bag` if variants differ), MRP struck through with "% off" when `mrp > price`, "Bulk price from Rs 395" when tiers exist, "Out of stock" badge, add button (adds default variant, qty 1; opens the product page if the product has several variants).

### 8.5 Product page

- Breadcrumbs; image gallery (thumbnails on desktop, swipe on mobile; `/800/` main, `/1600/` on zoom).
- Name, brand link, variant selector (chips per option; unavailable combinations disabled).
- **Price block — the signature element:** current unit price (large, tabular numbers), MRP and savings, and a **bulk price ladder** (table of tiers) where the row matching the chosen quantity is highlighted and a line shows the next saving: "Add 3 more to pay Rs 405 each".
- Quantity stepper (large buttons, direct input, 1–stock), line total updates live, "Add to cart".
- Stock status (In stock / Only 4 left / Out of stock) and delivery estimate for the selected area (fee or "Free delivery on orders over Rs X").
- Specifications table, description (Markdown rendered safely), related products.
- Mobile: sticky bottom bar with price × qty and "Add to cart".
- JSON-LD `Product` with offers (price, availability, `priceCurrency: PKR`).

### 8.6 Cart

- Lines: image, name, variant, unit price with "Bulk price applied (10+)", qty stepper, line total, remove. Next-tier nudge per line.
- Line issues shown inline with a fix button ("Remove", "Set to 12").
- Summary: subtotal, delivery estimate for the selected area (or prompt to choose an area), free-delivery progress ("Add Rs 2,300 more for free delivery"), total, "Checkout" button (disabled while there are issues).
- Guest: cart from localStorage priced via `/api/cart/quote`. Mobile: sticky summary bar.

### 8.7 Checkout (single page)

1. **Delivery address:** choose a saved address or add a new one inline (area dropdown; unserviceable areas disabled with a note).
2. **Payment method:** radio cards for Cash on delivery and Bank transfer (only enabled ones; COD hidden above the limit with the explanation). Bank transfer shows bank accounts (copy buttons) and instructions, plus optional receipt upload after placing the order.
3. **Order summary:** lines, subtotal, delivery fee, total; optional note.
4. **"Place order"** button: generates one `Idempotency-Key` per checkout visit, disabled while submitting. Handles `409 PRICE_CHANGED` / `OUT_OF_STOCK` by refreshing the summary with a clear message.

### 8.8 Order placed page

Order number, summary, payment status. Bank transfer: bank details, "Upload receipt" (drag and drop or camera on mobile). Links: "View order", WhatsApp support ("Hi, my order ARC-2026-000123").

### 8.9 Auth pages

Login (email or phone + password), signup (name, email, phone, password, company optional), forgot/reset password. After login: merge guest cart, redirect to `next` or `/account`. Clear, specific error messages.

---

## 9. User panel (`apps/web/app/(account)/account`)

Protected: redirect to `/login?next=...` when not logged in. Layout: side navigation on desktop, tabs on mobile. All pages `noindex`.

| Route | Content |
|---|---|
| `/account` | Greeting, last 3 orders with status, shortcuts |
| `/account/orders` | Orders list: number, date, items count, total, payment status, order status; paginated |
| `/account/orders/[orderNumber]` | Status timeline (Placed → Confirmed → Dispatched → Delivered, or Cancelled/Returned), items, delivery address, totals, payment method and status; bank transfer: receipts list with status/reject reason and upload; actions: Cancel (only when allowed, asks for reason), Download invoice, Reorder, WhatsApp support |
| `/account/addresses` | List, add, edit, delete, set default |
| `/account/profile` | Name, phone, company, email (read-only), change password |

---

## 10. Admin panel (`apps/web/app/(admin)/admin`)

### 10.1 Shell

- `/admin/login` (email + password), `/admin/change-password` (forced when `mustChangePassword`).
- Admin layout (server component) calls `/api/admin/auth/me`; not logged in → `/admin/login`; `mustChangePassword` → `/admin/change-password`.
- Sidebar items and page actions are generated from permissions (same keys as the API). A page the user cannot access renders an "Access denied" screen (and the API returns 403 anyway).
- Top bar: user name and role, change password, log out. All admin routes `noindex`, `dynamic = 'force-dynamic'`.
- Tables: shared `DataTable` component (TanStack Table) with server-side pagination, sorting, filter bar, empty state, loading skeleton. Forms: shared field components with React Hook Form + Zod (schemas from shared).
- Toasts for results ("Order confirmed", "Price updated"). Destructive actions use a confirm dialog that names the item.

### 10.2 Sidebar and required permission

| Menu | Route | Visible when |
|---|---|---|
| Dashboard | `/admin` | any staff (widgets filtered) |
| Orders | `/admin/orders` | `orders.view` |
| Products | `/admin/products` | `products.view` |
| Import | `/admin/products/import` | `products.import` |
| Stock history | `/admin/stock-movements` | `stock_movements.view` |
| Categories | `/admin/categories` | `categories.manage` |
| Brands | `/admin/brands` | `brands.manage` |
| Users | `/admin/users` | ADMIN or `customers.view` |
| Delivery areas | `/admin/delivery-areas` | `delivery_areas.manage` |
| Riders | `/admin/riders` | `riders.manage` |
| Homepage | `/admin/homepage` | `homepage.manage` |
| Reports | `/admin/reports` | `reports.view` |
| Settings | `/admin/settings` | ADMIN |
| Audit log | `/admin/audit-logs` | ADMIN |

### 10.3 Dashboard

Cards: today's orders and revenue, last 7/30 days revenue with a small chart (`dashboard.view`); orders by status with links (`orders.view`); receipts awaiting verification (`orders.verify_payment`); COD to collect (`orders.cod_collect` or `dashboard.view`); low-stock list (`products.view`).

### 10.4 Orders

- **List:** status tabs (New, Confirmed, Dispatched, Delivered, Cancelled & returned, All) with counts; filters: payment status, payment method, date range, area, rider, search. Columns: order number, date, customer, phone, area, total, payment (method + status badge), status badge, rider.
- **Detail:** header with number, status, created date and the action buttons allowed by the state machine **and** the user's permissions (e.g. "Confirm order", "Mark dispatched", "Mark delivered", "Cancel order"); customer block (name, click-to-call, WhatsApp link, email, address with area); items table (SKU, variant, qty, unit price, tier, line total); totals; payment panel (method, status, receipts with preview through presigned URL, Approve / Reject with reason, COD collected form); rider select; status timeline with who/when/note; internal note; "Print invoice".
- Export button (`orders.export`) exports the current filter to Excel.

### 10.5 Products

- **List:** image, name, brand, category, price range, total stock (low-stock badge), status, updated; filters: search, category, brand, status, low stock.
- **Form (new/edit), sections:**
  1. Basics: name, slug (auto, editable), brand, category, type, unit, status.
  2. Images: drag-and-drop upload (multiple), reorder, alt text, remove.
  3. Variants: editable table — label, options, SKU, MRP, price, bulk tiers (inline editor with validation messages from §6.1), stock (read-only; "Adjust stock" dialog with change and reason when `products.edit_stock`), low-stock threshold, active.
  4. Specifications: key/value rows.
  5. Description: Markdown textarea with preview.
  6. SEO: optional title and description.
- Without `products.edit_price`, price fields are read-only with a lock icon and tooltip "You don't have permission to change prices."
- **Import page:** download template, upload `.xlsx`, progress (polls job every 2 s), summary (created / updated / failed) and an errors table (row, SKU, message). Rules in §12.3.

### 10.6 Stock history

Table: date, SKU, product, change (+/−), stock after, reason, reference (order link / import job), note, user. Filters: SKU, reason, date range.

### 10.7 Categories and brands

- Categories: table grouped by parent; fields name, slug, parent (top-level only), description, image, sort order, show on home, status.
- Brands: name, slug, logo, sort order, status.

### 10.8 Users (`/admin/users`)

Two tabs: **Staff & admins** (ADMIN only) and **Customers** (`customers.view`). Tabs the user cannot access are not shown.

**Staff & admins tab**

- Table: name, email, role, status, last login, actions (Edit, Reset password, Block/Unblock, Delete). Soft-deleted accounts remain hidden in the UI.
- **Add / edit staff** (side sheet):
  - Name, email (not editable after create), phone, role (Admin / Staff), status.
  - On create: the temporary password is generated by the API and shown once in a dialog with a copy button and the note "Share this securely. They must change it at first login."
  - **Permissions** (visible only when role = Staff):
    - "Start from a preset" dropdown (Order Manager, Catalog Manager, Accountant / Viewer) that fills the checkboxes; the admin can then tick/untick freely.
    - One box per group (Dashboard, Orders, Products, Catalog, Customers, Delivery, Content, Reports, Stock) with a "Select all" checkbox (tri-state) in the group header.
    - Each checkbox shows the label; sensitive ones show a small "Sensitive" badge.
    - Ticking a permission auto-ticks its dependencies; unticking a dependency unticks the permissions that need it (with a short inline note).
    - A live summary: "7 permissions selected".
  - Role = Admin: the permission area shows "Admins have full access, including staff and settings."
- Guard rails in the UI mirror §4.5 (last admin, own role, self-block) with clear messages; the API enforces them.

**Customers tab**

- Table: name, email, phone, company, orders, total spent, status, joined; search and status filter; export (`customers.export`). Soft-deleted accounts remain hidden in the UI.
- Customer detail: profile, addresses, orders list (links to order detail if `orders.view`), Block / Unblock (`customers.block`) and Delete (`customers.delete`) with confirmation.

### 10.9 Delivery areas and riders

- Delivery areas: inline-editable table — name, city, serviceable toggle, delivery fee (blank = default), free delivery above (blank = none), sort order. Shows default fee from settings.
- Riders: name, phone, active toggle.

### 10.10 Homepage

Banners: upload desktop (1600×500) and optional mobile (800×600) images, alt text, link, active, drag to reorder. Featured products and deals: searchable product picker, drag to reorder, max 12 each. Link to categories page for "Show on home" tiles. Saving triggers revalidation of `/`.

### 10.11 Reports

Date range picker (presets: today, 7 days, 30 days, this month, custom). Sales: totals (orders, revenue, average order) and chart by day/month. Top products table. COD report: collected vs pending by rider and day. Export buttons (`reports.export`).

### 10.12 Settings (ADMIN)

Sections: Store info; Notifications (order emails, RFP email); Payments (COD on/off, COD max order amount, bank transfer on/off, bank accounts repeater, instructions); Delivery (default delivery fee); Inventory (low-stock default); Pages (Markdown editors for about, FAQ, contact, refund, delivery, privacy, terms). Save writes an audit log with changed fields and revalidates affected pages.

### 10.13 Audit log (ADMIN)

Table: time, user, role, action, entity (link), summary; filters: user, entity, action, date range. Row expands to show before/after of changed fields.

---

## 11. Emails

Sent through one `notify(event, payload)` service → Agenda job `send-email` (3 retries, exponential backoff; failures logged, never block the request). Every event uses the approved Aricon email design: a responsive white card, ARICON brand header, event kicker and headline, soft blue/pink/lavender accents, clear order details and buttons, and the store contact footer. Keep HTML + plain-text versions, escape dynamic content, and use safe `APP_URL` links.

| Event | To | Content |
|---|---|---|
| `user.welcome` | customer | Welcome, link to shop |
| `auth.password_reset` | customer | Reset link (60 min) |
| `order.placed` | customer | Order number, items, totals, payment method; bank transfer: bank accounts + instructions + upload link |
| `order.placed.staff` | `settings.orderNotificationEmails` | Order number, customer, area, total, payment method, admin link |
| `order.receipt_uploaded.staff` | `settings.orderNotificationEmails` | Order number, admin link |
| `order.payment_received` | customer | Payment verified |
| `order.payment_rejected` | customer | Reason, link to upload again |
| `order.confirmed` | customer | Confirmed |
| `order.dispatched` | customer | Rider name and phone |
| `order.delivered` | customer | Delivered, invoice link |
| `order.cancelled` | customer | Reason |
| `rfp.inquiry` | `settings.rfpEmail` | All RFP fields, reply-to = inquirer email |

---

## 12. Files, images and import

### 12.1 Storage keys

| Bucket | Key pattern |
|---|---|
| public | `products/{productId}/{imageId}/{300\|800\|1600}.webp` |
| public | `banners/{bannerId}/{desktop\|mobile}.webp` |
| public | `categories/{categoryId}/image.webp`, `brands/{brandId}/logo.webp` |
| private | `receipts/{orderId}/{receiptId}.{jpg\|png\|webp\|pdf}` |
| private | `imports/{jobId}.xlsx` |
| private | `backups/mongo/{YYYY-MM-DD}.archive.gz` |

`imageUrl(key, size)` in shared builds `{PUBLIC_IMAGE_BASE_URL}/{key-with-size}`. Next.js uses a custom `next/image` loader that picks 300/800/1600 by requested width (`images.loader: 'custom'`), so no image processing happens on the server at request time.

### 12.2 Upload processing

- Check real type with `file-type` (magic bytes). Allowed: product/banner/category/brand images `jpg/png/webp` ≤ 8 MB; receipts `jpg/png/webp/pdf` ≤ 5 MB; imports `xlsx` ≤ 5 MB.
- Images: sharp → auto-rotate, strip metadata, resize to width 300/800/1600 (no upscaling), WebP quality 80. Banners: desktop 1600 wide, mobile 800 wide.
- Receipt images: re-encoded to strip metadata (keep original PDF bytes).
- Single product image uploads are processed in the request; bulk image work runs in jobs.

### 12.3 Excel import (products)

Template columns (one row per **variant**):

`product_slug` (optional; generated from name if empty), `product_name`, `brand` (name or slug; must exist), `category_slug` (must exist), `type`, `unit`, `description`, `status` (`active`/`hidden`), `sku` (required), `variant_label`, `pack_size`, `grade`, `colour`, `size`, `mrp`, `price`, `tier1_min_qty`, `tier1_price`, `tier2_min_qty`, `tier2_price`, `tier3_min_qty`, `tier3_price`, `stock`, `low_stock_threshold`, `image_urls` (comma-separated https URLs, optional).

Rules:

- Rows are grouped into products by `product_slug` (or generated slug). **Upsert by `sku`**: existing SKU → update; new SKU → added to the product (created if needed).
- Price columns are applied only if the importer has `products.edit_price`; otherwise they are ignored for existing SKUs, and new SKUs without that permission fail with a row error.
- Stock is applied only with `products.edit_stock` (as an absolute value, writing `stockMovements` with reason `IMPORT` and the difference).
- Each row is validated with the same Zod schemas and tier rules; invalid rows are reported and skipped; valid rows are saved.
- `image_urls`: download (https only, ≤ 10 MB each, 10 s timeout, image types only), process like uploads; failures become row warnings.
- Runs as an Agenda job (`import-products`, concurrency 1); progress stored in `importJobs`; audit log entry on finish; revalidate affected pages.

---

## 13. Background jobs (Agenda)

| Job | Concurrency | Notes |
|---|---|---|
| `send-email` | 2 | retries 3× |
| `import-products` | 1 | §12.3 |
| `revalidate-paths` | 1 | calls Next.js `/_internal/revalidate` with a list of paths/tags; debounced |

Agenda starts with the API process (`processEvery: '5 seconds'`). Graceful shutdown on SIGTERM (finish current job, stop Agenda, close DB).

---

## 14. SEO and performance

- Per-page `generateMetadata` (title, description, canonical, Open Graph image = main product image). Product/category descriptions fall back to generated text.
- `/sitemap.xml` (home, active categories, brands, products, pages) and `/robots.txt` (disallow `/admin`, `/account`, `/checkout`, `/cart`, `/search`).
- JSON-LD: `Product` on product pages, `BreadcrumbList` on category/product, `Organization` on home.
- Revalidation tags: `product:{slug}`, `category:{slug}`, `brand:{slug}`, `home`, `pages`. The API triggers revalidation after product, category, brand, homepage, settings and stock changes (stock affects "in stock" badges; debounce 60 s).
- Fonts via `next/font` (self-hosted). LCP image gets `priority`. Lists lazy-load images.
- Targets: Lighthouse mobile performance ≥ 85 and accessibility ≥ 95 on home, category and product pages; API p95 < 300 ms for catalog reads on the server.
- Memory on the server: API `--max-old-space-size=384`, Next.js `--max-old-space-size=512`, MongoDB WiredTiger cache 1 GB.

---

## 15. Design direction

**Subject and audience:** a construction-materials store used mostly on mid-range Android phones, often outdoors on building sites and on mobile data. The primary job: find the right material, see the real price for the quantity, and order fast. The design should feel like dependable site equipment — clear, sturdy, high-contrast — not like a lifestyle shop.

**Palette**

| Token | Hex | Use |
|---|---|---|
| `ink` (Rebar) | `#1E2A32` | Text, header, primary dark surfaces |
| `concrete` | `#EEF0F1` | Page background (cool grey) |
| `surface` | `#FFFFFF` | Cards, panels, inputs |
| `amber` (Safety amber) | `#F2A900` | Primary actions only: "Add to cart", "Place order" (text in `ink`) and the active tier in the bulk price ladder |
| `blueprint` | `#1F5AA6` | Links, secondary actions, focus ring |
| `cement` | `#6B747B` | Secondary text, borders (use lighter tints for dividers) |
| `success` / `danger` | `#1E7B4F` / `#B42318` | Status only |

**Type:** headings and prices in **Barlow Semi Condensed** (600/700, signage-like); body and UI in **Noto Sans** (400/500/600). Prices use tabular numerals. Scale: 12 / 14 / 16 / 18 / 22 / 28 / 36 px; body 16 px on mobile.

**Layout:** mobile-first; product grid 2 columns on mobile, 3 on tablet, 4–5 on desktop; content max width 1280 px, left-aligned text. Sticky bottom bars on mobile for product and cart. Minimum tap target 44 px; quantity steppers at least 44 px high. Radius: 6 px for inputs and buttons, 10 px for image containers; separate things with borders and spacing rather than shadows.

**Signature element:** the bulk price ladder on the product page (and its compact version in the cart). Spend visual boldness here; keep everything else quiet.

**Avoid:** all-caps eyebrow labels above headings, arrows appended to button text, identical rounded cards with the same soft shadow everywhere, gradient washes, fade-in animations on every section, a cream background with a terracotta accent. Motion only in response to user actions (adding to cart, opening a drawer) and respect `prefers-reduced-motion`.

**Admin:** same tokens, denser layout (14 px tables), shadcn/ui defaults otherwise.

**Copy:** sentence case, plain words, specific errors that say how to fix the problem ("This area isn't served yet. Choose another address."). Buttons name the result, and toasts repeat it ("Place order" → "Order placed").

---

## 16. Security checklist (verify in Phase 5)

- [ ] Every `/api/admin/*` route has `requirePermission` or `requireAdmin` (add a test that walks the router and fails if a route has neither).
- [ ] Customer endpoints check ownership (orders, addresses, receipts) → 404 for others' resources.
- [ ] Field-level price/stock permission enforced in API (tests).
- [ ] Sessions: separate cookies/stores, httpOnly, Secure, SameSite=Lax, regenerated on login, deleted on block/password change.
- [ ] Origin check on state-changing requests; RFP CORS allowlist only.
- [ ] Rate limits and lockout as §7.1 / §6.11.
- [ ] Helmet security headers (API) and Next.js headers: CSP (self + image domain + fonts), `X-Frame-Options: DENY` for `/admin`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Zod strict schemas everywhere; `sanitizeFilter` on; no raw user input in `$where`/regex without escaping (escape regex for search).
- [ ] Uploads: magic-byte check, size limits, re-encoding; private files only via presigned URLs.
- [ ] Markdown rendered with a sanitizer (no raw HTML).
- [ ] No secrets in repo; `.env.example` complete; production error responses contain no stack traces.
- [ ] Audit logs written for all actions listed in `CLAUDE.md`.
- [ ] Dependencies: `pnpm audit` has no high/critical issues.

---

## 17. Phases and acceptance criteria

Each phase starts with a plan (files, models, endpoints, tests) and ends with typecheck + lint + tests green, `PROGRESS.md` updated and a summary of how to test manually.

### Phase 0 — Repository setup

Scope: pnpm workspace, `tsconfig` base + per package, ESLint + Prettier, `packages/shared` skeleton, `apps/api` Express skeleton (env validation, pino, error handler, `/api/health`), `apps/web` Next.js skeleton with Tailwind + shadcn/ui and design tokens (§15), `infra/docker-compose.yml` (MongoDB replica set), root scripts (see `CLAUDE.md`), `.env.example` files, GitHub Actions `ci.yml` (install, typecheck, lint, test), `PROGRESS.md`.

Acceptance: `pnpm dev` starts web on 3000 and API on 4000; `GET /api/health` returns ok with DB connected; the web home shows a placeholder using the design tokens and fonts; CI passes.

### Phase 1 — Shared logic and data layer

Scope: shared Zod schemas and enums, `permissions.ts` (§4), pricing (§6.1–6.2), delivery fee (§6.4), order status machine (§6.7), formatters (§6.13), phone normalization; all Mongoose models with indexes and hooks (§5); `withTransaction`; storage driver interface (local + r2); seed scripts `seed:admin` and `seed:demo` (§19).

Tests (MUST): pricing tiers (edges 9/10/49/50), tier validation, cart totals and issues, delivery fee incl. free threshold, state machine allowed/blocked transitions, `withDependencies`, phone normalization.

Acceptance: tests green; seeds run on a fresh database; indexes created (`syncIndexes` on startup in development).

### Phase 2a — Customer-facing API

Scope: customer auth (§6.11), catalog endpoints with facets and search (§7.2), cart incl. quote and merge, orders with transaction and idempotency (§6.6), cancel, receipts, invoice PDF, reorder, account/addresses, RFP endpoint, email notifications via Agenda, rate limits, Origin check.

Tests (MUST): signup/login/lockout/blocked; staff credentials rejected on customer login; product listing filters and facets; cart merge; order placement happy path (stock decremented, movements written, cart emptied, order number format); concurrency (no overselling); idempotency (same key → same order); `PRICE_CHANGED`; `OUT_OF_STOCK`; customer cancel only when `NEW`; receipt upload changes payment status; ownership (another user's order → 404).

Acceptance: tests green; an `apps/api/requests.http` file with example calls for every endpoint.

### Phase 2b — Admin API

Scope: admin auth and forced password change, dashboard, orders management (§6.7–6.8), products CRUD with field-level permissions, stock adjustments, uploads, categories/brands, customers, delivery areas, riders, homepage, reports, Excel import/export (§12.3), staff management and permissions (§4), settings, audit logs, revalidation calls.

Tests (MUST): route-walk test (every admin route guarded); STAFF without permission → 403 on a sample of each module; `products.edit` without `products.edit_price` cannot change prices (403) but can change name; stock only via adjustment endpoint; COD approve → receipt approve → confirm flow; `CONFIRMED → DISPATCHED` requires rider; cancel/return restock; last-admin guard; permission dependencies applied on save; audit log written for price change, status change, permissions change; import creates/updates by SKU and reports row errors.

Acceptance: tests green; `requests.http` extended.

### Phase 3 — Storefront and user panel UI

Scope: §8 and §9 complete, responsive, with loading/empty/error states, SEO (§14).

Acceptance (manual, on a 390 px viewport and desktop): browse → filter → product → add bulk quantity (tier highlights) → guest cart → login/signup (cart merges) → checkout with COD → success page → order visible in account; repeat with bank transfer and receipt upload; cancel a `NEW` order; download invoice; reorder. Sitemap, robots and JSON-LD present. Lighthouse targets (§14) on home, category, product.

### Phase 4 — Admin panel UI

Scope: §10 complete, including Users with permission checkboxes, presets, dependencies and guard rails.

Acceptance: log in as the demo "Order Manager" staff → sees only Dashboard (limited), Orders, Users → Customers; direct URL to `/admin/products` shows Access denied; can confirm/dispatch/deliver and verify receipts but cannot cancel. Log in as admin → create staff with the Catalog Manager preset, remove `products.edit_price` → that staff sees price fields locked. Full order lifecycle works from the admin. Import template round-trip works.

### Phase 5 — Hardening

Scope: §16 checklist, accessibility pass (keyboard, labels, contrast), error pages, performance fixes, light load test of catalog endpoints and order placement (e.g. autocannon, documented results).

Acceptance: checklist ticked in `PROGRESS.md`; no high/critical `pnpm audit` issues.

### Phase 6 — Deployment

Scope: §18 — Nginx config, PM2 ecosystem, `mongod.conf` snippet, backup script + cron, GitHub Actions `deploy.yml`, `infra/DEPLOY.md` (step-by-step server setup from a fresh Ubuntu 24.04 VPS, including Cloudflare and R2 setup).

Acceptance: following `DEPLOY.md` on a fresh VPS produces a working site at `shop.aricon.com.pk`; a push to `main` deploys with a health check and automatic rollback; a backup file appears in R2.

---

## 18. Deployment

### 18.1 Server (Hostinger KVM 1, Ubuntu 24.04 LTS, Europe or Singapore region)

- Create a sudo user, SSH keys only, disable root and password login; UFW allows 22, 80, 443 (80/443 SHOULD be limited to Cloudflare IP ranges); `unattended-upgrades`; 2 GB swap file.
- Install Node.js 24 LTS, pnpm, PM2 (+ `pm2-logrotate`), Nginx, MongoDB Community (current stable) — replica set `rs0` single node, `bindIp: 127.0.0.1`, authorization enabled (app user with least privileges), `wiredTiger.engineConfig.cacheSizeGB: 1`.
- Directory layout: `/srv/aricon/releases/{timestamp}`, `/srv/aricon/current` (symlink), `/srv/aricon/shared/{.env.api,.env.web}`, `/srv/aricon/scripts/`.

### 18.2 Nginx

- `server_name shop.aricon.com.pk`; TLS with a Cloudflare Origin Certificate (Cloudflare SSL mode "Full (strict)").
- `location /api/` → `proxy_pass http://127.0.0.1:4000;` `location /_internal/` → `return 404;` `location /` → `proxy_pass http://127.0.0.1:3000;`
- `client_max_body_size 10m`; gzip; forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`; `real_ip_header CF-Connecting-IP` with Cloudflare `set_real_ip_from` ranges.
- Next.js static assets (`/_next/static`) cached for a year.

### 18.3 PM2 (`infra/ecosystem.config.cjs`)

- `aricon-api`: `node dist/index.js` from the API release folder, `NODE_OPTIONS=--max-old-space-size=384`, `max_memory_restart: '450M'`, env file `/srv/aricon/shared/.env.api`.
- `aricon-web`: Next.js standalone server (`node server.js`, port 3000), `NODE_OPTIONS=--max-old-space-size=512`, `max_memory_restart: '700M'`.
- One instance each (1 vCPU). `pm2 startup` + `pm2 save`.

### 18.4 GitHub Actions `deploy.yml` (on push to `main`)

1. Install with pnpm cache → typecheck → lint → test (tests use mongodb-memory-server).
2. Build: API with `tsc`, then `pnpm deploy --filter api --prod out/api` (self-contained folder incl. production `node_modules`, built on `ubuntu-24.04` x64 so sharp binaries match the server); Next.js with `output: 'standalone'` (copy `public` and `.next/static` into the standalone folder).
3. rsync `out/api` and the web standalone folder to `/srv/aricon/releases/{timestamp}` over SSH (secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_KNOWN_HOSTS`).
4. On the server: link shared env files, switch `current` symlink, `pm2 reload infra/ecosystem.config.cjs`, health check `https://shop.aricon.com.pk/api/health` (retry 10× every 3 s); on failure switch the symlink back and reload. Keep the last 5 releases.

### 18.5 Backups and monitoring

- `/srv/aricon/scripts/backup-mongo.sh` via cron at 02:30 Asia/Karachi: `mongodump --archive --gzip` → upload to R2 private `backups/mongo/{date}.archive.gz` (aws cli or rclone with the R2 endpoint) → delete backups older than 30 days. Document a tested restore command in `DEPLOY.md`.
- Hostinger weekly backups stay enabled as a second layer.
- External uptime check on `/api/health` (e.g. a free uptime monitor), PM2 auto-restart, logs in `~/.pm2/logs` with rotation (10 MB × 10 files).

---

## 19. Seed data

**`seed:admin`** — creates the first `ADMIN` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or interactive prompt). Refuses if an admin with that email exists. `mustChangePassword: false`.

**`seed:demo`** (development and staging only; refuses when `NODE_ENV=production` unless `--force`), clearly marked demo data to be replaced by the client:

- Settings: store name "Aricon", phone/WhatsApp placeholders, COD and bank transfer on, `codMaxOrderAmount` 200,000, default delivery fee 500, one demo bank account, placeholder pages text.
- Categories: Cement & plaster, Tiles & adhesives, Plywood & boards, Paint, Waterproofing, Electrical, Plumbing, Hardware — each with 2–3 sub-categories; 6 shown on home.
- 12 brands; ~40 products with 1–4 variants each, realistic units (e.g. cement "50 kg bag" price 425 with tiers 10+/415, 30+/405, 50+/395), stock 0–500 including some low-stock and out-of-stock variants.
- Placeholder product images generated with sharp (solid colour + product initials) and uploaded through the storage driver.
- Delivery areas (Karachi): Gulshan-e-Iqbal, Gulistan-e-Jauhar, DHA, Clifton, PECHS, North Nazimabad, Nazimabad, FB Area, Saddar, Korangi, Malir, Bahria Town Karachi — demo fees 300–800, some with free delivery above 50,000; one area not serviceable.
- 2 riders; homepage with 3 banners, 8 featured and 8 deal products.
- Users: demo customer (with 2 addresses and 3 orders in different states), staff "Order Manager" (preset), staff "Catalog Manager" (preset). Print all demo credentials at the end.

---

## 20. Assumptions and open items (confirm with the client)

- Delivery areas, fees and free-delivery thresholds: demo values until Aricon provides the real list.
- Policies, FAQ and About text: placeholders until provided.
- Bank account details and notification email addresses: to be entered by the admin in Settings.
- Portal address `shop.aricon.com.pk` under the Aricon brand.
- Single currency (PKR) and one city (Karachi) at launch; areas already store `city` for later expansion.
- Online payments, SMS and the other §1.3 items are future phases; keep `paymentMethod`, `notify()` and the permission catalog easy to extend.
