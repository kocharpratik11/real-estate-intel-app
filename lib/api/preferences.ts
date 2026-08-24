import { supabase } from '@/lib/supabase';

export type UserPreferences = {
  briefing_mode:         'daily' | 'weekly' | 'monthly';
  notify_late_rent:      boolean;
  notify_lease_expiry:   boolean;
  notify_maintenance:    boolean;
  currency:              string;   // e.g. 'USD'
  date_format:           string;   // e.g. 'MM/DD/YYYY'
  // Matches the CHECK constraints on user_preferences in
  // deploy_phase4a_intelligence_v2.sql — keep in sync with web's PreferencesModal.tsx.
  risk_tolerance:        'conservative' | 'moderate' | 'growth' | 'real_estate_focused';
  primary_goal:          'cash_flow' | 'appreciation' | 'payoff' | 'expand';
  communication_style:   'concise' | 'detailed';
  topics_to_avoid:       string[];
  onboarding_completed:  boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  briefing_mode:        'daily',
  notify_late_rent:     true,
  notify_lease_expiry:  true,
  notify_maintenance:   false,
  currency:             'USD',
  date_format:          'MM/DD/YYYY',
  risk_tolerance:       'moderate',
  primary_goal:         'cash_flow',
  communication_style:  'concise',
  topics_to_avoid:      [],
  onboarding_completed: false,
};

export async function getPreferences(): Promise<UserPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFERENCES;
  const workspaceId = user.user_metadata?.current_workspace_id;
  if (!workspaceId) return DEFAULT_PREFERENCES;

  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!data) return DEFAULT_PREFERENCES;

  return {
    briefing_mode:        (data.briefing_mode        as any) ?? DEFAULT_PREFERENCES.briefing_mode,
    notify_late_rent:     data.notify_late_rent       ?? DEFAULT_PREFERENCES.notify_late_rent,
    notify_lease_expiry:  data.notify_lease_expiry    ?? DEFAULT_PREFERENCES.notify_lease_expiry,
    notify_maintenance:   data.notify_maintenance     ?? DEFAULT_PREFERENCES.notify_maintenance,
    currency:             data.currency               ?? DEFAULT_PREFERENCES.currency,
    date_format:          data.date_format            ?? DEFAULT_PREFERENCES.date_format,
    risk_tolerance:       (data.risk_tolerance       as any) ?? DEFAULT_PREFERENCES.risk_tolerance,
    primary_goal:         (data.primary_goal         as any) ?? DEFAULT_PREFERENCES.primary_goal,
    communication_style:  (data.communication_style  as any) ?? DEFAULT_PREFERENCES.communication_style,
    topics_to_avoid:      data.topics_to_avoid         ?? DEFAULT_PREFERENCES.topics_to_avoid,
    onboarding_completed: data.onboarding_completed    ?? DEFAULT_PREFERENCES.onboarding_completed,
  };
}

export async function updatePreferences(patch: Partial<UserPreferences>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const workspaceId = user.user_metadata?.current_workspace_id;
  if (!workspaceId) throw new Error('No active workspace');

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, workspace_id: workspaceId, ...patch },
      { onConflict: 'user_id,workspace_id' },
    );

  if (error) throw new Error(error.message);
}
