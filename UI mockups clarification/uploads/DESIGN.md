# Aricon Shop — Design brief for Claude Design

Paste this whole file into Claude Design first. Then use the prompts in §12, one at a time. The tokens and component names here match `SPEC.md` §15, so the same design can be built in code later by Claude Code.

---

## 1. The product in one paragraph

**Aricon Shop** (`shop.aricon.com.pk`) is the online store of **Aricon Engineering Consultants**, a Karachi engineering and construction firm (PEC Tier-1, established 2005). It sells **construction materials** — civil (cement, tiles and adhesives, plywood and boards, paint, waterproofing), electrical (wires and cables, switches and sockets, breakers and distribution boards, conduits, lighting, fans), plumbing and sanitary (pipes, fittings, taps, tanks) and hardware and tools. Customers order online and pay **cash on delivery** or by **bank transfer**; Aricon's own riders deliver to a list of Karachi areas. Materials are bought in quantity, so **bulk pricing** (a lower unit price from a minimum quantity) is on every product.

## 2. Who uses it, and where

| Person | Context | What they need from the screen |
|---|---|---|
| Contractor / site supervisor | On a building site, phone in one hand, bright sunlight, mobile data | Find the item fast, see the price for 40 bags, reorder last week's list |
| Electrician / plumber | Buying for a job, knows exact specs (gauge, size, amps) | Filter by spec, compare variants, clear stock status |
| Homeowner renovating | Less technical, price-sensitive, needs trust | Genuine brands, clear delivery charge, cash on delivery |
| Aricon staff (admin) | Office desktop, many orders a day | Dense, fast tables; clear order status; permission-controlled actions |

Most traffic is **mid-range Android phones (390 px wide)**. UI language is English (normal for Pakistani e-commerce); names and addresses may be Urdu-origin words written in English.

## 3. Design principles

1. **The price for your quantity is always obvious.** The bulk price ladder is the signature element of the whole product.
2. **Specs before stories.** People search by pack size, grade, gauge, size and brand. Filters and variant choices are large and clear.
3. **Trust through plain facts.** Genuine brands, the Aricon engineering name, the delivery charge for your area, cash on delivery — stated simply, without hype.
4. **Site-ready.** High contrast, big numbers, big tap targets, readable in sunlight, fast on cheap phones. No decoration that costs load time.
5. **One bold thing per screen.** Keep everything else quiet and disciplined.

**Personality:** dependable, precise, practical. Like good site equipment: sturdy, labeled, nothing extra.

---

## 4. Design tokens

### 4.1 Colour

Core palette (same names as `SPEC.md` §15):

| Token | Hex | Role |
|---|---|---|
| `ink` (Rebar) | `#1E2A32` | Main text, header, admin sidebar, dark surfaces |
| `concrete` | `#EEF0F1` | Page background (cool grey, never cream) |
| `surface` | `#FFFFFF` | Panels, product image backgrounds, inputs, tables |
| `amber` (Safety amber) | `#F2A900` | Primary actions only ("Add to cart", "Place order") and the active bulk tier. Text on amber is always `ink` |
| `blueprint` | `#1F5AA6` | Links, secondary actions, focus ring, info |
| `cement` | `#6B747B` | Secondary text and icons (on white only) |

Extended scale:

| Token | Hex | Use |
|---|---|---|
| `ink-700` | `#33424D` | Secondary text on `concrete` backgrounds |
| `concrete-50` | `#F6F7F8` | Table zebra, hover rows |
| `concrete-200` | `#DDE1E4` | Borders and dividers |
| `concrete-400` | `#A9B1B7` | Disabled text, placeholder |
| `amber-600` | `#D99600` | Primary button hover |
| `amber-700` | `#B97F00` | Primary button pressed |
| `amber-100` | `#FFF3CC` | Active tier row background, warning background |
| `blueprint-700` | `#174785` | Link hover |
| `blueprint-50` | `#EAF1FB` | Info background, selected chip background |
| `success-700` / `success-50` | `#1E7B4F` / `#E7F4EC` | In stock, paid, delivered |
| `danger-700` / `danger-50` | `#B42318` / `#FDECEA` | Errors, out of stock, cancelled |

Contrast rules: `ink` on `amber` and white on `blueprint` both pass WCAG AA comfortably. `cement` text only on white; on `concrete` use `ink-700`.

### 4.2 Typography

