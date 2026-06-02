# REI – Real Estate Intel Mobile App

## What This App Does

REI is the **mobile companion** to the Real Estate Intel web platform. It is a portfolio management app for real estate investors. Core loop: log in → pick a workspace → see dashboard → drill into properties → track rent → get AI alerts → chat with Claude.

The **web app** (`/Users/kocharpratik11/REIP/real-estate-intel`) is the full-featured platform (Next.js + Tailwind, dark theme). This **mobile app** is a focused, field-friendly companion (React Native + Expo, light theme).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.4 + Expo ~54 |
| Routing | Expo Router ~6 (file-based) |
| Language | TypeScript 5.3 (strict mode) |
| Backend / Auth | Supabase (PostgreSQL + Auth) — shared with web |
| Secure Storage | expo-secure-store (JWT chunking at 1800 bytes; iOS Keychain limit is 2048 bytes) |
| Animations | React Native Reanimated ~4.1 |
| Gestures | React Native Gesture Handler ~2.28 |
| Bottom Sheets | @gorhom/bottom-sheet ~5.1 |
| AI Chat | Anthropic Claude API (`claude-haiku-4-5-20251001`) |
| Styling | React Native `StyleSheet` — no Tailwind, no styled-components |
| Icons | `@expo/vector-icons` + emoji-based icons in some places |

---

## Project Structure

```
app/                        # Expo Router file-based routes
  _layout.tsx               # Root layout (GestureHandler, StatusBar)
  (auth)/
    _layout.tsx
    login.tsx               # Email/password login
  (app)/                    # Tab-based main app
    _layout.tsx             # Tab navigator (Home, Portfolio, Alerts, More)
    index.tsx               # Home/Dashboard
    alerts.tsx              # Intelligence/Alerts screen
    more.tsx                # Settings screen
    portfolio/
      _layout.tsx
      index.tsx             # Portfolio list
      [id]/
        index.tsx           # Property detail (tabs: Units, Rent, Expenses, Docs)
        rent.tsx            # Rent ledger with month navigation
        unit/[unitId]/
          index.tsx         # Unit/Tenant detail
  workspace-picker.tsx      # Workspace selection modal
  chat.tsx                  # AI chat modal (FAB-triggered from any screen)

components/
  home/
    AIHeroCard.tsx          # Hero insights card with dot pagination
    QuickStats.tsx          # Portfolio KPI strip
    RecentActivity.tsx      # Last 3 rent payments
  portfolio/
    PropertyRow.tsx         # Property list item with health badge
  rent/
    LedgerRow.tsx           # Single ledger entry row
    RecordPaymentSheet.tsx  # Bottom sheet for recording a payment
  ui/
    Badge.tsx               # Status badge (paid, overdue, partial, vacant, etc.)
    Button.tsx              # Reusable button (primary, secondary, ghost, danger)
    Card.tsx                # Card wrapper with optional accent border

lib/
  supabase.ts               # Supabase client init + secure storage adapter
  api/
    properties.ts           # Property/portfolio queries & metrics
    rent.ts                 # Rent payment queries + buildLedger()
    alerts.ts               # Alert generation logic

hooks/
  useAuth.ts                # Auth session state
  useWorkspace.ts           # Workspace loading

types/
  index.ts                  # All TypeScript types/interfaces

constants/
  colors.ts                 # Full color palette
```

---

## Navigation Architecture

```
RootLayout
├── (auth) [Stack]
│   └── login
└── (app) [Tabs]
    ├── Home (index)
    ├── Portfolio
    │   └── [id] → rent → unit/[unitId]
    ├── Alerts (intelligence)
    └── More (settings)

Modals (slide from bottom):
  workspace-picker
  chat (FAB floating button on every screen)
```

**Auth flow:** App start → check session → no session → login → workspace-picker → (app) tabs.

---

## Database Schema (Supabase / PostgreSQL)

This is the **shared database** used by both web and mobile. Full schema is in the web app at `/Users/kocharpratik11/REIP/real-estate-intel/supabase/migrations/`.

### Core Tables & Key Columns

**workspaces**
- `id`, `name`, `created_by`, `created_at`

**workspace_members**
- `id`, `workspace_id`, `user_id`, `role` (enum: `'owner'` | `'operator'`), `created_at`
- Note: mobile app types say `'manager'` | `'viewer'` — these are wrong, correct values are `'owner'` | `'operator'`

