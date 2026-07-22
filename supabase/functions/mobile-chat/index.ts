// Supabase Edge Function: mobile-chat
// Provides Claude-powered portfolio Q&A for the mobile app.
// Uses the service-role key to fetch portfolio context, calls Claude, persists chat history.
// Required secrets: ANTHROPIC_API_KEY (via `supabase secrets set ANTHROPIC_API_KEY=...`)
//
// Context building mirrors the web app's src/lib/ai/portfolio-context.ts (buildPortfolioContext /
// buildSystemPrompt) so mobile and web chat see the same complete picture per property — including
// financing_structures (loans/mortgages), which the previous version of this function never queried.
// Ported inline (not imported) because this function is deployed standalone by the Supabase CLI and
// can't resolve the web app's `@/` path aliases.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') ?? 'https://localhost:3000';
const CORS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Mortgage amortization helpers (ported from src/lib/property-utils.ts) ─────────────────

interface LoanRow {
  lender_name:              string | null;
  loan_amount:               number | null;
  current_balance?:          number | null;
  interest_rate:             number | null;
  loan_term_months:          number | null;
  monthly_payment:           number | null;
  origination_date:          string | null;
  maturity_date?:            string | null;
  is_interest_only:          boolean | null;
  payment_frequency?:        string | null;   // 'monthly' | 'biweekly'
  extra_monthly_principal?:  number | null;
  payoff_date?:              string | null;
}

function calcFirstPaymentDate(originationDate: string): Date {
  const [oy, om] = originationDate.split('-').map(Number); // om is 1-indexed
  return new Date(oy, om + 1, 1); // 0-indexed: om-1+2 = om+1
}

function calcPaymentsMade(originationDate: string, termMonths: number): number {
  const firstPmt = calcFirstPaymentDate(originationDate);
  const today    = new Date();
  if (today < firstPmt) return 0;
  const n = (today.getFullYear() - firstPmt.getFullYear()) * 12
    + (today.getMonth()   - firstPmt.getMonth()) + 1;
  return Math.min(n, termMonths);
}

/**
 * Outstanding mortgage balance: prefers a stored current_balance (from a real
 * statement) over the computed value; otherwise amortizes from loan terms.
 *   B_n = P·(1+r)^n − PMT·[(1+r)^n − 1] / r
 */
function calcOutstandingBalance(loan: LoanRow): number {
  if (loan.payoff_date && new Date(loan.payoff_date) <= new Date()) return 0;

  if (loan.current_balance != null && loan.current_balance >= 0) {
    return loan.current_balance;
  }

  const P = loan.loan_amount || 0;
  if (!P) return 0;
  if (loan.is_interest_only) return P;
  if (!loan.origination_date) return P;

  const N = loan.loan_term_months || 360;
  const n = calcPaymentsMade(loan.origination_date, N);
  if (n >= N) return 0;

  const annualRate = loan.interest_rate || 0;
  const r = annualRate / 100 / 12;

  const PMT_base = r === 0
    ? (loan.monthly_payment || P / N)
    : (P * r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);

  const biweeklyBonus  = loan.payment_frequency === 'biweekly' ? PMT_base / 12 : 0;
  const extraPrincipal = loan.extra_monthly_principal ?? 0;
  const effectivePMT   = PMT_base + biweeklyBonus + extraPrincipal;

  if (r === 0) {
    return Math.max(0, Math.round((P - n * effectivePMT) * 100) / 100);
  }

  const factor  = Math.pow(1 + r, n);
  const balance = P * factor - effectivePMT * (factor - 1) / r;
  return Math.max(0, Math.round(balance * 100) / 100);
}

// ─── Portfolio context types ────────────────────────────────────────────────────────────────

interface PropertyContext {
  id: string;
  name: string;
  type: 'primary_residence' | 'rental';
  address: string;
  acquisitionDate: string | null;
  acquisitionPrice: number | null;
  currentMarketValue: number | null;
  equity: number;
  roe: number | null;
  monthlyCashFlow: number | null;
  loans: {
    lender: string | null;
    originalAmount: number;
    currentBalance: number;
    interestRate: number | null;
    monthlyPayment: number | null;
    maturityDate: string | null;
  }[];
  activeLeases: {
    unit: string;
    tenants: string;
    monthlyRent: number;
    leaseEnd: string | null;
    status: string;
    daysUntilExpiry: number | null;
  }[];
  recentRentPayments: {
    period: string;
    status: string;
    amountPaid: number | null;
    amountDue: number | null;
  }[];
  annualExpenses: number | null;
  annualPropertyTax: number | null;
  monthlyHOA: number | null;
  openMaintenanceTickets: { title: string; status: string; priority: string }[];
}