| Role | Font | Size / line height (mobile → desktop) | Weight |
|---|---|---|---|
| Display (home hero) | Barlow Semi Condensed | 36/40 → 52/56 | 700 |
| Page title (H1) | Barlow Semi Condensed | 28/34 → 36/42 | 700 |
| Section title (H2) | Barlow Semi Condensed | 22/28 → 26/32 | 600 |
| Card / panel title (H3) | Noto Sans | 18/24 | 600 |
| Price, large (product page) | Barlow Semi Condensed, tabular numbers | 34/38 | 700 |
| Price, card | Barlow Semi Condensed, tabular numbers | 20/24 | 700 |
| Body | Noto Sans | 16/24 | 400 |
| Body small | Noto Sans | 14/20 | 400 / 500 |
| Caption (minimum size) | Noto Sans | 12/16 | 500 |
| Button label | Noto Sans | 16/20 (14/20 in admin) | 600 |
| Admin table text | Noto Sans | 14/20 | 400 |

Sentence case everywhere. No all-caps labels. Prices always as `Rs 1,450` with the unit: `Rs 1,450 / bag`.

### 4.3 Space, shape, depth

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64. Mobile page margin 16; desktop content max width 1280.
- Grid: mobile 4 columns / 16 gutter; tablet 8 / 20; desktop 12 / 24.
- Breakpoints: 390 (design base), 768, 1024, 1440.
- Radius: 6 for buttons, inputs, chips; 10 for image containers and panels; 4 for badges.
- Borders do the work: 1 px `concrete-200`. **No shadows on cards.** Shadows only on floating layers (dropdowns, dialogs, sticky bars, toasts): `0 8px 24px rgba(30,42,50,0.16)`.
- Focus: 2 px `blueprint` ring with 2 px offset, always visible for keyboard users.
- Tap targets: at least 44 × 44 px; quantity stepper buttons 48 × 48 on mobile.

### 4.4 Icons and imagery

- UI icons: Lucide, 1.75 px stroke, 20 px (admin) / 24 px (storefront).
- Category icons: a custom set in a **technical-drawing line style** (single weight, square line caps, drawn like symbols on an engineering drawing): cement bag, tile grid, stacked ply sheets, paint tin, water drop with shield, wire coil, switch plate, breaker, conduit bend, bulb, fan, pipe elbow, tap, hinge, padlock, drill.
- Product photos: square 1:1, product centered on pure white, consistent padding, no lifestyle shots in listings.
- Banners: real Aricon project photography or flat compositions in `ink` and `amber`. Avoid stock photos of smiling workers in hard hats.

### 4.5 The one visual motif: the dimension line

Borrowed from engineering drawings: a thin line with small end ticks, like a measurement on a blueprint. Use it in exactly two places:

1. **The bulk price ladder** — a quantity scale above the tier rows (`1 ─┼─ 10 ─┼─ 50 ─┼─ 100+`) with a marker at the chosen quantity.
2. **The free-delivery progress** in the cart — a measured bar with ticks toward the free-delivery amount.

Nowhere else. It is meaningful because it measures something.

### 4.6 Motion

Only in response to a person's action: item added to cart (cart count bumps, toast slides up), drawers and dialogs open, tier row highlight moves as quantity changes (150 ms). Respect `prefers-reduced-motion`. No scroll-triggered fade-ins, no auto-playing animations except the home banner carousel (which pauses on touch and respects reduced motion).

### 4.7 Avoid (these read as generic, templated design)

- All-caps "eyebrow" labels above headings.
- Arrows appended to button text ("Shop now →").
- Every section chopped into identical rounded cards with the same soft shadow.
- Gradient washes and decorative blobs.
- Cream backgrounds with terracotta accents; near-black backgrounds with neon accents.
- Meta strings joined with middle dots, monospace micro-labels.
- Numbered markers (01 / 02 / 03) on things that aren't steps. (Checkout and order status *are* steps, so numbers are fine there.)
- Emoji in the UI.

---

## 5. Information architecture

### 5.1 Departments and categories (two levels, as in `SPEC.md` §5.4)

| Department (top level) | Categories |
|---|---|
| **Civil** | Cement & plaster · Tiles & adhesives · Plywood & boards · Paint & primers · Waterproofing |
| **Electrical** | Wires & cables · Switches & sockets · Breakers & distribution boards · Conduits & fittings · Lighting · Fans |
| **Plumbing & sanitary** | Pipes · Pipe fittings · Taps & showers · Water tanks |
| **Hardware & tools** | Hinges & handles · Locks · Fasteners · Power tools · Safety gear |

(The table uses middle dots only to save space in this brief; in the UI these are separate links.)

- **Mobile:** a menu drawer with the four departments as expandable groups; each category is a full-width row with its line icon.
- **Desktop:** "All categories" button opens a mega menu — four columns (one per department), department name as the column heading, categories as links with icons.
- Home page category tiles show the most-used categories across departments (Cement & plaster, Wires & cables, Pipes, Tiles & adhesives, Paint & primers, Switches & sockets).

### 5.2 Filters by category (what matters to buyers)

