import { supabase } from '@/lib/supabase';

export type UserPreferences = {
  briefing_mode:         'daily' | 'weekly' | 'monthly';
  notify_late_rent:      boolean;
  notify_lease_expiry:   boolean;
  notify_maintenance:    boolean;
  currency:              string;   // e.g. 'USD'
  date_format:           string;   // e.g. 'MM/DD/YYYY'
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  briefing_mode:       'daily',
  notify_late_rent:    true,
  notify_lease_expiry: true,
  notify_maintenance:  false,
  currency:            'USD',
  date_format:         'MM/DD/YYYY',
};

export async function getPreferences(): Promise<UserPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFERENCES;

  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return DEFAULT_PREFERENCES;

  return {
    briefing_mode:       (data.briefing_mode       as any) ?? DEFAULT_PREFERENCES.briefing_mode,
    notify_late_rent:    data.notify_late_rent      ?? DEFAULT_PREFERENCES.notify_late_rent,
    notify_lease_expiry: data.notify_lease_expiry   ?? DEFAULT_PREFERENCES.notify_lease_expiry,
    notify_maintenance:  data.notify_maintenance    ?? DEFAULT_PREFERENCES.notify_maintenance,
    currency:            data.currency              ?? DEFAULT_PREFERENCES.currency,
    date_format:         data.date_format           ?? DEFAULT_PREFERENCES.date_format,
  };
}

export async function updatePreferences(patch: Partial<UserPreferences>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });

  if (error) throw new Error(error.message);
}
