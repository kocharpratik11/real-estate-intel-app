import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

/** Check for an OTA update and reload if one is available. */
async function checkForUpdate() {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Network error or no update channel — silently ignore in dev and production
  }
}

/**
 * Parse and handle a Supabase auth deep link.
 *
 * Supabase redirects to:
 *   rei://confirm#access_token=...&refresh_token=...&type=signup
 *   rei://reset-password#access_token=...&refresh_token=...&type=recovery
 *
 * We parse the fragment, set the session, then navigate.
 */
async function handleAuthDeepLink(url: string) {
  // Only process rei:// deep links that have a fragment with tokens
  if (!url.startsWith('rei://')) return;

  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return;

  const fragment = url.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);

  const accessToken  = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type         = params.get('type'); // 'signup' | 'recovery'

  if (!accessToken || !refreshToken) return;

  const { data, error } = await supabase.auth.setSession({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) return;

  if (type === 'recovery') {
    // Password reset — take user to the in-app reset screen
    router.replace('/reset-password');
  } else {
    // Email confirmation (signup) — route based on workspace state
    const wsId = data.session.user?.user_metadata?.current_workspace_id;
    router.replace(wsId ? '/workspace-picker' : '/onboarding');
  }
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    if (!__DEV__) checkForUpdate();
  }, []);

  // Guard against stale / invalid refresh tokens.
  // Supabase emits SIGNED_OUT after a failed token refresh — redirect to login.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Handle deep links — both cold-start (app opened via link) and warm (app already open)
  useEffect(() => {
    // App was opened from a deep link while closed
    Linking.getInitialURL().then(url => {
      if (url) handleAuthDeepLink(url);
    });

    // Deep link received while app is already open
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleAuthDeepLink(url);
    });

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style="dark" backgroundColor={Colors.bg} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        <Stack.Screen name="(auth)"           options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)"            options={{ animation: 'fade' }} />
        <Stack.Screen name="workspace-picker" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="chat"             options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="onboarding"       options={{ animation: 'fade' }} />
        <Stack.Screen name="reset-password"   options={{ animation: 'fade' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