| Category | Main filters |
|---|---|
| Cement & plaster | Brand, type (OPC / PPC / SRC / plaster), pack size |
| Tiles & adhesives | Brand, size (e.g. 60×60 cm), finish, pack size |
| Paint & primers | Brand, type (emulsion / enamel / primer), pack size (quarter, gallon, drum), colour |
| Wires & cables | Brand, size (e.g. 3/29, 7/29, 7/36), cores, coil length |
| Switches & sockets | Brand, type (switch / socket / dimmer), rating (amps), colour |
| Breakers & DBs | Brand, type (MCB / RCCB / DB), rating (amps), poles |
| Pipes | Brand, material (PPRC / uPVC / GI), diameter, length |

In the data these map to `type`, `packSize`, `grade`, `colour`, `size` (SPEC §5.6). Show a filter only when the current results have 2+ values.

---

## 6. Components

For each component design all states: default, hover (desktop), pressed, focus, disabled, loading, error where relevant.

| Component | Notes |
|---|---|
| **Button** | Primary (amber, ink text), secondary (white, ink 1 px border), tertiary (text, blueprint), destructive (danger-700). Heights: 48 mobile / 40 desktop / 36 admin. Full-width on mobile for main actions. |
| **Text input / select / textarea** | Label always visible above the field, helper text below, error text in danger-700 with an icon. 48 px high on mobile. |
| **Quantity stepper** | `[ − ] 12 [ + ]` with a typeable number; 48 px buttons on mobile; shows the unit next to it ("bags"). Disabled minus at 1, disabled plus at stock limit with helper "Only 38 in stock". |
| **Variant chips** | One row per option (Pack size, Grade, Colour). Selected: blueprint-50 fill + blueprint border. Unavailable: dashed border, concrete-400 text, still readable. |
| **Badges** | Stock (In stock / Only 4 left / Out of stock), discount ("Save 3%"), order status, payment status (§6.1). Radius 4, 12 px medium text. |
| **Product card** | See §6.2. |
| **Price block + bulk price ladder** | See §6.3 — the signature component. |
| **Delivery area selector** | Header chip "Delivering to Gulshan-e-Iqbal" with chevron; opens a dialog/sheet with a searchable list; unserviceable areas shown with "Not delivering yet". Shows fee and free-delivery threshold for the chosen area. |
| **Search with suggestions** | Dropdown grouped into Products (thumbnail, name, price), Categories, Brands; highlights matched text; "See all results for 'cement'". Empty: "No matches for 'xyz'. Try a brand or product type." |
| **Filter panel** | Desktop: left column with collapsible groups, counts next to values, price range with two inputs. Mobile: "Filters (3)" button opens a full-height sheet with "Show 42 products" sticky button. Active filters as removable chips above results. |
| **Cart line** | Image, name, variant, unit price with "Bulk price applied (10+)", stepper, line total, remove; inline issue banner ("Only 6 in stock. Set to 6"). |
| **Order summary** | Subtotal, delivery (area name), total in large Barlow numbers; free-delivery measured bar. |
| **Payment method card** | Radio cards: "Cash on delivery — pay the rider when your order arrives" / "Bank transfer — transfer and upload your receipt". Selected: 2 px ink border. Disabled COD shows the reason. |
| **Bank details block** | Bank name, account title, account number and IBAN each with a copy button. |
| **Order status timeline** | Steps: Placed → Confirmed → On the way → Delivered, with date/time under completed steps; cancelled/returned shown as a danger end state. |
| **Receipt uploader** | Drag and drop on desktop, "Take photo or choose file" on mobile; shows file, status (pending / approved / rejected with reason). |
| **Sticky bottom bar (mobile)** | Product: price × qty + "Add to cart". Cart: total + "Checkout". Sits above the system navigation; shadow on top edge. |
| **WhatsApp button** | Round, bottom-right, sits above sticky bars; label on desktop "Chat on WhatsApp". |
| **Toast** | Bottom-center on mobile, bottom-right on desktop; success/error; action link ("View cart"). |
| **Empty states** | Short line saying what to do and one action ("Your cart is empty. Browse cement, wires and pipes." + "Browse categories"). |
| **Skeletons** | Grey blocks matching final layout for cards, product page, tables. |
| **Admin data table** | Sticky header, 14 px text, row hover `concrete-50`, sortable column headers, filter bar above, pagination below ("1–20 of 356"), row actions menu. |
| **Admin side sheet / dialog** | Sheet from the right for create/edit (width 560); confirm dialogs name the item ("Cancel order ARC-2026-000123?"). |
| **Permission checkbox group** | See §8.6. |

### 6.1 Status badge colours

| Order status | Style |
|---|---|
| New | blueprint-50 bg, blueprint text |
| Confirmed | white bg, ink border and text |
| On the way (DISPATCHED) | amber-100 bg, ink text |
| Delivered | success-50 bg, success-700 text |
| Cancelled / Returned | danger-50 bg, danger-700 text |