**properties**
- `id`, `workspace_id`, `name`
- `address_line1`, `address_line2`, `city`, `state`, `zip`
- `property_type` (enum: `sfh`, `duplex`, `triplex`, `fourplex`, `multifamily`)
- `asset_class` (enum: `single_family`, `condo`, `townhouse`, `multifamily`, `commercial`, `mixed_use`, `land`)
- `unit_count`
- `property_usage` (enum: `long_term_rental`, `midterm_rental`, `short_term_rental`, `owner_occupied`, `vacant`, `development`)
- `purchase_price`, `purchase_date`, `closing_costs`, `down_payment`
- `current_market_value`, `value_source`, `value_updated_at`
- `annual_property_tax`, `monthly_hoa_fee`, `monthly_utilities_avg`
- `vacancy_rate`
- `total_equity`, `monthly_debt_service`, `annual_noi`, `roe_percentage` — **computed columns** via SQL trigger `calculate_property_metrics()`
- `completeness_score`

**units**
- `id`, `workspace_id`, `property_id`, `label`, `unit_type`, `beds`, `baths`

**tenants**
- `id`, `workspace_id`, `first_name`, `last_name`, `email`, `phone`, `notes`

**leases**
- `id`, `workspace_id`, `unit_id`, `status` (enum: `draft`, `active`, `ended`)
- `start_date`, `end_date`
- `monthly_rent`, `security_deposit`, `late_fee`, `pet_deposit`
- `lease_type`, `furnished`, `utilities_included`
- `pet_rent_monthly`, `parking_fee_monthly`, `storage_fee_monthly`, `other_income_monthly`
- `nightly_rate`, `avg_occupancy_rate`, `platform` (for STR/MTR)

**lease_tenants** (many-to-many join)
- `id`, `workspace_id`, `lease_id`, `tenant_id`, `tenant_role` (`'primary'` | `'co_tenant'`)

**rent_payments**
- `id`, `workspace_id`, `lease_id`, `property_id`, `unit_id`
- `period_year`, `period_month`, `due_date`, `paid_date`
- `amount_due`, `amount_paid`
- `status` (enum: `pending`, `partial`, `paid`, `late`, `waived`)
  - Note: mobile app uses `'overdue'` in some places — the correct DB value is `'late'`
- `charge_type` (enum: `rent`, `late_fee`, `security_deposit`, `pet_fee`, `other`)
- `charge_description`, `notes`

**financing_structures**
- `id`, `property_id`, `workspace_id`
- `loan_type`, `lender_name`, `loan_amount`, `current_balance`
- `interest_rate`, `loan_term_months`, `monthly_payment`
- `origination_date`, `maturity_date`
- `is_interest_only`, `down_payment`, `closing_costs`, `is_primary`

**property_valuations**
- `id`, `property_id`, `workspace_id`
- `valuation_date`, `estimated_value`, `assessment_value`, `tax_year`
- `source` (e.g., `appraisal`, `tax_assessment`, `comps`, `manual`)

**expenses**
- `id`, `property_id`, `workspace_id`
- `category` (enum: `advertising`, `repairs`, `utilities`, `taxes`, `insurance`, `depreciation`, etc.)
- `amount`, `description`, `expense_date`, `vendor`, `tax_year`, `notes`

**maintenance_events**
- `id`, `workspace_id`, `property_id`, `unit_id`, `vendor_id`
- `title`, `description`, `category`, `status`, `priority`
- `requested_date`, `scheduled_date`, `completed_date`
- `estimated_cost`, `actual_cost`

**documents**
- `id`, `workspace_id`, `property_id`, `unit_id`, `lease_id`
- `filename`, `storage_path`, `document_type`, `document_date`
- `archived`, `visibility`

**chat_conversations**
- `id`, `workspace_id`, `user_id`, `title`

**chat_messages**
- `id`, `conversation_id`, `role` (`user` | `assistant`), `content`

**vendors**
- `id`, `workspace_id`, `name`, `trade`, `region`, `phone`, `email`, `contact_name`

### RLS Summary
- Owners: full CRUD on properties, leases, financing, documents
- Operators: read properties/leases/tenants, update rent payment status, view operational docs
- Financial docs/data: owner-only

---

## Data Models in Mobile App (types/index.ts)

