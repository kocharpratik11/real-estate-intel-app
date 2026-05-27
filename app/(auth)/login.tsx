import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) { setError('Enter your email and password'); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.replace('/workspace-picker');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>REI</Text>
          </View>
          <Text style={styles.appName}>Real Estate Intel</Text>
          <Text style={styles.tagline}>Your portfolio, intelligently managed</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.blue}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.blue}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Sign In" onPress={handleLogin} loading={loading} style={styles.btn} />

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotLabel}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.bg },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 48 },
  logo: {
    width:           64,
    height:          64,
    borderRadius:    16,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  logoText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  appName:  { color: Colors.text, fontSize: 22, fontWeight: '700', marginBottom: 6 },
  tagline:  { color: Colors.textMuted, fontSize: 13 },
  form:     { gap: 4 },
  fieldLabel: {
    color:      Colors.textMuted,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
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
  error: { color: Colors.red, fontSize: 12, marginTop: 8 },
  btn:   { marginTop: 24 },
  forgotBtn:  { alignItems: 'center', marginTop: 16 },
  forgotLabel: { color: Colors.blue, fontSize: 13 },
});
