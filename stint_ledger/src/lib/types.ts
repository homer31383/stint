export interface StintClient {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  service_rates: Record<string, number>;
  created_at: number;
}

export interface StintProject {
  id: string;
  client_id: string;
  name: string;
  status: string;
  director: string | null;
  director_email: string | null;
  producer: string | null;
  producer_email: string | null;
  production_company: string | null;
  creative_director: string | null;
  lead_3d: string | null;
  lead_2d: string | null;
  my_role: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: number;
}

export interface StintTimeEntry {
  id: string;
  project_id: string;
  date: string;
  hour: number | null;
  service_type: string;
  hours: number;
  rate: number;
  amount: number;
  notes: string | null;
  created_at: number;
}

export interface StintPencil {
  id: string;
  client_id?: string;
  project_id: string | null;
  start_date: string;
  end_date: string;
  priority: number;
  notes: string | null;
  created_at: number;
}

export interface StintInvoice {
  id: string;
  number: string | null;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  entry_ids: string[];
  line_items: InvoiceLineItem[];
  total: number;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  invoice_code: string | null;
  notes: string | null;
  date_range: string | null;
  dates_worked: string[];
  created_at: number;
}

export interface InvoiceLineItem {
  type: string;
  date: string;
  hours: number;
  amount: number;
  note: string;
}

export interface StintSettings {
  id: string;
  business_name: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  bank_name: string | null;
  routing: string | null;
  account_number: string | null;
  invoice_prefix: string;
  next_invoice_number: number;
  payment_terms: number;
  hide_dollars: boolean;
  service_rates: Record<string, number>;
}

export interface StintData {
  clients: StintClient[];
  projects: StintProject[];
  timeEntries: StintTimeEntry[];
  pencils: StintPencil[];
  invoices: StintInvoice[];
  settings: StintSettings | null;
  lastSynced: number | null;
}

// Aggregate balances consumed by Planner, Retirement, Dashboard
export interface AccountBalances {
  checking: number;
  hys: number;
  moneyMarket: number;
  brokerage: number;
  tradIRA: number;
  rolloverIRA: number;
  hsa: number;
  ccDebt: number;
}

// Planner variable a custom account maps to
export type CustomAccountType =
  | 'checking'
  | 'hys'
  | 'moneyMarket'
  | 'brokerage'
  | 'tradIRA'
  | 'rolloverIRA'
  | 'hsa'
  | 'ccDebt';

// Visual section a custom account appears in
export type SectionKey =
  | 'cashChecking'
  | 'credit'
  | 'savings'
  | 'nonRetirement'
  | 'retirement'
  | 'otherInvestments';

export interface CustomAccount {
  id: string;
  name: string;
  balance: number;
  type: CustomAccountType;
  section: SectionKey;
}

// Keys of the pre-populated fixed accounts — shared with NetWorth view
export type FixedAccountKey =
  | 'advRelationship' | 'santanderChecking' | 'advantageSavings'
  | 'citiDoubleCash'
  | 'highYieldSavings' | 'openbankHYS' | 'santanderMM'
  | 'nonRetirement'
  | 'traditionalIRA' | 'rolloverIRA'
  | 'hsa';

// A fund holding tracked under an investment account. When holdings exist for
// an account, its effective balance is sum(shares * price) — the manually
// entered number for that account is ignored.
export interface FundHolding {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  price: number;
  costBasis: number;
  // Muted holdings stay in the list (and still get price refreshes) but are
  // excluded from account totals and everything downstream of them.
  muted?: boolean;
}

// Investment accounts that support a holdings sub-table in the NetWorth view.
export type HoldingsAccountKey = 'nonRetirement' | 'traditionalIRA' | 'rolloverIRA';

export const HOLDINGS_ENABLED_KEYS: HoldingsAccountKey[] = [
  'nonRetirement',
  'traditionalIRA',
  'rolloverIRA',
];

// Individual account balances matching Simplifi structure
export interface DetailedBalances {
  // Banking > Cash & Checking
  advRelationship: number;
  santanderChecking: number;
  advantageSavings: number;
  // Banking > Credit
  citiDoubleCash: number;
  // Banking > Savings
  highYieldSavings: number;
  openbankHYS: number;
  santanderMM: number;
  // Investments > Non-retirement
  nonRetirement: number;
  // Investments > Retirement
  traditionalIRA: number;
  rolloverIRA: number;
  // Investments > Other
  hsa: number;
  // User-added custom accounts
  customAccounts?: CustomAccount[];
  // Muted account identifiers (FixedAccountKey strings or CustomAccount.id strings).
  // Muted accounts are excluded from all totals and planner aggregation.
  mutedAccounts?: string[];
  // Fund holdings per investment account. When present and non-empty, the
  // sum of shares*price overrides the manually entered balance for that key.
  holdings?: Partial<Record<HoldingsAccountKey, FundHolding[]>>;
  // Meta
  lastUpdated: number | null;
  // When holding prices were last fetched from the market data API. Tracked
  // separately from lastUpdated so the user can see price staleness even when
  // balances haven't been hand-edited recently.
  pricesUpdated?: number | null;
}