async function buildPortfolioContext(admin: any, workspaceId: string) {
  const [{ data: properties }, { data: recentPayments }, { data: openMaintenance }] = await Promise.all([
    admin
      .from('properties')
      .select(`
        id, name, address_line1, city, state, is_primary_residence,
        acquisition_date, acquisition_price, current_market_value,
        annual_property_tax, monthly_hoa_fee, monthly_debt_service,
        units(
          id, label,
          leases(
            id, status, monthly_rent, start_date, end_date,
            lease_tenants(tenants(first_name, last_name))
          )
        ),
        financing_structures(
          lender_name, loan_amount, current_balance, interest_rate,
          loan_term_months, monthly_payment, origination_date, maturity_date,
          is_interest_only, payment_frequency, extra_monthly_principal, payoff_date
        ),
        expenses(amount, tax_year)
      `)
      .eq('workspace_id', workspaceId),
    admin
      .from('rent_payments')
      .select('property_id, period_year, period_month, status, amount_paid, amount_due, charge_type')
      .eq('workspace_id', workspaceId)
      .eq('charge_type', 'rent')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(60),
    admin
      .from('maintenance_events')
      .select('property_id, title, status, priority')
      .eq('workspace_id', workspaceId)
      .in('status', ['requested', 'scheduled', 'in_progress']),
  ]);

  const today = new Date();
  const maintList = (openMaintenance ?? []) as any[];

  const contextProperties: PropertyContext[] = (properties ?? []).map((p: any) => {
    const isPrimary = Boolean(p.is_primary_residence);
    const loans = (p.financing_structures || []) as LoanRow[];
    const activeLoans = loans.filter(l => !l.payoff_date || new Date(l.payoff_date) > today);
    const totalDebt = loans.reduce((s, l) => s + calcOutstandingBalance(l), 0);
    const marketValue = p.current_market_value || 0;
    const equity = Math.max(0, marketValue - totalDebt);

    const allLeases = (p.units || []).flatMap((u: any) =>
      (u.leases || []).map((l: any) => ({ ...l, unitLabel: u.label }))
    );
    const activeLeases = allLeases.filter((l: any) => l.status === 'active');

    const monthlyRentTotal = activeLeases.reduce((s: number, l: any) => s + (l.monthly_rent || 0), 0);
    const monthlyDebtService = p.monthly_debt_service || 0;
    const monthlyExpenses = ((p.annual_property_tax || 0) + (p.monthly_hoa_fee || 0) * 12) / 12;
    // A primary residence isn't rental income — cash flow and ROE don't apply
    // to it, matching the web app's convention. Equity/market value still do.
    const monthlyCashFlow = isPrimary ? null : (monthlyRentTotal - monthlyDebtService - monthlyExpenses);

    const annualRent = monthlyRentTotal * 12;
    const annualDebtService = monthlyDebtService * 12;
    const annualExpenses = (p.expenses || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const noi = annualRent - annualExpenses;
    const roe = (isPrimary || equity <= 0) ? null : ((noi - annualDebtService) / equity) * 100;

    const propertyPayments = (recentPayments ?? [])
      .filter((rp: any) => rp.property_id === p.id)
      .slice(0, 6)
      .map((rp: any) => ({
        period: `${rp.period_year}-${String(rp.period_month).padStart(2, '0')}`,
        status: rp.status,
        amountPaid: rp.amount_paid,
        amountDue: rp.amount_due,
      }));

    return {
      id: p.id,
      name: p.name,
      type: isPrimary ? 'primary_residence' : 'rental',
      address: [p.address_line1, p.city, p.state].filter(Boolean).join(', '),
      acquisitionDate: p.acquisition_date,
      acquisitionPrice: p.acquisition_price,
      currentMarketValue: marketValue || null,
      equity,
      roe: roe !== null ? Math.round(roe * 10) / 10 : null,
      monthlyCashFlow: monthlyCashFlow !== null ? Math.round(monthlyCashFlow) : null,
      annualExpenses: annualExpenses || null,
      annualPropertyTax: p.annual_property_tax,
      monthlyHOA: p.monthly_hoa_fee,
      loans: activeLoans.map(l => ({
        lender:         l.lender_name,
        originalAmount: l.loan_amount || 0,
        currentBalance: Math.round(calcOutstandingBalance(l)),
        interestRate:   l.interest_rate,
        monthlyPayment: l.monthly_payment,
        maturityDate:   l.maturity_date ?? null,
      })),
      activeLeases: activeLeases.map((l: any) => {
        const tenantNames = (l.lease_tenants || [])
          .map((lt: any) => `${lt.tenants?.first_name || ''} ${lt.tenants?.last_name || ''}`.trim())
          .filter(Boolean)
          .join(', ');
        const leaseEnd = l.end_date ? new Date(l.end_date) : null;
        const daysUntilExpiry = leaseEnd
          ? Math.round((leaseEnd.getTime() - today.getTime()) / 86_400_000)
          : null;
        return {
          unit: l.unitLabel,
          tenants: tenantNames || 'Unknown',
          monthlyRent: l.monthly_rent || 0,
          leaseEnd: l.end_date,
          status: l.status,
          daysUntilExpiry,
        };
      }),
      recentRentPayments: propertyPayments,
      openMaintenanceTickets: maintList
        .filter(m => m.property_id === p.id)
        .map(m => ({ title: m.title, status: m.status, priority: m.priority })),
    };
  });

  // Equity and market value totals include primary residences; income, cash
  // flow and ROE totals are rental-only — matching the web app's convention.
  const rentalProperties = contextProperties.filter(p => p.type === 'rental');
  const totalMarketValue = contextProperties.reduce((s, p) => s + (p.currentMarketValue || 0), 0);
  const totalEquity      = contextProperties.reduce((s, p) => s + p.equity, 0);
  const totalDebt         = Math.max(0, totalMarketValue - totalEquity);
  const monthlyIncome     = rentalProperties.reduce((s, p) => s + p.activeLeases.reduce((ls, l) => ls + l.monthlyRent, 0), 0);
  const monthlyCashFlow   = rentalProperties.reduce((s, p) => s + (p.monthlyCashFlow ?? 0), 0);
  const roeValues = rentalProperties.map(p => p.roe).filter((r): r is number => r !== null);
  const avgROE = roeValues.length > 0 ? roeValues.reduce((s, r) => s + r, 0) / roeValues.length : 0;

  return {
    asOf: today.toISOString().split('T')[0],
    portfolio: {
      totalEquity:       Math.round(totalEquity),
      totalMarketValue:  Math.round(totalMarketValue),
      totalDebt:         Math.round(totalDebt),
      monthlyIncome:     Math.round(monthlyIncome),
      monthlyCashFlow:   Math.round(monthlyCashFlow),
      avgROE:            Math.round(avgROE * 10) / 10,
      propertyCount:     contextProperties.length,
      openMaintenanceCount: maintList.length,
    },
    properties: contextProperties,
  };
}

function buildSystemPrompt(context: Awaited<ReturnType<typeof buildPortfolioContext>>): string {
  return `You are Asset Brain, an AI assistant embedded in a real estate portfolio management mobile app. You have complete, accurate knowledge of the user's portfolio as of ${context.asOf}.

CRITICAL RULES:
1. Only state financial figures that appear in the portfolio context below. Never estimate or calculate values from memory.
2. Always specify which property you are referring to by name.
3. Give clear recommendations — do not hedge to the point of uselessness. State assumptions explicitly.
4. If a question requires data not in the context, say so clearly.
5. Keep responses concise and mobile-friendly — short paragraphs, numbers not prose. Investors are busy.
6. Never give tax advice. Say "consult a tax professional" for tax-specific questions.
7. Never guarantee returns or market performance.
8. Answer ONLY the current question. Do not repeat or re-summarize previous answers.
9. Properties with type "primary_residence" are the user's personal home, not an investment. Never suggest selling, converting, or redeploying equity from a primary residence unless the user explicitly asks about it. Cash flow and ROE are null for these properties by design — that means "not applicable," not a problem to flag.

PORTFOLIO CONTEXT:
${JSON.stringify(context, null, 2)}`;
}

// ─── Edge Function entrypoint ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnon    = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey    = Deno.env.get('ANTHROPIC_API_KEY');

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI is not configured. Set ANTHROPIC_API_KEY in Supabase secrets.' }), { status: 500, headers: CORS });
    }

    // Verify user JWT
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const admin = createClient(supabaseUrl, supabaseService);

    const { message, conversationId: incomingConvId, workspaceId } = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'message is required' }), { status: 400, headers: CORS });
    }
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'workspaceId is required' }), { status: 400, headers: CORS });
    }

    // Verify the authenticated user belongs to the requested workspace
    const { data: membership } = await userClient.from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });
    }

    // Resolve or create conversation ─────────────────────────────────────────
    let convId = incomingConvId;
    if (!convId) {
      const { data: conv, error: convErr } = await admin
        .from('chat_conversations')
        .insert({ workspace_id: workspaceId, user_id: user.id, title: message.slice(0, 80) })
        .select('id')
        .single();
      if (convErr || !conv) throw new Error('Failed to create conversation: ' + convErr?.message);
      convId = conv.id;
    }

    // Load last 10 messages for context window ────────────────────────────────
    const { data: history } = await admin
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Build full portfolio context — includes financing_structures (loans/mortgages),
    // equity, ROE, leases, tenants and recent rent history per property.
    const context = await buildPortfolioContext(admin, workspaceId);
    const systemPrompt = buildSystemPrompt(context);

    // Save user message ────────────────────────────────────────────────────────
    await admin.from('chat_messages').insert({
      conversation_id: convId,
      role:    'user',
      content: message,
    });

    // Call Claude ─────────────────────────────────────────────────────────────
    const claudeMessages = [
      ...((history ?? []) as { role: string; content: string }[]),
      { role: 'user', content: message },
    ];

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   claudeMessages,
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API error: ${errText}`);
    }

    const claudeData = await claudeRes.json();
    const reply = claudeData.content?.[0]?.text ?? 'No response from AI.';

    // Save assistant message ───────────────────────────────────────────────────
    await admin.from('chat_messages').insert({
      conversation_id: convId,
      role:    'assistant',
      content: reply,
    });

    // Update conversation timestamp
    await admin.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);

    return new Response(JSON.stringify({ reply, conversationId: convId }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[mobile-chat]', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
