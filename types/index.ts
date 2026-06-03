// Core domain types — mirrors the web app's Supabase schema

export type Workspace = {
  id: string;
  name: string;
  role: 'owner' | 'operator';   // DB enum: workspace_members.role
};

export type Property = {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  zip?: string | null;
  property_type: 'sfh' | 'duplex' | 'triplex' | 'fourplex' | 'multifamily';
  asset_class?: 'single_family' | 'condo' | 'townhouse' | 'multifamily' | 'commercial' | 'mixed_use' | 'land' | null;
  property_usage?: 'long_term_rental' | 'midterm_rental' | 'short_term_rental' | 'owner_occupied' | 'vacant' | 'development' | null;
  unit_count: number;
  workspace_id: string;
  // Financial columns (computed by DB trigger calculate_property_metrics)
  current_market_value?: number | null;
  total_equity?: number | null;
  roe_percentage?: number | null;
  monthly_debt_service?: number | null;
  annual_noi?: number | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
};

export type Unit = {
  id: string;
  property_id: string;
  workspace_id: string;
  label: string;
  unit_type?: string | null;
  beds?: number | null;
  baths?: number | null;
};

export type Tenant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes?: string | null;
};

export type Lease = {
  id: string;
  unit_id: string;
  monthly_rent: number;
  start_date: string;
  end_date: string | null;
  status: 'draft' | 'active' | 'ended';   // DB enum: leases.status
  security_deposit?: number | null;
  late_fee?: number | null;
  pet_rent_monthly?: number | null;
  parking_fee_monthly?: number | null;
  storage_fee_monthly?: number | null;
  other_income_monthly?: number | null;
  units: { id: string; label: string } | null;
};

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'late' | 'waived';
export type ChargeType = 'rent' | 'late_fee' | 'security_deposit' | 'pet_fee' | 'other';

export type RentPayment = {
  id: string;
  lease_id: string;
  property_id: string;
  unit_id: string;
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
  units: { id: string; label: string } | null;
};

export type Expense = {
  id: string;
  property_id: string;
  unit_id: string | null;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  vendor?: string | null;
  tax_year?: number | null;
  notes?: string | null;
};

export type MaintenanceEvent = {
  id: string;
  property_id: string;
  unit_id: string | null;
  vendor_id?: string | null;
  title: string;
  description: string | null;
  category?: string | null;
  // DB enums: maintenance_events.status / priority
  status: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requested_date: string;
  scheduled_date?: string | null;
  completed_date?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
};

export type Vendor = {
  id: string;
  workspace_id: string;
  name: string;
  trade?: string | null;
  region?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_name?: string | null;
  notes?: string | null;
  is_preferred?: boolean;
};

// API response shapes

export type PropertyMetrics = {
  property_id: string;
  monthly_cash_flow: number;
  collection_rate: number;    // 0–1
  units_paid: number;
  units_total: number;
  current_value: number | null;     // from properties.current_market_value
  equity: number | null;            // from properties.total_equity
  roe: number | null;               // from properties.roe_percentage
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
  id:            string;
  severity:      'emergency' | 'warning' | 'info';
  title:         string;
  body:          string;
  action:        string;
  property:      string;
  time:          string;
  route?:        string;
  routeParams?:  Record<string, string>;
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
