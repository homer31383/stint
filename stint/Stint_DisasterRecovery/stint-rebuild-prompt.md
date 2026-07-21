# STINT REBUILD PROMPT FOR CLAUDE CODE
# If everything is lost, paste this entire file into a Claude Code session to rebuild Stint from scratch.
# First complete Steps 1-2 from the Disaster Recovery doc (Supabase setup, project creation).

---

## CONTEXT

I need you to rebuild Stint, my freelance management PWA. Everything has been lost. I have a fresh project directory with package.json, Supabase is set up with the schema, and I need you to rebuild the entire app.

## TECH STACK
- React 18 + Vite 5
- Supabase for database and auth (@supabase/supabase-js)
- vite-plugin-pwa for PWA installability
- No CSS framework, no router, no state management library
- Inline React styles throughout
- Single-file architecture: entire UI in src/App.jsx
- Font: Instrument Sans from Google Fonts

## FILE STRUCTURE
- index.html (entry, PWA meta tags, apple-mobile-web-app-capable)
- vite.config.js (React plugin + VitePWA plugin)
- src/main.jsx (renders App into #root)
- src/App.jsx (ENTIRE application, ~2500 lines)
- src/lib/supabase.js (createClient from env vars, exports supabase + isSupabaseConfigured)
- src/hooks/useOfflineFirst.js (sync hook)
- public/favicon.svg (dark bg, white S)

## DATA LAYER (CRITICAL)
Supabase-first sync model:
- Supabase is source of truth, localStorage is cache
- Push immediately on every local change (create, update, delete)
- Pull from Supabase on app load and every 10 seconds
- If Supabase unavailable, fall back to localStorage
- All localStorage keys prefixed: stint_
- All Supabase tables prefixed: stint_
- camelCase in JS, snake_case in Supabase (auto-convert in hook)
- __personal__ project/client are LOCAL ONLY, never push to Supabase
- Deletes must push DELETE to Supabase immediately

TABLE MAP in sync hook:
  clients -> stint_clients
  projects -> stint_projects
  time -> stint_time_entries
  pencils -> stint_pencils
  invoices -> stint_invoices
  settings -> stint_settings

## AUTH
- Supabase Auth, email/password
- Login screen gates entire app
- supabase.auth.onAuthStateChange to track session
- Sign out button in Settings
- Public sign-ups disabled in Supabase dashboard

## DESIGN TOKENS
Theme (light):
  bg: #f8f7f4, surface: #fff, surfaceAlt: #f5f4f0
  text: #1a1a1a, textSecondary: #6b6965, textTertiary: #9c9a94
  green: #2d8a4e, red: #c53030
  border: #e5e3dd, borderLight: #eeece6
  accentSoft: rgba(45,138,78,0.08)

Typography:
  Font: 'Instrument Sans', sans-serif
  Page titles: 20px weight 750 tracking -0.03em
  Section labels: 12px weight 700 uppercase tracking 0.04em
  Body: 13px

## SERVICE TYPES
  day_rate: $1200/day, color green
  shoot_attend: $1500/day, color blue (#2563eb)
  hourly: $150/hr, color purple (#7c3aed)
  overtime: $187.50/hr, color orange (#c2410c)
  expense: $0 pass-through, color yellow (#b7791f)

## PENCIL PRIORITY
  0: Booked (green #2d8a4e, bg #dbeee2)
  1: Pencil 1 (blue #2563eb, bg #dbeaf7)
  2: Pencil 2 (orange #c2410c, bg #fce4c4)
  3: Pencil 3 (gray #9c9a94, bg #f2f1ee)

## PROJECT STATUS
  active: green #2d8a4e bg #dbeee2
  on_hold: yellow #b7791f bg #f5ead6
  complete: gray #9c9a94 bg #f2f1ee

## SPECIAL CONSTANTS
  PERSONAL_PROJECT_ID = '__personal__'
  PERSONAL_CLIENT_ID = '__personal__'
  These always exist locally, never sync. Purple color (#7c3aed).

## DEFAULT SETTINGS
  businessName: '', businessEmail: '', businessPhone: '', businessAddress: ''
  bankName: '', routing: '', accountNumber: ''
  invoicePrefix: 'CB', nextInvoiceNumber: 2
  paymentTerms: 30, hideDollars: true
  serviceRates: {day_rate:1200, shoot_attend:1500, hourly:150, overtime:187.5, expense:0}

## FEATURES TO BUILD (in order)

### 1. App Shell
- Tab navigation: Dashboard, Time, Bookings, Invoices, Clients, Reports, Settings
- Desktop: left sidebar nav with Stint title
- Mobile (<768px): bottom tab bar with icons (Home, Time, Bookings, Invoices, More popover for Clients/Reports/Settings)
- Mobile detection via matchMedia

### 2. Shared Components
- Btn: variants default/primary/ghost/green, sizes sm/md
- Field: labeled text input
- Sel: labeled select dropdown
- TextArea: labeled multiline
- Tag: colored pill
- Modal: desktop centered overlay, mobile bottom sheet (slide up, full width, drag handle)
- Section: title + optional collapsible behavior
- Row: horizontal flex container
- Stat: metric card for dashboard
- Empty: placeholder state
- Card: white bordered box for Settings

### 3. Dashboard
- This Month stat: total revenue or day count (unique dates with entries), respects hideDollars
- Outstanding stat: unpaid invoice total or count
- Quick log today: project dropdown + "Log Full Day" button (fills 9am-5pm)
- Upcoming Bookings section
- Recent Time section (collapsible, default collapsed)

### 4. Timesheet (most complex)
Desktop:
- Weekly grid: Mon-Sun columns, hour rows 6am-9pm
- Project brush: select project + service type from bar above grid
- Client filter dropdown
- Click empty cell to fill with selected project
- Consecutive same-project/type hours merge into visual blocks
- Each hour within a block independently removable (show x on hover per hour)
- Pencil icon on block hover to open notes modal
- Fill Range modal: batch fill project across hour range
- Copy Last Week: duplicate previous week (skip filled cells)
- Undo stack: last 20 actions, Cmd+Z support
- Week summary list below grid
- Day column headers show date + total hours

Mobile (<768px):
- Single day view with horizontal day picker strip
- mobileDayIndex state, defaults to today
- Vertical hour list with 48px tap targets
- Tap empty to fill, tap filled shows action menu (Remove / Edit Note)
- Sticky project bar above bottom nav

### 5. Bookings & Pencils
- Client-first: select client (required), then optionally project
- Priority: Booked (0) or Pencil 1/2/3
- Confirm/Unbook toggle
- Priority adjustment buttons
- Conflict detection (overlapping booked/pencil-1)
- Monthly calendar view with colored entry chips
- Past entries section
- Inline new client / new project creation

### 6. Invoices
- Create flow: select client, date range, pick days to include
- Auto-groups entries by project/service type with subtotals
- Expense line items (description + amount)
- Can create expense-only invoices
- Invoice numbering: prefix + sequential number
- Status: draft/sent/paid/overdue with toggle buttons
- PDF download via print window (HTML invoice template)
- PDF includes: business header, client info, line items table, bank details, payment terms, notes
- Expense rows have yellow EXPENSE tag, subtle yellow background

### 7. Clients
- Collapsible cards (collapsed by default)
- Expand shows: projects list, add project button, delete link
- Per-client negotiated rates (override defaults per service type)
- Email, notes fields
- Safe delete with confirmation
- Auto-creates "Internal Meeting" project per client

### 8. Projects (managed within Clients)
- Status: active/on_hold/complete with toggle buttons
- Crew: Director (+email), Producer (+email), Creative Director, 3D Lead, 2D Lead, My Role
- Production Company, Due Date, Notes
- Completed projects hidden from timesheet selector
- Sorted: active > on_hold > complete
- Detail pills showing crew below project name
- Overdue dates in red

### 9. Reports
- Period: Week/Month/Quarter/Year with arrow nav + Today button
- Stats: Hours (days worked), Revenue (eff. rate), Utilization (%), Invoiced (count)
- Utilization = unique days / weekdays in period
- Client breakdown sorted by revenue with colored progress bars
- Project detail rows under each client
- Respects hideDollars

### 10. Settings
- Business Info, Bank Details, Default Service Rates
- Invoice prefix + next number, Payment terms
- Hide dollars toggle (default on)
- Export all data as JSON backup (download file)
- Sign out button
- Data card shows counts of all records

### 11. Mobile Responsive
- isMobile state from matchMedia (max-width: 767px)
- Bottom tab bar with SVG icons, More popover
- Modals as bottom sheets
- Full-width views with 16px padding
- Timesheet single-day view

## uid() FUNCTION
Use Math.random fallback, NOT crypto.randomUUID (breaks on HTTP/local network):
  const uid = () => Math.random().toString(36).slice(2, 10);

## IMPORTANT NOTES
- Invoice line items have type: 'day' or 'expense'
- Time entries: 1 row per hour block. A full day = 8 entries (hours 9-16), each with amount = rate/8
- Per-client rates stored in client.serviceRates as {day_rate: X, hourly: Y, ...}
- getRate(client, serviceType) checks client rates first, falls back to settings defaults
- Timesheet block merging: getBlockInfo() checks if consecutive hours have same projectId + serviceType
- Project colors auto-assigned from a palette array based on index
- Every client auto-gets an "Internal Meeting" project on creation