| Payment status | Style |
|---|---|
| Pending | concrete-50 bg, ink-700 text |
| Awaiting verification | amber-100 bg, ink text |
| Paid | success-50 bg, success-700 text |
| Rejected | danger-50 bg, danger-700 text |
| Refunded | white bg, cement border |

### 6.2 Product card anatomy

```
┌───────────────────────┐
│                       │
│     [product image]   │  1:1, white, 12 px padding
│                       │
├───────────────────────┤
│ Lucky Cement          │  brand — 14 px cement
│ PPC Cement 50 kg bag  │  name — 16 px ink, max 2 lines
│ Rs 1,450 / bag        │  price — Barlow 20 px
│ Rs 1,500   Save 3%    │  MRP struck + success badge (only if MRP > price)
│ Bulk from Rs 1,395    │  blueprint 14 px, small ladder icon
│ [      Add to cart   ]│  amber, full width (mobile: icon + "Add")
└───────────────────────┘
```

Out of stock: image at 60% opacity, "Out of stock" badge, disabled button. Several variants: price shows "From Rs …" and the button reads "Choose options".

### 6.3 Price block and bulk price ladder (signature component)

```
Rs 1,430 / bag                      ← Barlow 34 px, the price for the chosen qty
Rs 1,500  Save Rs 70 per bag        ← MRP struck, success text

Price for your quantity
1 ──┼──── 10 ──┼──── 50 ──┼──── 100+      ← dimension-line scale, marker ▲ at qty 12
       ▲
┌──────────────────┬─────────────┐
│ 1–9 bags         │ Rs 1,450    │
│▌10–49 bags       │ Rs 1,430    │  ← active: amber-100 bg, 4 px amber left edge, 600 weight
│ 50–99 bags       │ Rs 1,410    │
│ 100+ bags        │ Rs 1,395    │
└──────────────────┴─────────────┘
Add 38 more bags to pay Rs 1,410 each      ← blueprint, tappable: sets qty to 50

Quantity  [ − ]  12  [ + ]  bags
Total     Rs 17,160                         ← Barlow 22 px
[            Add to cart            ]       ← amber, 48 px
```

- When quantity changes, the highlight moves to the matching row (150 ms) and totals update instantly.
- No tiers: the ladder is replaced by a single line "Same price for any quantity".
- Cart version (compact): one line under the unit price, "Bulk price applied (10+). Add 38 more to pay Rs 1,410 each."

---

## 7. Sample content (use this, not lorem ipsum)

All prices are **sample values** for design only.

| Product | Variant | MRP | Price | Bulk tiers |
|---|---|---|---|---|
| Lucky Cement PPC | 50 kg bag | Rs 1,500 | Rs 1,450 | 10+ Rs 1,430 · 50+ Rs 1,410 · 100+ Rs 1,395 |
| Maple Leaf OPC Cement | 50 kg bag | Rs 1,520 | Rs 1,470 | 10+ Rs 1,450 · 50+ Rs 1,430 |
| Pakistan Cables single-core wire 3/29 | 90 m coil | Rs 9,800 | Rs 9,350 | 5+ Rs 9,150 · 10+ Rs 8,990 |
| Fast Cables single-core wire 7/29 | 90 m coil | Rs 15,900 | Rs 15,200 | 5+ Rs 14,900 |
| Clipsal 1-gang switch | White | Rs 320 | Rs 285 | 20+ Rs 270 · 100+ Rs 255 |
| Schneider MCB single pole | 16 A | Rs 1,150 | Rs 990 | 10+ Rs 950 |
| Dadex PPRC pipe | 1 in, 4 m | Rs 1,350 | Rs 1,240 | 20+ Rs 1,200 |
| Dulux Weathershield emulsion | Gallon (3.6 L) | Rs 7,900 | Rs 7,450 | 5+ Rs 7,300 |
| Master Tiles floor tile | 60×60 cm, box of 4 | Rs 4,600 | Rs 4,300 | 20+ Rs 4,150 |
| Sika waterproofing coating | 20 kg | Rs 9,200 | Rs 8,650 | 5+ Rs 8,450 |

Brands strip: Lucky Cement, Maple Leaf, DG Cement, Pakistan Cables, Fast Cables, Schneider, Clipsal, Dadex, Dulux, Berger, Master Tiles, Sika.

People and places: customer **Imran Qureshi**, company **Qureshi Builders**, phone `0300 1234567`; address "House 12, Block 13-D, Gulshan-e-Iqbal, Karachi". Delivery areas: Gulshan-e-Iqbal (Rs 500, free above Rs 50,000), DHA (Rs 700), Clifton (Rs 700), PECHS (Rs 500), North Nazimabad (Rs 600), Gulistan-e-Jauhar (Rs 500), Bahria Town Karachi (not delivering yet). Order numbers like `ARC-2026-000123`. Riders: Asif Khan, Rashid Ali. Staff: Sana Malik (Order Manager), Faraz Ahmed (Catalog Manager).

