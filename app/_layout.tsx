import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { initSentry, Sentry } from '@/lib/sentry';
import LockedScreen from './locked';

// Initialize as early as possible so startup crashes are captured too.
initSentry();

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
    router.replace({
      pathname: '/reset-password',
      params: { access_token: accessToken, refresh_token: refreshToken },
    });
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

  // Redirect to login whenever auth state drops to unauthenticated (sign-out, expired session)
  useEffect(() => {
    if (state === 'unauthenticated') {
      router.replace('/(auth)/login');
    }
  }, [state]);

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

function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={crashStyles.root}>
      <Text style={crashStyles.icon}>⚠️</Text>
      <Text style={crashStyles.title}>Something went wrong</Text>
      <Text style={crashStyles.body}>
        Asset Brain hit an unexpected error. It's been reported automatically — try again below.
      </Text>
      <TouchableOpacity style={crashStyles.btn} onPress={resetError} activeOpacity={0.85}>
        <Text style={crashStyles.btnLabel}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const crashStyles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  icon:  { fontSize: 40 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  body:  { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  btn:   { backgroundColor: Colors.indigo, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginTop: 12 },
  btnLabel: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});

// ── Root layout — wraps everything in AuthProvider ────────────────────────────
function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutWithErrorBoundary() {
  return (
    <Sentry.ErrorBoundary fallback={CrashFallback}>
      <RootLayout />
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayoutWithErrorBoundary);
