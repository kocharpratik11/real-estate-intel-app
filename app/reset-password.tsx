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

function Rule({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={ruleStyles.row}>
      <Text style={[ruleStyles.dot, met && ruleStyles.dotMet]}>{met ? '✓' : '○'}</Text>
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

export default function ResetPasswordScreen() {
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [pwTouched,       setPwTouched]       = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [done,            setDone]            = useState(false);

  const pwMinLen    = password.length >= 8;
  const pwHasUpper  = /[A-Z]/.test(password);
  const pwHasNumber = /\d/.test(password);
  const pwValid     = pwMinLen && pwHasUpper && pwHasNumber;
  const confirmMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async () => {
    setPwTouched(true);
    if (!pwValid)      { setError('Password must be at least 8 characters with one uppercase letter and one number.'); return; }
    if (!confirmMatch) { setError('Passwords do not match.'); return; }

    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setDone(true);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#6366F1', '#7C3AED']} style={styles.hero}>
          <View style={styles.logoMark}>
            <Text style={styles.logoSpark}>✓</Text>
          </View>
          <Text style={styles.appName}>Password updated</Text>
          <Text style={styles.tagline}>You're all set</Text>
        </LinearGradient>

        <View style={styles.formInner}>
          <Text style={styles.sentBody}>
            Your password has been changed successfully.{'\n'}Sign in with your new password.
          </Text>
          <Button
            label="Sign In"
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: 24 }}
          />
        </View>
      </View>
    );
  }

  // ── Reset form ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <LinearGradient colors={['#6366F1', '#7C3AED']} style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoSpark}>🔑</Text>
        </View>
        <Text style={styles.appName}>Set new password</Text>
        <Text style={styles.tagline}>Choose a strong password</Text>
      </LinearGradient>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Create a new password</Text>

        {/* New password */}
        <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
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
            placeholder="At least 8 characters"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
            autoComplete="new-password"
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
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
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CONFIRM NEW PASSWORD</Text>
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
            autoComplete="new-password"
          />
          <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
            <Text style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && (
          <Text style={confirmMatch ? styles.matchOk : styles.matchErr}>
            {confirmMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
          </Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Update Password" onPress={handleSubmit} loading={loading} style={styles.btn} />
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
    marginBottom: 24,
  },
  fieldLabel: {
    color:         Colors.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.8,
    marginBottom:  6,
  },
  inputRow:  { flexDirection: 'row', alignItems: 'center' },
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
  inputError: { borderColor: Colors.red },
  inputValid:  { borderColor: Colors.green },
  eyeBtn:     { position: 'absolute', right: 14 },
  eyeIcon:    { fontSize: 16 },

  rulesBox: { marginTop: 8, paddingLeft: 2 },

  matchOk:  { color: Colors.green, fontSize: 11, marginTop: 4 },
  matchErr: { color: Colors.red,   fontSize: 11, marginTop: 4 },

  error: { color: Colors.red, fontSize: 12, marginTop: 12 },
  btn:   { marginTop: 24 },

  sentBody: {
    color:      Colors.text,
    fontSize:   15,
    textAlign:  'center',
    lineHeight: 24,
    marginBottom: 8,
  },
});