Home hero copy: headline "Cement, wiring and pipes, delivered to your site." Supporting line: "Genuine brands at bulk prices across Karachi. Pay cash on delivery or by bank transfer." Buttons: "Shop cement" and "Browse all categories".

Trust points (a simple row with icons, not cards): "Genuine brands only", "Bulk prices on every product", "Cash on delivery", "By Aricon Engineering, since 2005".

---

## 8. Screens

Design every storefront screen at **390 px (mobile)** and **1440 px (desktop)**. Admin screens at **1440 px**, with a quick check at 1024 px.

The sketches below are layout guides only. Symbols like ☰ 🔍 🛒 📍 stand for Lucide icons — never use emoji in the design — and separators drawn as "·" in a sketch should become proper spacing or two lines.

### 8.1 Header and footer

**Mobile header**

```
┌──────────────────────────────────────┐
│ ☰  ARICON Shop            👤   🛒 3 │   ink background, white icons
├──────────────────────────────────────┤
│ 🔍 Search cement, wires, pipes...    │   white field, 48 px
├──────────────────────────────────────┤
│ 📍 Delivering to Gulshan-e-Iqbal ▾   │   small, concrete background
└──────────────────────────────────────┘
```

**Desktop header:** one ink bar — logo, "All categories" button, wide search, area selector, account, cart with count. Below it a thin white bar with department links (Civil, Electrical, Plumbing & sanitary, Hardware & tools) and phone/WhatsApp on the right.

**Footer (ink background):** logo and one line "Aricon Shop is run by Aricon Engineering Consultants, Karachi."; columns: Shop (departments), Help (FAQ, delivery policy, refund policy, contact), Company (about, terms, privacy); contact block (phone, WhatsApp, email, address); payment methods: Cash on delivery, Bank transfer.

### 8.2 Home

Mobile, top to bottom:

```
[ Header ]
┌──────────────────────────────────────┐
│  Hero banner (photo, ink overlay)    │
│  Cement, wiring and pipes,           │
│  delivered to your site.             │
│  [ Shop cement ]                     │
└──────────────────────────────────────┘
 ✓ Genuine brands   ✓ Bulk prices   ✓ Cash on delivery     (scrolls sideways)

Shop by category
┌────────┐┌────────┐
│ [icon] ││ [icon] │   2 columns, white tiles with line icons,
│ Cement ││ Wires  │   name + "86 products"
└────────┘└────────┘
 ... 6 tiles, then "All categories"

Deals                                       See all
[card][card][card] →   horizontal scroll, 2.2 cards visible

Featured for your site                       See all
[card][card][card] →

New arrivals                                See all
[card][card][card] →

Brands we stock
[logo][logo][logo][logo]  (greyscale, colour on hover)

┌──────────────────────────────────────┐
│ Ordering for a whole project?        │   ink panel, amber button
│ Send us your list on WhatsApp and    │
│ we'll prepare a quote.               │
│ [ Chat on WhatsApp ]                 │
└──────────────────────────────────────┘
[ Footer ]
```

Desktop: hero full width (1600 × 500) with text on the left third; trust row under it; category tiles in 6 columns; product rows as 5-column grids; brands in one row.

### 8.3 Category page

Desktop:

```
Home / Civil / Cement & plaster
Cement & plaster                                    128 products
[OPC] [PPC] [Plaster] [White cement]   ← sub-type chips

┌─ Filters ─────────┐  Sort: [Relevance ▾]   Active: [Lucky ✕] [50 kg ✕]
│ Brand             │  ┌────┐┌────┐┌────┐┌────┐
│ ☑ Lucky (12)      │  │card││card││card││card│
│ ☐ Maple Leaf (9)  │  └────┘└────┘└────┘└────┘
│ Type              │  ┌────┐┌────┐┌────┐┌────┐
│ Pack size         │  │card││card││card││card│
│ Price  [min][max] │  └────┘└────┘└────┘└────┘
│ ☐ In stock only   │        ‹ 1 2 3 … 7 ›
└───────────────────┘
```

Mobile: title and count, sub-type chips (scroll sideways), a row with "Filters (2)" and "Sort" buttons, 2-column grid, "Load more" button. Empty result: "No products match these filters." + "Clear filters".

### 8.4 Search

Suggestions dropdown (§6) while typing; results page like the category page with "Results for 'wire 7/29'" and a category facet.

### 8.5 Product page

Mobile:

