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
import { Session, User } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import type { Workspace } from '@/types';

// ── Storage key ───────────────────────────────────────────────────────────────
const BIOMETRIC_KEY = 'assetbrain_biometric_enabled';

// ── Types ─────────────────────────────────────────────────────────────────────
export type AuthState = 'loading' | 'unauthenticated' | 'locked' | 'authenticated';

interface AuthContextValue {
  state:                AuthState;
  session:              Session | null;
  user:                 User | null;
  workspace:            Workspace | null;
  loading:              boolean;
  biometricEnabled:     boolean;
  biometricAvailable:   boolean;
  biometricLabel:       string;   // 'Face ID' | 'Touch ID' | 'Biometrics'
  signIn:               (email: string, password: string) => Promise<{ error: any }>;
  signUp:               (email: string, password: string) => Promise<{ error: any }>;
  signOut:              () => Promise<void>;
  unlockWithBiometrics: () => Promise<'success' | 'cancelled' | 'unavailable'>;
  setBiometricEnabled:  (enabled: boolean) => Promise<void>;
  setWorkspace:         (workspace: Workspace) => void;
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
  const [workspace,          setWorkspaceState]     = useState<Workspace | null>(null);
  const [biometricEnabled,   setBiometricEnabledState]   = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel,     setBiometricLabel]     = useState('Face ID');

  // ── On cold start: load session + biometric preference ────────────────────
  useEffect(() => {
    async function init() {
      // 1. Check hardware availability + detect type
      const hw    = await LocalAuthentication.hasHardwareAsync();
      const enr   = await LocalAuthentication.isEnrolledAsync();
      const available = hw && enr;
      setBiometricAvailable(available);

      if (available) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricLabel('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricLabel('Touch ID');
        } else {
          setBiometricLabel('Biometrics');
        }
      }

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
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') {
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

  // ── Derive active workspace from user metadata whenever session changes ──
  useEffect(() => {
    const meta = session?.user?.user_metadata;
    if (meta?.current_workspace_id) {
      setWorkspaceState(prev =>
        prev?.id === meta.current_workspace_id
          ? prev
          : { id: meta.current_workspace_id, name: meta.current_workspace_name ?? '', role: prev?.role ?? 'operator' }
      );
    } else if (!session) {
      setWorkspaceState(null);
    }
  }, [session]);

  // ── Sign in / sign up ─────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  }, []);

  // ── Set active workspace (persists to user metadata, mirrors workspace-picker) ──
  const setWorkspace = useCallback((ws: Workspace) => {
    setWorkspaceState(ws);
    supabase.auth.updateUser({
      data: { current_workspace_id: ws.id, current_workspace_name: ws.name },
    }).catch(() => {});
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
    setWorkspaceState(null);
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
      user: session?.user ?? null,
      workspace,
      loading: state === 'loading',
      biometricEnabled,
      biometricAvailable,
      biometricLabel,
      signIn,
      signUp,
      signOut,
      unlockWithBiometrics,
      setBiometricEnabled,
      setWorkspace,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