Key corrections vs. the current mobile types:
- `Workspace.role` should be `'owner' | 'operator'` (not `'owner' | 'manager' | 'viewer'`)
- `RentPayment.status` DB value is `'late'` (not `'overdue'`)
- `Property.current_value` → actual column is `current_market_value`
- `PropertyMetrics.current_value`, `equity`, `roe` are NOT null — they come from computed columns `current_market_value`, `total_equity`, `roe_percentage` on the properties table

---

## API Layer (lib/api/)

### properties.ts
- `listProperties(workspaceId)` → Property[]
- `getProperty(id)` → Property with nested units
- `getPropertyMetrics(propertyId, year, month)` → PropertyMetrics
  - `current_value` → from `properties.current_market_value`
  - `equity` → from `properties.total_equity` (computed)
  - `roe` → from `properties.roe_percentage` (computed)
  - `monthly_debt_service` → from `properties.monthly_debt_service` (computed from financing_structures)
- `getPortfolioSummary(workspaceId, year, month)` → PortfolioSummary
  - `longest_vacancy_days` is currently hardcoded 0 — no `vacancy_start` tracking exists in DB yet

### rent.ts
- `getRentPayments(propertyId, year?)` → RentPayment[]
- `recordPayment(paymentId, amountPaid, paidDate, method, notes?)` → void
- `buildLedger(payments)` → LedgerEvent[] (chronological, running balance)
  - Charge entries: red accent, negative balance
  - Payment entries: green accent, reduces balance
  - Status uses DB values: `paid`, `late`, `partial`, `pending`, `waived`

### alerts.ts
- `generateAlerts(workspaceId, year, month)` → AppAlert[]
  - EMERGENCY: `status = 'late'` rent payments (note: query by `'late'` not `'overdue'`)
  - WARNING: leases where `end_date` within next 30 days

---

## Key Business Logic

### Financial Metrics (from web app)

**ROE (Return on Equity):**
```
roe_percentage = (annual_noi / acquisition_price) * 100
```
Note: this is NOI/purchase_price, not NOI/equity.

**NOI (Net Operating Income) — computed in DB:**
```
annual_income = SUM(monthly_rent + pet_rent + parking + storage + other) * 12
annual_expenses = property_tax + insurance + hoa*12 + utilities*12
noi = annual_income - annual_expenses - debt_service - (vacancy_rate% of value)
```

**DSCR thresholds:**
- > 1.25: healthy
- 1.0–1.25: warning
- < 1.0: critical

**Cap Rate:**
- > 8%: excellent
- 5–8%: good
- 3–5%: fair
- < 3%: low

### Mortgage Balance Formula (from web app):
```
B_n = P·(1+r)^n − PMT·[(1+r)^n − 1] / r
```
Where P = principal, r = monthly rate, n = months elapsed.

### Rent Auto-Generation (web app, `generate-lease-charges.ts`):
When a lease is created, the web app auto-inserts a `rent_payments` row for every month from start_date to end_date with `status='pending'`. The mobile app reads these pre-generated rows — it does NOT need to generate them.

---

## Styling System