```
‹ Back                          ⤴ share
[ image gallery, swipe, dots ]
Lucky Cement
PPC Cement, 50 kg bag
● In stock

Pack size  [50 kg]  [40 kg]
[ Price block + bulk price ladder (§6.3) ]

🚚 Delivery to Gulshan-e-Iqbal: Rs 500
   Free on orders over Rs 50,000
💵 Cash on delivery available

Specifications
┌─────────────────┬──────────────┐
│ Type            │ PPC          │
│ Weight          │ 50 kg        │
│ Standard        │ PS 3-2016    │
└─────────────────┴──────────────┘
Description (expandable)
Customers also buy  [card][card] →

┌──────────────────────────────────────┐
│ Rs 17,160 · 12 bags  [ Add to cart ] │  sticky bar
└──────────────────────────────────────┘
```

(The dot in the sticky bar is a visual separator for this sketch; design it as two stacked lines if clearer.)

Desktop: two columns — gallery with thumbnails on the left (7/12), purchase panel on the right (5/12, sticky while scrolling) containing brand, name, stock, variant chips, price block with ladder, stepper, total, "Add to cart", delivery info. Specifications and description below in full width; related products row at the end.

### 8.6 Cart

```
Your cart (3 items)
┌──────────────────────────────────────┐
│ [img] Lucky Cement PPC, 50 kg bag     │
│       Rs 1,430 / bag                  │
│       Bulk price applied (10+).       │
│       Add 38 more to pay Rs 1,410.    │
│       [ − ] 12 [ + ]      Rs 17,160 🗑 │
├──────────────────────────────────────┤
│ [img] Pakistan Cables wire 3/29 ...   │
│   ⚠ Only 6 in stock.  [ Set to 6 ]    │
└──────────────────────────────────────┘
Delivery to Gulshan-e-Iqbal   change
Add Rs 12,340 more for free delivery
|──┼──┼──┼──┼──██████████──|  ← measured bar
Subtotal                 Rs 37,660
Delivery                 Rs 500
Total                    Rs 38,160
[ Checkout ]   (sticky on mobile)
```

Desktop: lines on the left (8/12), summary panel on the right (4/12).

### 8.7 Checkout

Single page, numbered sections (these are real steps):

1. **Delivery address** — saved address cards (radio) + "Add new address" (form inline: contact name, phone, address line, landmark, area dropdown with unserviceable areas disabled).
2. **Payment** — the two payment method cards (§6); bank transfer expands to show bank details with copy buttons and "You can upload the receipt after placing the order."
3. **Review** — items (collapsed list with count), note field, subtotal/delivery/total.

"Place order" (amber, full width on mobile). States to design: placing (spinner, button disabled), price changed banner ("Prices changed since you added these items. Review the new total."), out of stock banner, COD not available above the limit.

### 8.8 Order placed

Big success mark (not confetti), "Order placed", order number `ARC-2026-000123`, what happens next (for COD: "We'll confirm your order and call before delivery." For bank transfer: bank details + "Upload receipt" uploader). Buttons: "View order", "Continue shopping"; WhatsApp support link.

### 8.9 Login and signup

Simple centered form on concrete background with the Aricon Shop logo; login: "Email or phone", "Password", "Log in", links to signup and forgot password. Signup: name, email, phone, password (with rule hint), company (optional). Inline errors ("This phone number already has an account. Log in instead.").

### 8.10 Account

- **Overview:** "Salam, Imran" (friendly local greeting), last 3 orders as rows with status badges, shortcuts (Orders, Addresses, Profile).
- **Orders list:** rows with order number, date, items, total, payment badge, status badge.
- **Order detail:** status timeline (§6), items, address, totals, payment block (bank transfer: receipts list + uploader; rejected receipt shows the reason and "Upload a new receipt"), actions: "Download invoice", "Reorder", "Cancel order" (only when new), WhatsApp support.
- **Addresses:** cards with default badge, edit, delete, "Set as default".
- **Profile:** fields + change password section.

Mobile: tabs at the top (Overview, Orders, Addresses, Profile). Desktop: left navigation.

### 8.11 Info pages and 404

Readable article layout (max 72 characters per line) for About, FAQ (accordion), policies. 404: "We couldn't find that page." with search field and category tiles.

---

## 9. Admin panel screens

Admin look: `ink` sidebar (white text, amber marker on the active item), `concrete` page background, white panels with borders, dense 14 px tables. Top bar: page title, global search (orders by number/phone), user menu with role.

### 9.1 Login and forced password change

Centered card on ink background: logo, "Staff login", email, password. Forced change: "Set a new password to continue."

### 9.2 Dashboard

Row of figures: Today's orders, Today's revenue, Last 7 days revenue (with a small line chart), Receipts to verify, Cash to collect. Below: "Orders by status" (clickable counts), "Low stock" table (product, variant, stock, threshold). Widgets the user has no permission for are simply absent — design a version for Admin and a reduced version for an Order Manager.

