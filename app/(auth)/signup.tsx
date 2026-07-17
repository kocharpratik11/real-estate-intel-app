import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Colors, Gradients } from '@/constants/colors';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Rule({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={ruleStyles.row}>
      <Text style={[ruleStyles.dot, met && ruleStyles.dotMet]}>
        {met ? '✓' : '○'}
      </Text>
      <Text style={[ruleStyles.label, met && ruleStyles.labelMet]}>{text}</Text>
    </View>
  );
}

const ruleStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot:      { fontSize: 11, color: Colors.textMuted, width: 14 },
  dotMet:   { color: Colors.green },
  label:    { fontSize: 12, color: Colors.textMuted },
  labelMet: { color: Colors.green },
});

export default function SignupScreen() {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [emailTouched,    setEmailTouched]    = useState(false);
  const [pwTouched,       setPwTouched]       = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [accountExists,   setAccountExists]   = useState(false);
  const [sent,            setSent]            = useState(false);
  const [resending,       setResending]       = useState(false);
  const [resent,          setResent]          = useState(false);

  const emailValid   = emailRegex.test(email);
  const pwMinLen     = password.length >= 8;
  const pwHasUpper   = /[A-Z]/.test(password);
  const pwHasNumber  = /\d/.test(password);
  const pwValid      = pwMinLen && pwHasUpper && pwHasNumber;
  const confirmMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSignup = async () => {
    setEmailTouched(true);
    setPwTouched(true);
    if (!emailValid) { setError('Please enter a valid email address.'); return; }
    if (!pwValid)    { setError('Password must be at least 8 characters with one uppercase letter and one number.'); return; }
    if (!confirmMatch) { setError('Passwords do not match.'); return; }

    setLoading(true);
    setError(null);
    setAccountExists(false);

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'rei://confirm' },
    });
    setLoading(false);

    if (err) {
      // Supabase returns this when the email is already registered
      const msg = err.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
        setAccountExists(true);
      } else {
        setError(err.message);
      }
      return;
    }

    // Supabase silently succeeds for existing confirmed accounts (returns empty identities)
    // instead of an error — catch this case too
    if (data.user && data.user.identities?.length === 0) {
      setAccountExists(true);
      return;
    }

    if (!data.session) {
      setSent(true);
    } else {
      router.replace('/onboarding');
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    await supabase.auth.signUp({ email, password });
    setResending(false);
    setResent(true);
  };

  // ── Success / confirmation screen ──────────────────────────────────────────
  if (sent) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={Gradients.primary} style={styles.hero}>
          <View style={styles.logoMark}>
            <Text style={styles.logoSpark}>✉</Text>
          </View>
          <Text style={styles.appName}>Check your inbox</Text>
          <Text style={styles.tagline}>One more step to get started</Text>
        </LinearGradient>

        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formInner}>
          <Text style={styles.sentBody}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.sentEmail}>{email}</Text>
          </Text>
          <Text style={styles.sentHint}>
            Click the link in the email to activate your account. It expires in 24 hours.
          </Text>

          {resent ? (
            <View style={styles.resentRow}>
              <Text style={styles.resentText}>✓ Email resent — check your inbox.</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              activeOpacity={0.7}
              style={styles.resendBtn}
            >
              <Text style={styles.resendLabel}>
                {resending ? 'Sending…' : "Didn't receive it? Resend email"}
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

          <TouchableOpacity
            onPress={() => setSent(false)}
            activeOpacity={0.7}
            style={{ alignItems: 'center', marginTop: 12 }}
          >
            <Text style={styles.backLabel}>Wrong email? Go back</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <LinearGradient colors={Gradients.primary} style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoSpark}>✦</Text>
        </View>
        <Text style={styles.appName}>Asset Brain</Text>
        <Text style={styles.tagline}>Your portfolio's about to get a lot smarter.</Text>
      </LinearGradient>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Create your account</Text>

        {/* Value props */}
        <View style={vpStyles.container}>
          <View style={vpStyles.row}>
            <Text style={vpStyles.icon}>📊</Text>
            <Text style={vpStyles.text}>
              <Text style={vpStyles.bold}>True cash flow & metrics</Text>
              {' '}— cap rate, NOI, DSCR calculated correctly, not estimated.
            </Text>
          </View>
          <View style={vpStyles.row}>
            <Text style={vpStyles.icon}>🤖</Text>
            <Text style={vpStyles.text}>
              <Text style={vpStyles.bold}>Daily AI briefings</Text>
              {' '}— a plain-language summary of your portfolio every morning.
            </Text>
          </View>
          <View style={vpStyles.row}>
            <Text style={vpStyles.icon}>🎯</Text>
            <Text style={vpStyles.text}>
              <Text style={vpStyles.bold}>Portfolio optimizer</Text>
              {' '}— know exactly what to refinance, fix, or exit to maximise returns.
            </Text>
          </View>
        </View>

        {/* Email */}
        <Text style={styles.fieldLabel}>EMAIL</Text>
        <TextInput
          style={[
            styles.input,
            emailTouched && !emailValid && styles.inputError,
            emailTouched && emailValid  && styles.inputValid,
          ]}
          value={email}
          onChangeText={t => { setEmail(t); setError(null); setAccountExists(false); }}
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

        {/* Password */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PASSWORD</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.inputFlex,
              pwTouched && !pwValid && styles.inputError,
              pwTouched && pwValid  && styles.inputValid,
            ]}
            value={password}
            onChangeText={t => { setPassword(t); setError(null); if (!pwTouched) setPwTouched(true); }}
            onBlur={() => setPwTouched(true)}
            secureTextEntry={!showPassword}
            placeholder="Create a password"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(v => !v)}
            style={styles.eyeBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>
        {pwTouched && (
          <View style={styles.rulesBox}>
            <Rule met={pwMinLen}    text="At least 8 characters" />
            <Rule met={pwHasUpper}  text="One uppercase letter" />
            <Rule met={pwHasNumber} text="One number" />
          </View>
        )}

        {/* Confirm password */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CONFIRM PASSWORD</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.inputFlex,
              confirmPassword.length > 0 && !confirmMatch && styles.inputError,
              confirmMatch && styles.inputValid,
            ]}
            value={confirmPassword}
            onChangeText={t => { setConfirmPassword(t); setError(null); }}
            secureTextEntry={!showConfirm}
            placeholder="Re-enter your password"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
          />
          <TouchableOpacity
            onPress={() => setShowConfirm(v => !v)}
            style={styles.eyeBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && (
          <Text style={confirmMatch ? styles.matchOk : styles.matchErr}>
            {confirmMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
          </Text>
        )}

        {accountExists && (
          <View style={styles.existsBanner}>
            <Text style={styles.existsText}>
              An account with this email already exists.
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
              <Text style={styles.existsLink}>Sign in instead →</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Create Account" onPress={handleSignup} loading={loading} style={styles.btn} />

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.7}
          style={styles.switchBtn}
        >
          <Text style={styles.switchLabel}>
            Already have an account?{' '}
            <Text style={styles.switchLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const vpStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.aiCard,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.aiBorder,
    padding:         14,
    marginBottom:    24,
    gap:             10,
  },
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { fontSize: 15, marginTop: 1 },
  text: { flex: 1, fontSize: 12, color: Colors.textSub, lineHeight: 18 },
  bold: { fontWeight: '600', color: Colors.text },
});

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

  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputFlex: {
    flex:            1,
    backgroundColor: Colors.card,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    color:           Colors.text,
    fontSize:        15,
  },
  eyeBtn:  { position: 'absolute', right: 14 },
  eyeIcon: { fontSize: 16 },

  rulesBox: { marginTop: 8, paddingLeft: 2 },

  matchOk:  { color: Colors.green, fontSize: 11, marginTop: 4 },
  matchErr: { color: Colors.red,   fontSize: 11, marginTop: 4 },

  existsBanner: {
    backgroundColor: Colors.yellowBg,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.yellowBd,
    padding:         14,
    marginTop:       12,
    gap:             6,
  },
  existsText: { color: Colors.textSub, fontSize: 13 },
  existsLink: { color: Colors.yellow, fontSize: 13, fontWeight: '700' },
  error: { color: Colors.red, fontSize: 12, marginTop: 12 },
  btn:   { marginTop: 24 },

  switchBtn:   { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  switchLabel: { color: Colors.textMuted, fontSize: 13 },
  switchLink:  { color: Colors.indigo, fontWeight: '600' },

  // Sent state
  sentBody:  { color: Colors.text, fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 8 },
  sentEmail: { fontWeight: '700', color: Colors.indigo },
  sentHint:  { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  resentRow: { alignItems: 'center', marginBottom: 20 },
  resentText:{ color: Colors.green, fontSize: 13 },
  resendBtn: { alignItems: 'center', marginBottom: 20, paddingVertical: 8 },
  resendLabel: { color: Colors.indigo, fontSize: 13, fontWeight: '500' },
  backBtn:   { alignItems: 'center', paddingVertical: 8 },
  backLabel: { color: Colors.textMuted, fontSize: 13 },
});
