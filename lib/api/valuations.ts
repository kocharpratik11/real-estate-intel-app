import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export type ValuationRefreshResult = {
  propertyId: string;
  name: string;
  skipped?: boolean;
  changed?: boolean;
  effectiveValue?: number | null;
  zillowValue?: number | null;
  reason: string;
};

/**
 * Trigger the same Zillow-backed market-value refresh the web app's
 * "Refresh Valuation" button runs, via the refresh-valuation Edge Function.
 * Owner-only — the function itself enforces this via workspace_members.
 */
export async function refreshValuation(
  workspaceId: string,
  propertyId?: string,
): Promise<{ results: ValuationRefreshResult[]; refreshedAt: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/refresh-valuation`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type':  'application/json',
      'apikey':        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({ workspaceId, propertyId }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}
