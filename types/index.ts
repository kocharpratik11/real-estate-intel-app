// Core domain types — mirrors the web app's Supabase schema

export type Workspace = {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'viewer';
};

export type Property = {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  property_type: 'residential' | 'commercial' | 'mixed_use';
  unit_count: number;
  workspace_id: string;
};

export type Unit = {
  id: string;
  property_id: string;
  label: string;
};

export type Tenant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
};

export type Lease = {
  id: string;
  unit_id: string;
  monthly_rent: number;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'expired' | 'terminated';
  units: { label: string } | null;
};

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'late' | 'waived';
export type ChargeType = 'rent' | 'late_fee' | 'security_deposit' | 'pet_fee' | 'other';

export type RentPayment = {
  id: string;
  lease_id: string;
  property_id: string;
  period_year: number | null;
  period_month: number | null;
  due_date: string;
  paid_date: string | null;
  amount_due: number;
  amount_paid: number | null;
  status: PaymentStatus;
  charge_type: ChargeType;
  charge_description: string | null;
  notes: string | null;
  units: { label: string } | null;
};

export type Expense = {
  id: string;
  property_id: string;
  unit_id: string | null;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
};

export type MaintenanceEvent = {
  id: string;
  property_id: string;
  unit_id: string | null;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'emergency' | 'high' | 'normal' | 'low';
  reported_date: string;
  resolved_date: string | null;
};

// API response shapes

export type PropertyMetrics = {
  property_id: string;
  monthly_cash_flow: number;
  collection_rate: number;    // 0–1
  units_paid: number;
  units_total: number;
  current_value: number | null;
  equity: number | null;
  roe: number | null;
  vacancies: number;
};

export type PortfolioSummary = {
  total_properties: number;
  total_value: number;
  monthly_cash_flow: number;
  collection_rate: number;
  monthly_collected: number;
  monthly_expected: number;
  net_income: number;
  vacancies: number;
  longest_vacancy_days: number;
  health_score: number;       // 0–100
};

export type AppAlert = {
  id:       string;
  severity: 'emergency' | 'warning' | 'info';
  title:    string;
  body:     string;
  action:   string;
  property: string;
  time:     string;
  route?:   string;
};

// Ledger event (derived client-side from RentPayment rows)
export type LedgerEvent = {
  date: string;
  type: 'charge' | 'payment';
  amount: number;
  description: string;
  status: PaymentStatus | null;
  sourcePayment: RentPayment;
  isCredit: boolean;
  runningBalance: number;
};
