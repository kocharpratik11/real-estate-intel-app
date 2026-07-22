// Supabase Edge Function: refresh-valuation
// Lets the mobile app trigger the same Zillow-backed market-value refresh
// that the web app's "Refresh Valuation" button does — ported from
// src/app/api/valuations/avm-refresh/route.ts + src/lib/apis/public-data.ts
// so mobile and web apply identical business logic for which value wins
// (a fresh Zillow estimate vs. a recent manual appraisal).
//
// Required secrets: RAPIDAPI_KEY (via `supabase secrets set RAPIDAPI_KEY=...`)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') ?? 'https://localhost:3000';
const CORS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Zillow lookup (via RapidAPI) — ported from src/lib/apis/public-data.ts ──
// Only the estimated value is needed here (that's all avm-refresh consumes),
// so this is a trimmed port rather than the full AllPropertyData shape.

async function fetchZillowEstimate(apiKey: string, address: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://zllw-working-api.p.rapidapi.com/pro/byaddress?propertyaddress=${encodeURIComponent(address)}`,
      {
        headers: {
          'x-rapidapi-host': 'zllw-working-api.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
      },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const pd = json?.propertyDetails;
    if (!pd) return null;

    // Prefer typed field, fall back to the adTargets string — same as web.
    const estimatedValue = pd.zestimate ?? (pd.adTargets?.zestimate ? Number(pd.adTargets.zestimate) : null);
    return typeof estimatedValue === 'number' && !isNaN(estimatedValue) ? estimatedValue : null;
  } catch {
    return null;
  }
}

// ─── Effective-value business logic — exact port of avm-refresh/route.ts ───
//   - No Zillow data            → skip (keep existing)
//   - Zillow > last appraisal  → use Zillow (upside)
//   - Zillow < appraisal ≤ 2yr → use appraisal (recent appraisal protects)
//   - Zillow < appraisal > 2yr → use Zillow (appraisal stale)
//   - No appraisal at all       → use Zillow

type EffectiveReason =
  | 'no_zillow_data'
  | 'zillow_only'
  | 'zillow_higher'
  | 'appraisal_recent'
  | 'appraisal_stale';

const REASON_NOTES: Record<EffectiveReason, string> = {
  no_zillow_data: '',
  zillow_only: 'No prior valuation on record',
  zillow_higher: 'Higher than last valuation',
  appraisal_recent: '',
  appraisal_stale: 'Last valuation >2 years old',
};

function computeEffectiveValue(
  zillowValue: number | null,
  latestAppraisal: { estimated_value: number; valuation_date: string } | null,
): { effectiveValue: number | null; reason: EffectiveReason } {
  if (!zillowValue) return { effectiveValue: null, reason: 'no_zillow_data' };
  if (!latestAppraisal) return { effectiveValue: zillowValue, reason: 'zillow_only' };

  const appraisalAgeYears =
    (Date.now() - new Date(latestAppraisal.valuation_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  if (zillowValue >= latestAppraisal.estimated_value) {
    return { effectiveValue: zillowValue, reason: 'zillow_higher' };
  }
  if (appraisalAgeYears <= 2) {
    return { effectiveValue: latestAppraisal.estimated_value, reason: 'appraisal_recent' };
  }
  return { effectiveValue: zillowValue, reason: 'appraisal_stale' };
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
    const rapidApiKey     = Deno.env.get('RAPIDAPI_KEY');

    if (!rapidApiKey) {
      return new Response(JSON.stringify({ error: 'Valuation refresh is not configured. Set RAPIDAPI_KEY in Supabase secrets.' }), { status: 500, headers: CORS });
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const admin = createClient(supabaseUrl, supabaseService);

    const { workspaceId, propertyId } = await req.json();
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'workspaceId is required' }), { status: 400, headers: CORS });
    }

    // Owner-only, same as web
    const { data: membership } = await userClient.from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
    if (!membership || membership.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owners can refresh valuations' }), { status: 403, headers: CORS });
    }

    let propQuery = admin
      .from('properties')
      .select('id, name, address_line1, city, state, zip, current_market_value')
      .eq('workspace_id', workspaceId);
    if (propertyId) propQuery = propQuery.eq('id', propertyId);

    const { data: properties } = await propQuery;
    if (!properties || properties.length === 0) {
      return new Response(JSON.stringify({ results: [], refreshedAt: new Date().toISOString() }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const propertyIds = properties.map((p: any) => p.id);
    const today = new Date().toISOString().split('T')[0];

    // Latest user-entered valuation per property (any source except 'avm'), newest first
    const { data: userValuations } = await admin
      .from('property_valuations')
      .select('property_id, estimated_value, valuation_date')
      .in('property_id', propertyIds)
      .eq('workspace_id', workspaceId)
      .neq('source', 'avm')
      .order('valuation_date', { ascending: false });

    const latestUserValByProp: Record<string, { estimated_value: number; valuation_date: string }> = {};
    for (const v of userValuations ?? []) {
      if (!latestUserValByProp[v.property_id]) latestUserValByProp[v.property_id] = v;
    }

    // AVM records already inserted today — avoid duplicates
    const { data: existingAvmToday } = await admin
      .from('property_valuations')
      .select('property_id')
      .in('property_id', propertyIds)
      .eq('workspace_id', workspaceId)
      .eq('source', 'avm')
      .eq('valuation_date', today);
    const hasAvmToday = new Set((existingAvmToday ?? []).map((r: any) => r.property_id));

    // Call Zillow in parallel
    const zillowSettled = await Promise.allSettled(
      properties.map(async (p: any) => {
        const address = `${p.address_line1}, ${p.city}, ${p.state} ${p.zip}`;
        const zillowValue = await fetchZillowEstimate(rapidApiKey, address);
        return { propertyId: p.id, zillowValue };
      }),
    );
    const zillowByProp: Record<string, number | null> = {};
    for (const r of zillowSettled) {
      if (r.status === 'fulfilled') zillowByProp[r.value.propertyId] = r.value.zillowValue;
    }

    const results = [];
    for (const p of properties as any[]) {
      const zillowValue = zillowByProp[p.id] ?? null;
      const latestAppraisal = latestUserValByProp[p.id] ?? null;
      const { effectiveValue, reason } = computeEffectiveValue(zillowValue, latestAppraisal);

      if (effectiveValue === null) {
        results.push({ propertyId: p.id, name: p.name, skipped: true, reason });
        continue;
      }

      const changed = effectiveValue !== p.current_market_value;

      if (changed) {
        await admin
          .from('properties')
          .update({ current_market_value: effectiveValue, value_updated_at: new Date().toISOString() })
          .eq('id', p.id)
          .eq('workspace_id', workspaceId);

        const zillowIsSource = reason !== 'appraisal_recent';
        if (zillowIsSource && !hasAvmToday.has(p.id)) {
          await admin.from('property_valuations').insert({
            workspace_id:   workspaceId,
            property_id:    p.id,
            valuation_date: today,
            estimated_value: effectiveValue,
            source:         'avm',
            notes:          REASON_NOTES[reason] || null,
          });
        }

        await admin.rpc('calculate_property_metrics', { p_property_id: p.id });
      }

      results.push({ propertyId: p.id, name: p.name, effectiveValue, zillowValue, reason, changed });
    }

    return new Response(JSON.stringify({ results, refreshedAt: new Date().toISOString() }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[refresh-valuation]', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
