import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { hapticSuccess } from '@/lib/haptics';

type Step = 'workspace' | 'done';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();

  const [step,          setStep]          = useState<Step>('workspace');
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) { setError('Workspace name is required'); return; }
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create workspace
      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .insert({ name: workspaceName.trim(), created_by: user.id })
        .select('id, name')
        .single();

      if (wsErr || !ws) throw new Error(wsErr?.message ?? 'Failed to create workspace');

      // Add creator as owner member
      const { error: memberErr } = await supabase.from('workspace_members').insert({
        workspace_id: ws.id,
        user_id:      user.id,
        role:         'owner',
      });
      if (memberErr) throw new Error(memberErr.message ?? 'Failed to set up workspace membership');

      // Update user metadata with active workspace
      await supabase.auth.updateUser({
        data: {
          current_workspace_id:   ws.id,
          current_workspace_name: ws.name,
          current_workspace_role: 'owner',
        },
      });

      hapticSuccess();
      setStep('done');
    } catch (e: any) {
      setError(e.message ?? 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    router.replace('/(app)');
  };

  const handleAddProperty = () => {
    router.replace('/(app)/portfolio/add');
  };

  // ── Step: workspace ──────────────────────────────────────────────────────
  if (step === 'workspace') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <LinearGradient colors={['#6366F1', '#7C3AED']} style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          <View style={styles.logoMark}>
            <Text style={styles.logoSpark}>✦</Text>
          </View>
          <Text style={styles.appName}>ASSET BRAIN</Text>
          <Text style={styles.heading}>Build your portfolio brain</Text>
          <Text style={styles.sub}>Your command centre for every property, unit, and tenant.</Text>
        </LinearGradient>

        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={[styles.formInner, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step 1 of 2</Text>
          </View>

          <Text style={styles.fieldLabel}>WORKSPACE NAME</Text>
          <TextInput
            style={styles.input}
            value={workspaceName}
            onChangeText={t => { setWorkspaceName(t); setError(null); }}
            placeholder="e.g. My Real Estate Portfolio"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
            autoFocus
          />
          <Text style={styles.hint}>You can rename this later in Settings.</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>✦  What happens next</Text>
            <Text style={styles.infoBody}>
              Add your properties and Asset Brain will calculate your real cash flow, cap rate, and DSCR — then brief you on your portfolio every morning with AI.
            </Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Create Workspace"
            onPress={handleCreateWorkspace}
            loading={loading}
            style={styles.btn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step: done ───────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { justifyContent: 'center', paddingHorizontal: 24 }]}>
      <LinearGradient
        colors={['#6366F1', '#7C3AED']}
        style={[styles.successHero, { paddingTop: insets.top + 40 }]}
      >
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successTitle}>You're all set!</Text>
        <Text style={styles.successSub}>
          Your workspace <Text style={{ fontWeight: '700' }}>"{workspaceName}"</Text> has been created.
        </Text>
      </LinearGradient>

      <View style={[styles.successContent, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.stepBadge2}>Step 2 of 2 — Optional</Text>
        <Text style={styles.successPrompt}>Would you like to add your first property?</Text>

        <TouchableOpacity style={styles.addPropertyBtn} onPress={handleAddProperty} activeOpacity={0.8}>
          <Text style={styles.addPropertyIcon}>🏠</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.addPropertyTitle}>Add a property</Text>
            <Text style={styles.addPropertySub}>Name, address, type, and financial details</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleFinish} style={styles.skipBtn} activeOpacity={0.7}>
          <Text style={styles.skipLabel}>Skip for now — I'll add properties later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: {
    alignItems:        'center',
    paddingBottom:     32,
    paddingHorizontal: 24,
    gap:               6,
  },
  logoMark: {
    width:           48,
    height:          48,
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    6,
  },
  logoSpark: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  appName:   {
    color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: -2,
  },
  heading: { color: Colors.white, fontSize: 20, fontWeight: '700', marginTop: 4 },
  sub:     { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center' },

  formScroll: { flex: 1, backgroundColor: Colors.bg },
  formInner: { padding: 24, paddingTop: 28 },

  stepBadge: {
    alignSelf: 'flex-start', marginBottom: 20,
    backgroundColor: Colors.aiCard, borderRadius: 8, borderWidth: 1, borderColor: Colors.aiBorder,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  stepBadgeText: { color: Colors.indigo, fontSize: 11, fontWeight: '700' },

  fieldLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, padding: 14, color: Colors.text, fontSize: 15,
  },
  hint:  { color: Colors.textMuted, fontSize: 11, marginTop: 4, marginBottom: 16 },
  infoCard: {
    backgroundColor: Colors.aiCard, borderRadius: 10, borderWidth: 1, borderColor: Colors.aiBorder,
    padding: 14, marginVertical: 8,
  },
  infoTitle: { color: Colors.indigo, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  infoBody:  { color: Colors.textSub, fontSize: 12, lineHeight: 18 },
  error:     { color: Colors.red, fontSize: 12, marginTop: 8 },
  btn:       { marginTop: 20 },

  // Done step
  successHero: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 24,
    paddingBottom:     40,
    gap:               10,
  },
  successEmoji: { fontSize: 48 },
  successTitle: { color: Colors.white, fontSize: 24, fontWeight: '700' },
  successSub:   { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  successContent: {
    backgroundColor: Colors.bg,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepBadge2: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 12,
  },
  successPrompt: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  addPropertyBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12, marginBottom: 12,
  },
  addPropertyIcon:  { fontSize: 22 },
  addPropertyTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  addPropertySub:   { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  chevron:          { color: Colors.textMuted, fontSize: 20 },
  skipBtn:          { alignItems: 'center', paddingVertical: 16 },
  skipLabel:        { color: Colors.textMuted, fontSize: 13 },
});