export function holdingMarketValue(h: FundHolding): number {
  return h.shares * h.price;
}

export function holdingsTotal(list: FundHolding[] | undefined): number {
  if (!list) return 0;
  return list.reduce((s, h) => h.muted ? s : s + holdingMarketValue(h), 0);
}

export function mutedHoldingsTotal(list: FundHolding[] | undefined): number {
  if (!list) return 0;
  return list.reduce((s, h) => h.muted ? s + holdingMarketValue(h) : s, 0);
}

export function holdingsCostBasisTotal(list: FundHolding[] | undefined): number {
  if (!list) return 0;
  return list.reduce((s, h) => h.muted ? s : s + h.costBasis, 0);
}

// Effective balance for a holdings-enabled key: holdings total if any, else manual.
export function effectiveBalance(d: DetailedBalances, key: HoldingsAccountKey): number {
  const list = d.holdings?.[key];
  if (list && list.length > 0) return holdingsTotal(list);
  return d[key] as number;
}

export const DEFAULT_HOLDINGS: Required<NonNullable<DetailedBalances['holdings']>> = {
  nonRetirement: [
    { id: 'brokerage-aepgx', ticker: 'AEPGX', name: 'American EuroPacific Growth Fund A', shares: 1921.267, price: 64.09, costBasis: 89669.65 },
    { id: 'brokerage-anefx', ticker: 'ANEFX', name: 'American New Economy Fund Class A', shares: 4106.533, price: 83.64, costBasis: 162005.09 },
    { id: 'brokerage-dodbx', ticker: 'DODBX', name: 'Dodge & Cox Balanced Fund Class I', shares: 3579.007, price: 13.53, costBasis: 37928.84 },
  ],
  traditionalIRA: [
    { id: 'tradira-aepgx', ticker: 'AEPGX', name: 'American EuroPacific Growth Fund A', shares: 534.407, price: 64.09, costBasis: 23112.43 },
    { id: 'tradira-anefx', ticker: 'ANEFX', name: 'American New Economy Fund Class A', shares: 1151.702, price: 83.64, costBasis: 43402.29 },
    { id: 'tradira-dodbx', ticker: 'DODBX', name: 'Dodge & Cox Balanced Fund Class I', shares: 1553.352, price: 13.53, costBasis: 15899.46 },
  ],
  rolloverIRA: [
    { id: 'rollover-spy', ticker: 'SPY', name: 'SPDR S&P 500 ETF', shares: 730, price: 733.55, costBasis: 491733.91 },
  ],
};

export const DEFAULT_DETAILED: DetailedBalances = {
  advRelationship: 1727,
  santanderChecking: 10388,
  advantageSavings: 36663,
  citiDoubleCash: -2127,
  highYieldSavings: 238664,
  openbankHYS: 70000,
  santanderMM: 12661,
  nonRetirement: 479263,
  traditionalIRA: 141721,
  rolloverIRA: 505818,
  hsa: 8072,
  customAccounts: [],
  mutedAccounts: [],
  holdings: {
    nonRetirement: DEFAULT_HOLDINGS.nonRetirement,
    traditionalIRA: DEFAULT_HOLDINGS.traditionalIRA,
    rolloverIRA: DEFAULT_HOLDINGS.rolloverIRA,
  },
  lastUpdated: null,
};

export function toAggregateBalances(d: DetailedBalances): AccountBalances {
  const muted = new Set(d.mutedAccounts ?? []);
  const f = (key: FixedAccountKey): number => {
    if (muted.has(key)) return 0;
    if (key === 'nonRetirement' || key === 'traditionalIRA' || key === 'rolloverIRA') {
      return effectiveBalance(d, key);
    }
    return d[key] as number;
  };
  const agg: AccountBalances = {
    checking: f('advRelationship') + f('santanderChecking') + f('advantageSavings'),
    hys: f('highYieldSavings') + f('openbankHYS'),
    moneyMarket: f('santanderMM'),
    brokerage: f('nonRetirement'),
    tradIRA: f('traditionalIRA'),
    rolloverIRA: f('rolloverIRA'),
    hsa: f('hsa'),
    ccDebt: f('citiDoubleCash'),
  };
  for (const acct of d.customAccounts ?? []) {
    if (muted.has(acct.id)) continue;
    agg[acct.type] += acct.balance;
  }
  return agg;
}

export const DEFAULT_BALANCES: AccountBalances = toAggregateBalances(DEFAULT_DETAILED);

export type ViewId = 'dashboard' | 'utilization' | 'pipeline' | 'invoices' | 'planner' | 'expenses' | 'networth' | 'retirement' | 'export';
