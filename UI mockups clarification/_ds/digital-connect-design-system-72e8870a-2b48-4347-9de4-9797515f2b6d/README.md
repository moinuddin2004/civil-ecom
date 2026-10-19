# Digital Connect Design System

The design system for **Digital Connect (DC)** — a multi-channel customer
communication platform by **Eocean**. Digital Connect unifies WhatsApp
Business, Messenger, Instagram and web-chat conversations into a single
agent inbox, with bot automation, template campaigns, analytics, and
WhatsApp calling on top.

## Sources

This system was assembled by reading the production Next.js 15 frontend
(code name `dc-frontend`, npm package `dc-frontend`) and its public
assets.

| Source | Where |
|---|---|
| Codebase | Mounted folder `whatsApp-call-Gitlab/` (Next.js App Router, Tailwind + shadcn/ui) |
| Live QA | `https://qa.digiconn.co/portal` (legacy Portal) and `https://qa.digiconn.co/api` (services) |
| Design token source | `whatsApp-call-Gitlab/app/globals.css` (`.dc` and default themes) |
| Type scale | `whatsApp-call-Gitlab/tailwind.config.ts` |
| Fonts | Nunito + Geist Mono via `next/font/google` (`app/layout.tsx`) |
| Brand assets | `whatsApp-call-Gitlab/public/logos/` |
| Lottie animations | `whatsApp-call-Gitlab/public/lottieFiles/` (404, workflow) |
| Component library | `whatsApp-call-Gitlab/components/ui/` — shadcn "new-york" style, `neutral` baseColor, lucide icons |
| Copy / microtext | `whatsApp-call-Gitlab/locales/{en,ar,fr}.json` |

## Product surfaces

Digital Connect is a single SPA with an authenticated sidebar shell and
the following top-level features (from `components/layouts/sidebar/
config.tsx` + i18n labels):

- **Insights** — analytics dashboards (Recharts + Nivo heatmaps): overview,
  agent performance, bot dashboard, CSAT, voice-of-customer, pricing.
- **Conversations** — real-time agent inbox (Socket.IO). Sub-tabs: Inbox,
  Bot, Logs. Includes WhatsApp voice-call accept/reject, private notes,
  mentions, forwarding, templates, emoji/media.
- **Template Manager** — message template library + template insights.
- **Campaign Manager** — broadcasts + automated campaigns (legacy Portal).
- **Contacts** — CRM with CSV import/export.
- **Bot Builder** — chatbot flow builder (legacy Portal).
- **Channels / Integrations** — WhatsApp, Messenger, Instagram, Webchat,
  plus external integrations.
- **User & Team Management**, **Billing**, **WhatsApp Manager** (business
  profile + message links + automations), **Agent Chats**, **What's
  New**, **Settings**.

Because some items link to the legacy Portal (`NEXT_PUBLIC_OLD_APP_URL`),
this design system focuses on the new Next.js surfaces.

## Content fundamentals

> How copy is written in Digital Connect.

**Tone.** Professional, supportive, task-focused. Slight customer-support
vibe — the product is aimed at B2B agents, supervisors and admins doing
customer service for their own end-users. Microcopy is direct and
imperative ("Select a conversation", "Search conversations…").

**Perspective.** Third-person or zero-person in UI labels ("Contacts",
"Users", "What's New"). Second person ("you", "your") for account
security and guidance ("Your account has been temporarily locked…",
"Please provide your username…"). First person is rare.