**File:** `constants/colors.ts`
All screens use `StyleSheet.create()`. No Tailwind, no external CSS-in-JS.
Light theme (contrast to web app's dark theme).

### Approved Color Palette (updated — "Intelligence-forward")
Decision made in design session: move from generic blue (`#4F73FF`) to indigo (`#6366F1`) as primary brand color. Signals "intelligent technology" and differentiates from generic fintech/B2B SaaS apps. Background warmed slightly.

```
bg:        #FAFAF9   (warm near-white — replaces cold #F7F8FC)
card:      #FFFFFF
border:    #E8E8F0   (slight warm shift from #E5E8F2)
indigo:    #6366F1   (PRIMARY brand — replaces #4F73FF blue)
purple:    #7C3AED   (accent, AI/gradient use)
gradient:  #6366F1 → #7C3AED  (hero headers, briefing card, AI elements)
text:      #111827
textSub:   #374151
textMuted: #9CA3AF
green:     #059669   (paid/healthy — unchanged)
greenBg:   #ECFDF5
greenBd:   #A7F3D0
yellow:    #D97706   (warning/partial — unchanged)
yellowBg:  #FFFBEB
yellowBd:  #FDE68A
red:       #DC2626   (emergency/overdue — unchanged)
redBg:     #FEF2F2
redBd:     #FECACA
indigoBg:  #EEF2FF   (AI card backgrounds)
indigoBd:  #C7D2FE
```

Status colors (green/yellow/red) are universal financial language — never change these.

Spacing uses 8px base unit (8, 12, 16, 20, 24, 32).
Border radius: 8 (chips), 12–14 (cards), 16–18 (modals), 44 (phone shell).

---

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ANTHROPIC_API_KEY=    # Optional; enables AI chat
```

---

## Key Patterns & Conventions

1. **Screen data loading:** `useFocusEffect` + `useCallback` to reload on tab focus. Parallel queries with `Promise.all()`.

2. **No global state manager.** State is component-local with `useState`. Auth session via `useAuth()` hook. Active workspace stored in Supabase user metadata (`current_workspace_id`, `current_workspace_name`).

3. **Workspace context:** Retrieved from `supabase.auth.getUser()` → `user.user_metadata`. Deep-linked screens receive it via `useLocalSearchParams()`.

4. **Pull-to-refresh:** `RefreshControl` on `ScrollView` for all data-heavy screens.

5. **Navigation:** Use `router.push()`, `router.replace()`, `router.back()`. Modal routes use `presentation: 'modal'` in layout.

6. **Secure storage:** JWT tokens chunked at 1800 bytes each because iOS Keychain has a ~2048-byte limit per key.

7. **Alert routing:** Alerts carry `route` + `routeParams` for deep-linking from alerts screen to property/unit detail.

8. **Rent payments are pre-generated by web app.** Mobile only reads and updates existing rows, does not insert new charge rows (except via RecordPaymentSheet for recording actual payments against existing charges).

---

## What's Implemented vs. Placeholder

### Fully Working
- Login / logout / auth flow
- Workspace selection
- Home dashboard (stats, AI insights card, recent activity)
- Portfolio list with health indicators and sorting
- Property detail with Units tab
- Rent ledger (month navigation, filters, running balance)
- Record payment (bottom sheet)
- Unit/tenant detail with contact actions (call, email, text)
- Alerts (EMERGENCY + WARNING)
- AI chat (requires Anthropic key)

### Placeholder / Not Implemented
- Add new property (FAB in portfolio list taps through to nothing)
- Expenses tab (empty state only) — data exists in `expenses` table
- Docs tab (empty state only) — data exists in `documents` table
- Maintenance tab — data exists in `maintenance_events` table
- Edit profile
- Change password
- Notification preferences
- Currency & date format settings
- Help center, feedback, rate app
- Optimizer tab in alerts screen
- Scenarios tab in alerts screen (full scenarios engine exists in web app)
- Vendors screen — data exists in `vendors` table

### Known Type/Query Bugs
- `Workspace.role` type says `'manager'` | `'viewer'` — should be `'operator'`
- Some alert queries filter by `status = 'overdue'` — correct DB value is `'late'`
- `Property.current_value` — correct column is `current_market_value`
- `PropertyMetrics` returning null for equity/roe — should query `properties.total_equity` and `properties.roe_percentage`

---

## Common Commands

```bash
npm start           # Start Expo dev server
npm run ios         # Run on iOS simulator
npm run android     # Run on Android emulator
npm run lint        # ESLint
```

---

## Product Vision: Asset Brain

The app's core identity is **Asset Brain** — an intelligent portfolio advisor in your pocket, not a data entry tool. The UX philosophy:

- Mobile comes to **you** with what matters (proactive), not the other way around
- Every screen answers: "What do I need to know?" and "What should I do next?"
- Reduce cognitive load — surface insights, not raw data
- Target users: **both** DIY landlords (1–20 units, own portfolio) and property operators (manage on behalf of owners)

---

## Screen Inventory (All 15 Designed Screens)

Reference designs in `ui-preview.html` (open in browser to view all screens).

| # | Screen | Route / Location | Status |
|---|---|---|---|
| 1 | Login | `(auth)/login.tsx` | Needs redesign |
| 2 | Workspace Picker | `workspace-picker.tsx` | Needs redesign |
| 3 | Home / Daily Briefing | `(app)/index.tsx` | Needs rebuild |
| 4 | Portfolio List | `(app)/portfolio/index.tsx` | Needs redesign |
| 5 | Property Detail | `(app)/portfolio/[id]/index.tsx` | Needs redesign |
| 6 | Rent Ledger | `(app)/portfolio/[id]/rent.tsx` | Needs redesign |
| 7 | Unit / Tenant Detail | `(app)/portfolio/[id]/unit/[unitId]/index.tsx` | Needs redesign |
| 8 | Alerts / Intelligence | `(app)/alerts.tsx` | Needs redesign |
| 9 | AI Chat | `chat.tsx` | Needs redesign |
| 10 | More / Settings | `(app)/more.tsx` | Needs redesign |
| 11 | Expenses Tab | `(app)/portfolio/[id]/index.tsx` (tab) | New build |
| 12 | Documents Tab | `(app)/portfolio/[id]/index.tsx` (tab) | New build |
| 13 | Maintenance Tab | `(app)/portfolio/[id]/index.tsx` (tab) | New build |
| 14 | Record Payment Sheet | `components/rent/RecordPaymentSheet.tsx` | Needs redesign |
| 15 | Health Score Detail | New screen | New build |

---

## Intelligence Architecture

### The Core Problem at Scale
On-demand AI (call Claude every time a user opens the app) breaks at 1M users:
- 1M users × 2 opens/day = 2M Claude API calls/day
- Cost: ~$180,000/month just for briefing cards
- Latency: users wait for API response on every load

### Approved Architecture: Pre-Computed Intelligence

```
Nightly background job (pg_cron / Inngest)
  → Reads all workspace data in batch
  → Calls Claude once per workspace
  → Stores output in portfolio_insights table

User opens app
  → Single DB read (instant, zero AI cost per request)
```

**Cost at 1M users with this approach:** ~$25K/month (86% cheaper than on-demand)

### Event-Driven Recomputation (in addition to nightly)
When data changes (payment recorded, lease updated, maintenance ticket opened):
- Trigger recomputes insights for that workspace immediately
- User sees updated data without waiting for midnight job

### New DB Table Required: `portfolio_insights`

```sql
portfolio_insights (
  workspace_id      uuid,
  computed_at       timestamptz,
  -- Claude-generated narrative (populated by background job)
  briefing_daily    text,
  briefing_weekly   text,
  briefing_monthly  text,
  -- Structured data (rule-based computation)
  action_queue      jsonb,   -- sorted list of actions needed
  health_scores     jsonb,   -- per-property { score, breakdown }
  alerts            jsonb,   -- pre-computed alert list
  expires_at        timestamptz
)
```

**Mobile app always reads from this table — never computes insights client-side.**

---

## Intelligence Tiers (Roadmap)

### Tier 1 — Operational Intelligence ✅ Build now
What's happening with my portfolio right now?

Uses: internal DB data only. Rule-based detection + Claude-generated narrative.

Examples:
- "5 of 12 units haven't paid. Unit 2A has been late 4 of the last 6 months."
- "Your collection rate dropped 15% vs. last month."
- "Lease at Unit 2A expires in 23 days — renewal not started."
- "Plumbing costs are 3x higher than last year."

### Tier 2 — Portfolio Intelligence ✅ Build next (needs 6–12 months of clean data)
How are my properties performing relative to each other?

Uses: internal DB data + historical patterns across properties.

Examples:
- "Elm Street ROE is 22% lower than your Oakland properties."
- "Your 2020 acquisitions outperform 2022 ones by 40% on cash-on-cash."
- "Repair costs spike every Q4 — budget accordingly."
- "Unit 2A is responsible for 60% of your late payments across 2 years."

### Tier 3 — Market Intelligence 🔮 Future (needs external data APIs)
How are my properties performing relative to the market?

Requires external data integrations:

| Data needed | API | Approx cost |
|---|---|---|
| Rental market comps | Rentcast / Rentometer | ~$100–300/mo |
| Property AVM | ATTOM / Zillow | ~$200–500/mo |
| Interest rates | FRED API | Free |
| Local vacancy rates | CoStar / Census | $500+/mo or free |

Examples:
- "Your rent at Elm Street is $340 below market for a 2BR in SF."
- "A $200 rent increase at renewal adds $26,400 to your portfolio value."
- "Interest rates suggest refinancing Elm Street would improve DSCR by 0.3."

**Start Tier 3 integration with Rentcast first** — answers the most common investor question: "Is my rent too low?"

### Intelligence Capability Limits (honest assessment)
1. **Data quality:** Intelligence = quality of data entered. New users with little history get shallow insights.
2. **Context window:** 200K tokens. Starts getting tight at 80+ properties. At scale, summarize/aggregate before sending to Claude.
3. **No memory:** Claude is stateless between calls — it doesn't learn your portfolio over time.
4. **No real-time market data (Tier 1 & 2):** Can only compare you to yourself, not the market.
5. **Knowledge cutoff:** Claude's training data cuts off Aug 2025 — doesn't know current rates/conditions unless we inject them.

---

## Home Screen: Configurable Briefing Mode

User can switch between three briefing cadences (stored in user preferences):

| Mode | Label | Data window | Best for |
|---|---|---|---|
| Daily | "Today's Briefing" | What's overdue/due today | Active landlords |
| Weekly | "This Week" | 7-day rolling window | Regular check-ins |
| Monthly | "Monthly Summary" | Month-to-date performance | Passive investors |

Preference stored in: `user_preferences` table (new) or Supabase user metadata.
Default: Daily.

---

## Property Health Score

Each property gets a single 0–100 score. Shown on Property Detail screen and Portfolio List.

### Score Breakdown (total = 100 points)
| Category | Weight | How calculated |
|---|---|---|
| Collection Rate | 40 pts | % of rent collected this month |
| Occupancy | 20 pts | % of units occupied |
| Lease Health | 20 pts | No expiring leases = full points; deduct for each lease expiring <60 days |
| Maintenance | 20 pts | Deduct for open tickets by priority (urgent = -8, high = -4, normal = -2) |

### Health Labels
- 85–100: Excellent (green)
- 70–84: Good (green)
- 50–69: Needs Attention (yellow)
- 0–49: Critical (red)

Score is pre-computed and stored in `portfolio_insights.health_scores`.

---

## Build Roadmap

### Phase 0 — Fix Foundation (bugs, before anything else)
- [ ] Fix `Workspace.role` type: `'manager'|'viewer'` → `'owner'|'operator'`
- [ ] Fix `RentPayment.status` queries: `'overdue'` → `'late'`
- [ ] Fix property metrics queries: `current_value` → `current_market_value`
- [ ] Fix equity/ROE returning null: query `properties.total_equity` + `properties.roe_percentage`
- [ ] Fix alerts query: filter by `status = 'late'` not `'overdue'`

### Phase 1 — Complete Existing Screens (design approved, build to match ui-preview.html)
- [ ] Apply new color palette to `constants/colors.ts`
- [ ] Redesign all 10 existing screens to match approved designs
- [ ] Build Expenses tab (mobile UI for `expenses` table)
- [ ] Build Documents tab (mobile UI for `documents` table)
- [ ] Build Maintenance tab (mobile UI for `maintenance_events` table)

### Phase 2 — Intelligence Infrastructure
- [ ] Add `portfolio_insights` table to Supabase schema
- [ ] Add `user_preferences` table (briefing mode, currency, date format)
- [ ] Add `vacancy_started_at` column to `units` table (for vacancy tracking)
- [ ] Build nightly background job (Supabase Edge Function + pg_cron)
- [ ] Implement Property Health Score calculation
- [ ] Implement configurable briefing mode (Daily/Weekly/Monthly chips)
- [ ] Build Home screen Action Queue (reads from `portfolio_insights.action_queue`)
- [ ] Build Health Score Detail screen

### Phase 3 — Proactive Intelligence
- [ ] Push notifications (APNs + FCM via Expo Notifications)
- [ ] Add `device_tokens` table to schema
- [ ] Notification triggers: late rent, expiring leases, vacant units
- [ ] AI generates briefing text via Claude (replaces rule-based text)
- [ ] AI Chat: persist conversations to `chat_conversations` + `chat_messages`

### Phase 4 — AI Action Execution + Advanced
- [ ] AI Chat can execute actions (record payment, create maintenance ticket)
- [ ] Scenarios screen on mobile (port from web app)
- [ ] Financial overview screen (transactions, expense summary)
- [ ] Tier 3: Rentcast API integration (rental market comps)
- [ ] PDF portfolio report generation

---

## Web App Reference

Full-featured companion web app at: `/Users/kocharpratik11/REIP/real-estate-intel`
- Next.js 16 + React 19 + Tailwind CSS 4
- Dark theme
- Includes: property wizard, scenario modeling, document vault with AI extraction, expense tracking, maintenance tracking, vendor management, full financial analytics
- Shared Supabase database — same tables, same data
- Source of truth for DB schema: `supabase/migrations/deploy_phase*.sql`
