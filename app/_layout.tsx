import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LockedScreen from './locked';

SplashScreen.preventAutoHideAsync();

async function checkForUpdate() {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // No update channel in dev — silently ignore
  }
}

/**
 * Parse and handle a Supabase auth deep link.
 *
 * rei://confirm#access_token=...&refresh_token=...&type=signup
 * rei://reset-password#access_token=...&refresh_token=...&type=recovery
 */
async function handleAuthDeepLink(url: string) {
  if (!url.startsWith('rei://')) return;

  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return;

  const params       = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken  = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type         = params.get('type');

  if (!accessToken || !refreshToken) return;

  const { data, error } = await supabase.auth.setSession({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) return;

  if (type === 'recovery') {
    router.replace('/reset-password');
  } else {
    const wsId = data.session.user?.user_metadata?.current_workspace_id;
    router.replace(wsId ? '/workspace-picker' : '/onboarding');
  }
}

// ── Inner layout — has access to AuthContext ──────────────────────────────────
function RootLayoutInner() {
  const { state } = useAuth();

  useEffect(() => {
    SplashScreen.hideAsync();
    if (!__DEV__) checkForUpdate();
  }, []);

  // Deep link handling
  useEffect(() => {
    Linking.getInitialURL().then(url => { if (url) handleAuthDeepLink(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url));
    return () => sub.remove();
  }, []);

  // Show lock screen as a full overlay when state is 'locked'
  if (state === 'locked') {
    return <LockedScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
      <Stack.Screen name="(auth)"           options={{ animation: 'fade' }} />
      <Stack.Screen name="(app)"            options={{ animation: 'fade' }} />
      <Stack.Screen name="workspace-picker" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      <Stack.Screen name="chat"             options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      <Stack.Screen name="onboarding"       options={{ animation: 'fade' }} />
      <Stack.Screen name="reset-password"   options={{ animation: 'fade' }} />
    </Stack>
  );
}

// ── Root layout — wraps everything in AuthProvider ────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style="dark" backgroundColor={Colors.bg} />
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