**Casing.** Title Case for all top-level navigation and page titles
("Template Manager", "WhatsApp Calling", "Voice of Customer", "Agent
Chats"). Sentence case inside forms and body copy. All-caps is reserved
for status pills rendered from enum values (`ALL`, `QUEUE`, `ACTIVE`,
`MENTIONED`, `EXPIRED`, `COMPLETED`, `SPAM`).

**Punctuation.** Question marks on FAQ prompts. Ellipses on loading
("Changing…", "Logging in…"). Placeholders use ellipses
("Search conversations…"). Sentences in modal/toast copy end with a
period.

**Emoji.** Product UI does **not** use emoji in labels or copy. The only
emoji touchpoint is the emoji-picker inside the composer
(`@emoji-mart/react`) which customers can insert into their own
messages. Do not introduce emoji into chrome, marketing surfaces, or
status text.

**Brand naming.** Product full name is **Digital Connect**; the short
form **DC** is used in the logo and sometimes as a favicon but should
never replace the full name in body copy. The parent company is
**Eocean** / "EOcean Private Limited" (used in the auth footer ©
line).

**Copy examples (verbatim from the codebase):**

- Auth: _"Sign in to your account"_, _"Forgot your password?"_, _"©
  EOcean Private Limited."_, _"Privacy policy | Terms of Service"_.
- Empty state: _"Select a conversation"_ · _"Choose a conversation from
  the list to start messaging"_.
- Hidden data: _"Hidden Conversation"_ · _"You are not authorized to
  view this conversation"_.
- Security copy: _"Your account has been temporarily locked due to
  multiple failed login attempts or a security concern."_
- Agent status toggle: _"Available"_ / _"Away"_.
- Lists: _"No conversations found"_ / _"Try adjusting your search
  terms"_ / _"No more conversations"_.
- Template library nav: _"Overview"_, _"Create Template"_, _"Explore
  Templates"_.

## Visual foundations

> The visual DNA of Digital Connect — what every screen has in common.

**Overall mood.** Clean, enterprise SaaS. Light, high-signal UI with
generous neutral surface and one cool accent color per surface. The
product runs in light theme by default (`defaultTheme="light"` in
`ThemeProvider`) with a dark variant available.

**Color.** Two palettes cohabit:

- The **live product** defaults to a bright blue primary
  `hsl(214 92% 55.9%)` ≈ `#2B79F3`, with `#E6F3FF` as a selected-row /
  unread-badge background and `#2781F6` as the interactive blue used
  throughout (selection bars, unread chip, "Make Call" highlight).
- The **brand** (`.dc` class scope) uses deep indigo primary
  `hsl(236 37.6% 33.9%)` ≈ `#363C82`, with a pale teal-cyan accent
  `hsl(198 30% 90%)`. The DC logo is indigo + teal (`#2DC6C0` nodes).

Role badges borrow from Tailwind's safelist (pink/purple/indigo/
cyan/teal/green/lime/yellow/orange/red/rose/violet/fuchsia/emerald,
all `*-100`/`*-800` pairs — see `tailwind.config.ts`). Status pills use
`bg-[color]-50`/`bg-[color]-100` with matching `text-[color]-700/800`.

**Typography.** `Nunito` (Google Fonts) as the sans workhorse, loaded
with weights 200 → 1000. `Geist Mono` for code/IDs. The scale in
tailwind runs `xxs: 10` → `9xl: 128` with quirky non-4pt mid steps
(`xs: 13`, `sm: 14`, `base: 16`, `md: 18`). Headings are
`font-extrabold`/`font-semibold`, body copy is 13–14 px — the UI is
dense.

**Background.** Plain white surfaces. No hand-drawn illustrations, no
gradients, no repeating patterns, no grain. The only textures are:
Lottie animations on empty/error states (workflow, 404), and solid
color panels (`bg-gray-50`, `bg-[#E6F3FF]`). Marketing / auth pages
center a card over a flat page.

**Imagery.** Almost none. The product uses photographic avatars where
available, falling back to auto-colored initials
(`utils/color.ts::getAvatarColors`). No stock hero imagery ships with
the app.

**Corner radii.** Unified around `--radius: 0.5rem` (8 px) with shadcn
doing the usual `lg = var(--radius)`, `md = calc(var(--radius) − 2px)`,
`sm = calc(var(--radius) − 4px)`. Pills use `rounded-full`, panels use
`rounded-xl` (tab container `bg-gray-50 rounded-xl`), input surfaces
use `rounded-md`/`rounded-lg`.

**Shadows.** Subtle. shadcn-level `shadow-sm` / `shadow` only. Cards
carry at most a `shadow-xs` hairline. Dropdown menus and popovers use
`shadow-lg`. There is no inner shadow system, no "glassmorphism" blur,
no backdrop-filter.