### 9.3 Orders list and order detail

List: status tabs with counts (New 12, Confirmed 8, On the way 5, Delivered, Cancelled & returned, All); filter bar (payment status, method, date range, area, rider, search); table columns: order, date, customer, phone, area, total, payment, status, rider.

Detail (desktop):

```
ARC-2026-000123   [New]  [Awaiting verification]     [ Confirm order ] [ Cancel order ]
Placed 26 Sep 2026, 4:05 pm

┌ Customer ───────────────┐ ┌ Payment ──────────────────────────────┐
│ Imran Qureshi           │ │ Bank transfer · Rs 38,160              │
│ 0300 1234567  📞  WhatsApp│ │ Receipt 1 (image preview)  pending     │
│ House 12, Block 13-D,   │ │ [ Approve ]  [ Reject… ]               │
│ Gulshan-e-Iqbal         │ └────────────────────────────────────────┘
└─────────────────────────┘ ┌ Delivery ─────────────────────────────┐
                            │ Rider [ Select rider ▾ ]               │
┌ Items ──────────────────────────────────────────────┐
│ SKU     Item                 Qty  Unit     Tier  Total│
│ LC-PPC50 Lucky PPC 50 kg     12   1,430    10+  17,160│
│ ...                                                   │
│                          Subtotal 37,660  Delivery 500│
│                          Total 38,160                 │
└──────────────────────────────────────────────────────┘
┌ Timeline ────────────┐ ┌ Internal note ───────────────┐
│ 26 Sep 4:05 pm Placed│ │ (text area)                   │
└──────────────────────┘ └───────────────────────────────┘
```

Show how buttons change by state and permission (e.g. Order Manager sees "Confirm order" but not "Cancel order").

### 9.4 Products

List with thumbnails, price range, stock with low-stock badge, status. Product form as a long page with a sticky section nav (Basics, Images, Variants, Specifications, Description, SEO) and a sticky "Save changes" bar. The **variants editor** is a table; each row expands to a bulk-tier editor (min qty / price rows with inline validation: "Each tier must be cheaper than the one before"). Design the locked state: price fields read-only with a lock icon and tooltip "You don't have permission to change prices."

Import page: steps "Download template → Upload file → Review results"; progress bar; results summary (created, updated, failed) and an errors table.

### 9.5 Users (staff permissions)

Tabs: "Staff & admins", "Customers".

Staff edit side sheet:

```
Edit staff member                                   ✕
Name        [ Sana Malik              ]
Email       sana@aricon.com.pk (can't be changed)
Phone       [ 0321 7654321            ]
Role        (•) Staff   ( ) Admin
Status      [ Active ▾ ]

Permissions                      9 selected
Start from a preset  [ Order Manager ▾ ]

┌ Orders ───────────────────── [■] Select all ┐
│ ☑ View orders and invoices                  │
│ ☑ Confirm, dispatch and deliver orders      │
│ ☐ Cancel and return orders      Sensitive   │
│ ☑ Assign riders                             │
│ ☑ Mark cash on delivery collected           │
│ ☑ Approve or reject bank receipts           │
│ ☐ Export orders to Excel                    │
└─────────────────────────────────────────────┘
┌ Products ─────────────────── [ ] Select all ┐
│ ☐ View products                             │
│ ☐ Change prices and bulk tiers  Sensitive   │
│ ...                                         │
└─────────────────────────────────────────────┘
 ... Dashboard, Catalog, Customers, Delivery, Content, Reports, Stock

                       [ Cancel ]  [ Save changes ]
```

Also design: the one-time temporary password dialog (password in large, clear text with a copy button and "Share this securely. They must change it at first login."), the Admin role state ("Admins have full access, including staff and settings."), and guard-rail messages ("You can't remove the last admin.").

### 9.6 Other admin screens

- **Customers tab:** table + customer detail (profile, addresses, orders, Block/Unblock).
- **Delivery areas:** inline-editable table with a serviceable toggle.
- **Homepage:** banner list with image previews and drag handles; product pickers for featured and deals.
- **Reports:** date range presets, revenue chart (amber line on white, ink axis labels), top products table, COD report, export buttons.
- **Settings:** grouped form sections with a sticky save bar; bank accounts as a repeatable group.
- **Audit log:** table with expandable rows showing before/after values.
- **Access denied:** "You don't have access to this page. Ask an admin for permission."

---

## 10. Accessibility and quality floor

