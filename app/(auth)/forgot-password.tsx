import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [email,        setEmail]        = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [sent,         setSent]         = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [resending,    setResending]    = useState(false);
  const [resent,       setResent]       = useState(false);

  const emailValid = emailRegex.test(email);

  const sendReset = async (addr: string) => {
    const { error: err } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: 'rei://reset-password',
    });
    return err;
  };

  const handleSubmit = async () => {
    setEmailTouched(true);
    if (!emailValid) { setError('Please enter a valid email address.'); return; }

    setLoading(true);
    setError(null);
    const err = await sendReset(email);
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    await sendReset(email);
    setResending(false);
    setResent(true);
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (sent) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#6366F1', '#7C3AED']} style={styles.hero}>
          <View style={styles.logoMark}>
            <Text style={styles.logoSpark}>✉</Text>
          </View>
          <Text style={styles.appName}>Check your inbox</Text>
          <Text style={styles.tagline}>Reset link on its way</Text>
        </LinearGradient>

        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formInner}>
          <Text style={styles.sentBody}>
            We sent a reset link to{'\n'}
            <Text style={styles.sentEmail}>{email}</Text>
          </Text>
          <Text style={styles.sentHint}>
            Click the link in the email to set a new password. The link expires in 1 hour.
          </Text>

          {resent ? (
            <View style={styles.resentRow}>
              <Text style={styles.resentText}>✓ Link resent — check your inbox.</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              activeOpacity={0.7}
              style={styles.resendBtn}
            >
              <Text style={styles.resendLabel}>
                {resending ? 'Sending…' : "Didn't receive it? Resend link"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <Text style={styles.backLabel}>← Back to sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Request form ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <LinearGradient colors={['#6366F1', '#7C3AED']} style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoSpark}>🔒</Text>
        </View>
        <Text style={styles.appName}>Forgot password?</Text>
        <Text style={styles.tagline}>We'll send you a reset link</Text>
      </LinearGradient>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Reset your password</Text>
        <Text style={styles.sectionSubtitle}>
          Enter your email and we'll send you a link to set a new password.
        </Text>

        <Text style={styles.fieldLabel}>EMAIL</Text>
        <TextInput
          style={[
            styles.input,
            emailTouched && !emailValid && styles.inputError,
            emailTouched && emailValid  && styles.inputValid,
          ]}
          value={email}
          onChangeText={t => { setEmail(t); setError(null); }}
          onBlur={() => setEmailTouched(true)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.indigo}
        />
        {emailTouched && !emailValid && (
          <Text style={styles.fieldError}>Please enter a valid email address</Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label={loading ? 'Sending…' : 'Send Reset Link'} onPress={handleSubmit} loading={loading} style={styles.btn} />

        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <Text style={styles.backLabel}>← Back to sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  hero: {
    paddingTop:    72,
    paddingBottom: 40,
    alignItems:    'center',
    gap:           8,
  },
  logoMark: {
    width:           64,
    height:          64,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },
  logoSpark: { color: Colors.white, fontSize: 28, fontWeight: '700' },
  appName:   { color: Colors.white, fontSize: 24, fontWeight: '700' },
  tagline:   { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  formScroll: { flex: 1, backgroundColor: Colors.bg },
  formInner:  { padding: 24, paddingTop: 28, paddingBottom: 40 },

  sectionTitle: {
    color:        Colors.text,
    fontSize:     18,
    fontWeight:   '700',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color:        Colors.textMuted,
    fontSize:     13,
    lineHeight:   20,
    marginBottom: 24,
  },
  fieldLabel: {
    color:         Colors.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.8,
    marginBottom:  6,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    color:           Colors.text,
    fontSize:        15,
  },
  inputError: { borderColor: Colors.red },
  inputValid:  { borderColor: Colors.green },
  fieldError:  { color: Colors.red, fontSize: 11, marginTop: 4 },

  error: { color: Colors.red, fontSize: 12, marginTop: 12 },
  btn:   { marginTop: 24 },

  backBtn:   { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  backLabel: { color: Colors.textMuted, fontSize: 13 },

  // Sent state
  sentBody:   { color: Colors.text, fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 8 },
  sentEmail:  { fontWeight: '700', color: Colors.indigo },
  sentHint:   { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  resentRow:  { alignItems: 'center', marginBottom: 20 },
  resentText: { color: Colors.green, fontSize: 13 },
  resendBtn:  { alignItems: 'center', marginBottom: 20, paddingVertical: 8 },
  resendLabel: { color: Colors.indigo, fontSize: 13, fontWeight: '500' },
});