**Borders.** Borders are 1px, `hsl(var(--border))` which resolves to a
low-saturation near-white-blue (`214 30% 82%`). Dividers between list
rows use `border-b border-gray-100`. The "this row is selected" signal
is a **2px left or right border in #2781F6** (`border-r-2
border-r-[#2781F6]` for active conversation, `border-l-2
border-l-[#2781F6]` for multi-select).

**Hover states.** Primary buttons: `hover:bg-primary/90`. Secondary /
ghost: `hover:bg-accent hover:text-accent-foreground`. List rows:
`hover:bg-gray-50`. Small controls embedded in toolbars
(`bg-gray-100 → hover:bg-gray-200`). There is no color-shift brand
pattern; everything uses opacity or a one-step darker gray.

**Press / active states.** `focus-visible:ring-1 ring-ring` on buttons
and inputs (1px, accent-colored). No shrink-on-press. Tab pills become
filled with `bg-primary/10` + `text-primary` + `border-primary/10`.

**Motion.** Modest. Tailwind's `transition-colors` on most hover
surfaces (~150 ms default). Accordion open/close uses custom keyframes
(`accordion-down/up 0.2s ease-out`) in `tailwind.config.ts`. Lottie
animations (`@lottiefiles/dotlottie-react`) are used for
illustration-in-motion on 404 and workflow empty states. Framer-motion
is available but used sparingly. No bouncy springs; the feel is
"ease-out, soft, fast".

**Transparency / blur.** Rare. One pattern uses `bg-white/90` as a
checkbox overlay on the avatar in multi-select mode. No backdrop-
filter blur anywhere.

**Layout.** App shell is a fixed sidebar (collapsible icon rail) + top
navbar + main area, with a `h-[calc(100vh-5.2rem)]` main region.
Inside features, `ResizablePanelGroup` (from `react-resizable-panels`)
splits list + detail (default 25 / 75). Tables use TanStack Table.
Drag-and-drop via @dnd-kit. Spacing is mostly Tailwind's `gap-2
/ gap-3 / gap-4` — tight.

**RTL.** Supported. `rtl-detect` switches the sidebar side and
direction based on locale (en / ar / fr). Arabic is RTL.

## Iconography

- **Library.** [`lucide-react`](https://lucide.dev) v0.533, set as the
  default via `components.json` (`"iconLibrary": "lucide"`). All menu
  icons, action icons (Phone, MessageSquare, Search, Plus, ArrowUp/
  Down, EyeOff, Loader2, X, Check, CheckCircle2, Clock…) come from
  Lucide. Stroke weight is default (2 px), size is `size-4` (16 px)
  inside buttons and `size-5`–`size-6` inline.
- **Unicode / emoji.** Not used in chrome or labels. Emoji can only be
  inserted by end-users through the `@emoji-mart` composer picker.
- **Custom SVGs.** Minimal. One custom `ConversationsIcon` wrapper in
  `components/icons/` and a standalone `public/logos/conversations.svg`.
  A handful of Next.js placeholder SVGs (`file.svg`, `globe.svg`,
  `window.svg`, `next.svg`, `vercel.svg`) ship unused.
- **Raster logos.** Channel brand marks (`whatsApp.png`,
  `instagram.png`, `messenger.png`, `instaLogo.png`) and product logos
  (`dcLogo.png`, `dcLogo1.png`, `collapsedLogo.png`, `eocean.png`,
  `eocean1.png`, `logo.png`) all live in `public/logos/`. All have
  been copied into this design system's `assets/logos/`.
- **Channel icon recipe.** On avatars, platform badges are rendered by
  `utils/PlatformIcons.tsx`. WhatsApp uses a green dot, Messenger
  blue, Instagram uses an orange→pink→purple gradient — all matching
  the official brand colors (see `--ch-*` CSS vars in
  `colors_and_type.css`).

## Files in this system

```
README.md                 ← you are here
SKILL.md                  ← portable skill entry (also works in Claude Code)
colors_and_type.css       ← all tokens as CSS vars + type classes
assets/
  logos/                  ← DC, Eocean, WhatsApp, Messenger, Instagram, etc.
  images/                 ← qr.png
preview/                  ← design-system preview cards (rendered in the
                            Design System tab)
ui_kits/
  digital_connect/        ← React (Babel-JSX) recreations of core DC
                            screens — inbox, login, insights, templates.
                            index.html is a clickable demo.
```

## Index

- **Tokens / CSS:** [`colors_and_type.css`](./colors_and_type.css)
- **Brand assets:** [`assets/logos/`](./assets/logos), [`assets/images/`](./assets/images)
- **UI kit (Digital Connect product):** [`ui_kits/digital_connect/`](./ui_kits/digital_connect/)
- **Skill entry:** [`SKILL.md`](./SKILL.md)

## Caveats

- **Fonts are loaded from Google Fonts** (Nunito + Geist Mono). The
  production app uses `next/font/google` which self-hosts at build
  time; our system uses the public CDN for portability. Local
  `fonts/` directory is intentionally empty — replace with `.woff2`
  files if you need fully offline typography.
- **No official marketing site** was available to mine for a landing /
  hero system; the UI kit covers the product surfaces only.
- **Channel icons** are the real raster logos from the codebase. If you
  need vector versions, commission or re-trace them — re-drawing them
  by hand is out of scope here.