- WCAG 2.2 AA contrast for all text; never rely on colour alone (status badges have text, errors have icons + text).
- Every input has a visible label; errors say what went wrong and how to fix it.
- Keyboard: logical focus order, visible focus ring, dialogs trap focus and close with Esc.
- Touch: 44 px minimum targets, 8 px minimum gap between tappable items.
- Sunlight: body text never lighter than `cement` on white; prices and totals in `ink`.
- Performance: no heavy background images below the hero; product images lazy-load; skeletons instead of spinners for page content.
- Content: realistic lengths (long product names wrap to 2 lines and truncate), large numbers (Rs 1,250,000) fit in cards and tables.

---

## 11. What to deliver from Claude Design (in this order)

1. **Design system page:** colour tokens with names, type scale, spacing, radius, icons (UI + the technical-line category icons), buttons, inputs, stepper, chips, badges (all order/payment statuses), product card, price block with bulk ladder (all states), cart line, payment cards, timeline, toasts, empty states, admin table, side sheet, permission checkbox group.
2. **Product page** — mobile and desktop (the signature screen; get this right first).
3. **Home** — mobile and desktop.
4. **Category page** with filters — mobile (incl. filter sheet) and desktop.
5. **Cart** and **Checkout** (incl. price-changed and COD-limit states) and **Order placed** — mobile and desktop.
6. **Login / Signup** and **Account** (overview, order detail with receipt upload, addresses) — mobile.
7. **Admin:** dashboard (admin and order-manager versions), orders list, order detail, product form with variants and tier editor (incl. locked price state), users with the staff permission sheet and temporary password dialog.
8. Remaining admin screens (§9.6).

Keep token and component names exactly as in this file so the design can be handed to Claude Code (`SPEC.md` §15 uses the same names).

---

## 12. Prompts for Claude Design

Use them in order, one per message, after pasting this file.

**Prompt 1 — Design system**

```
Using the Aricon Shop design brief above, create the design system page first: all colour tokens (with names and hex), the type scale with both fonts (Barlow Semi Condensed and Noto Sans), spacing and radius, the technical-drawing line icons for categories, and every component in §6 with its states. Give special attention to the price block with the bulk price ladder (§6.3), including the dimension-line quantity scale and the moving highlight. Follow the "Avoid" list in §4.7 strictly.
```

**Prompt 2 — Product page**

```
Design the product page (§8.5) for "Lucky Cement PPC, 50 kg bag" using the sample data in §7, at 390 px and 1440 px. Show quantity 12 with the 10–49 tier highlighted. Include the mobile sticky bar, delivery info for Gulshan-e-Iqbal, specifications and related products. Also show the out-of-stock state and a product without bulk tiers.
```

**Prompt 3 — Home**

```
Design the home page (§8.2) at 390 px and 1440 px with the header and footer (§8.1), using the hero copy and trust points from §7 and category tiles with the technical line icons. Product rows use the sample products from §7.
```

**Prompt 4 — Category and search**

```
Design the "Cement & plaster" category page (§8.3) at 1440 px with the filter column, and at 390 px with the filter sheet open and closed. Include active filter chips, sorting, pagination and the empty result state. Then design the search suggestions dropdown (§6) for the query "wire".
```

**Prompt 5 — Cart, checkout, order placed**

```
Design the cart (§8.6), checkout (§8.7) and order placed (§8.8) screens at 390 px and 1440 px. Cart has 3 items (cement ×12 with bulk price applied, wire with an "only 6 in stock" issue, switches ×20) and shows the free-delivery measured bar. Checkout shows both payment methods with bank transfer selected and bank details. Also design the "prices changed" and "COD not available above Rs 200,000" states.
```

**Prompt 6 — Auth and account**

```
Design login, signup and the account screens (§8.9, §8.10) at 390 px: overview, orders list, order detail for a bank-transfer order whose first receipt was rejected (show the reason and the upload area), addresses and profile.
```

**Prompt 7 — Admin core**

```
Design the admin panel (§9) at 1440 px: dashboard for an Admin and the reduced version for an Order Manager, orders list with status tabs, and the order detail for ARC-2026-000123 (bank transfer, receipt awaiting verification) showing which buttons an Order Manager sees.
```

**Prompt 8 — Admin products and users**

```
Design the admin product form (§9.4) with the variants table and an expanded bulk-tier editor, including the locked state for a staff member without price permission, and the import page. Then design Users (§9.5): the staff table, the edit side sheet with the Order Manager preset applied and grouped permission checkboxes, the temporary password dialog, and the Admin role state.
```

**Prompt 9 — Remaining admin screens**

```
Design the remaining admin screens from §9.6: customers tab and customer detail, delivery areas, homepage manager, reports, settings, audit log and the access denied page.
```

**Review prompt (after each screen)**

```
Review this screen against the brief: the principles in §3, the "Avoid" list in §4.7, contrast and tap-target rules in §10, and the sample content in §7. List anything that looks generic or templated and fix it. Remove one decorative element that isn't needed.
```
