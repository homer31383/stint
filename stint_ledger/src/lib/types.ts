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
  // Meta
  lastUpdated: number | null;
}

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
  lastUpdated: null,
};

export function toAggregateBalances(d: DetailedBalances): AccountBalances {
  return {
    checking: d.advRelationship + d.santanderChecking + d.advantageSavings,
    hys: d.highYieldSavings + d.openbankHYS,
    moneyMarket: d.santanderMM,
    brokerage: d.nonRetirement,
    tradIRA: d.traditionalIRA,
    rolloverIRA: d.rolloverIRA,
    hsa: d.hsa,
    ccDebt: d.citiDoubleCash,
  };
}

export const DEFAULT_BALANCES: AccountBalances = toAggregateBalances(DEFAULT_DETAILED);

export type ViewId = 'dashboard' | 'utilization' | 'pipeline' | 'invoices' | 'planner' | 'expenses' | 'networth' | 'retirement';
