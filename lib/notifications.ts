import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// How foreground notifications appear while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound:  false,
    shouldSetBadge:   false,
    shouldShowList:   true,
  }),
});

/**
 * Request push notification permissions and register the Expo push token
 * with the device_tokens table in Supabase.
 *
 * Call once on app startup (after the user is authenticated).
 * Safe to call multiple times — uses upsert_device_token on the server.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications don't work in Expo Go on Android — only in dev builds / prod
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:             'default',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#6366F1',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  // Get Expo push token
  let token: string | null = null;
  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    token = result.data;
  } catch {
    return null;
  }

  if (!token) return null;

  // Upsert token to Supabase device_tokens table
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return token;

    const wsId = user.user_metadata?.current_workspace_id ?? null;

    await supabase.rpc('upsert_device_token', {
      p_user_id:      user.id,
      p_workspace_id: wsId,
      p_token:        token,
      p_platform:     Platform.OS as 'ios' | 'android',
    });
  } catch {
    // Non-fatal — token registration failure shouldn't block the app
  }

  return token;
}

/**
 * Schedule a local notification as a fallback when the backend Edge Function
 * hasn't sent a push yet (e.g. during development without a real device).
 *
 * Fires immediately (1 second from now) for demo / testing.
 */
export async function scheduleLocalRentReminder(opts: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  daysOverdue: number;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Rent overdue — ${opts.unitLabel}`,
      body:  `${opts.tenantName} at ${opts.propertyName} is ${opts.daysOverdue} day${opts.daysOverdue === 1 ? '' : 's'} overdue.`,
      data:  { type: 'late_rent', unit: opts.unitLabel },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}

/**
 * Remove all pending local notifications.
 */
export async function cancelAllLocalNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
