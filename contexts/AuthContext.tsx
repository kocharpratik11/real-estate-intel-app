/**
 * AuthContext
 *
 * Central auth state for the mobile app.
 * Handles: session loading, biometric lock (cold start only), sign-out.
 *
 * States:
 *   loading        – checking SecureStore on cold start
 *   unauthenticated – no valid session → show login
 *   locked          – valid session + biometrics enabled → show lock screen
 *   authenticated   – valid session, unlocked → show app
 */

import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import { Session } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';

// ── Storage key ───────────────────────────────────────────────────────────────
const BIOMETRIC_KEY = 'assetbrain_biometric_enabled';

// ── Types ─────────────────────────────────────────────────────────────────────
export type AuthState = 'loading' | 'unauthenticated' | 'locked' | 'authenticated';

interface AuthContextValue {
  state:                AuthState;
  session:              Session | null;
  biometricEnabled:     boolean;
  biometricAvailable:   boolean;
  signOut:              () => Promise<void>;
  unlockWithBiometrics: () => Promise<'success' | 'cancelled' | 'unavailable'>;
  setBiometricEnabled:  (enabled: boolean) => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state,              setState]              = useState<AuthState>('loading');
  const [session,            setSession]            = useState<Session | null>(null);
  const [biometricEnabled,   setBiometricEnabledState]   = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // ── On cold start: load session + biometric preference ────────────────────
  useEffect(() => {
    async function init() {
      // 1. Check hardware availability
      const hw  = await LocalAuthentication.hasHardwareAsync();
      const enr = await LocalAuthentication.isEnrolledAsync();
      const available = hw && enr;
      setBiometricAvailable(available);

      // 2. Load current session
      const { data: { session: storedSession } } = await supabase.auth.getSession();

      if (!storedSession) {
        setState('unauthenticated');
        return;
      }

      setSession(storedSession);

      // 3. Check biometric preference
      const pref = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      const bioEnabled = available && pref === 'true';
      setBiometricEnabledState(bioEnabled);

      // 4. Lock if biometrics enabled, otherwise go straight in
      setState(bioEnabled ? 'locked' : 'authenticated');
    }

    init();
  }, []);

  // ── React to auth state changes (token refresh, sign-out, sign-in) ────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setState('unauthenticated');
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          // Only move to authenticated if we're not in loading (init handles that)
          setState(prev =>
            prev === 'loading' || prev === 'locked' ? prev : 'authenticated'
          );
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Unlock with biometrics ────────────────────────────────────────────────
  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricAvailable) return 'unavailable' as const;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage:     'Unlock Asset Brain',
      fallbackLabel:     'Use Password',
      disableDeviceFallback: false,
    });

    if (result.success) {
      setState('authenticated');
      return 'success' as const;
    }

    // 'cancel' covers both user cancel and fallback button
    return 'cancelled' as const;
  }, [biometricAvailable]);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange will handle state → 'unauthenticated'
  }, []);

  // ── Toggle biometric preference ───────────────────────────────────────────
  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
    setBiometricEnabledState(enabled);
  }, []);

  return (
    <AuthContext.Provider value={{
      state,
      session,
      biometricEnabled,
      biometricAvailable,
      signOut,
      unlockWithBiometrics,
      setBiometricEnabled,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
