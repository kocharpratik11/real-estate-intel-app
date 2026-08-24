import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Sheet, BottomSheetScrollView } from '@/components/ui/Sheet';
import { updatePreferences, type UserPreferences } from '@/lib/api/preferences';
import { hapticSuccess } from '@/lib/haptics';

type Props = {
  visible:   boolean;
  onDone:    () => void;
};

// Matches web's PreferencesModal.tsx exactly — same DB CHECK constraints, same copy.
const GOALS: { value: UserPreferences['primary_goal']; label: string; sub: string }[] = [
  { value: 'cash_flow',    label: 'Maximum Cash Flow',     sub: 'Steady monthly income from rent' },
  { value: 'appreciation', label: 'Long-Term Appreciation', sub: 'Property value growth over time' },
  { value: 'payoff',       label: 'Pay Off Mortgages',      sub: 'Faster debt payoff over new deals' },
  { value: 'expand',       label: 'Grow My Portfolio',      sub: 'Acquiring more properties' },
];

const RISK_LEVELS: { value: UserPreferences['risk_tolerance']; label: string; sub: string }[] = [
  { value: 'conservative', label: 'Safety First', sub: 'I prefer guaranteed, stable returns' },
  { value: 'moderate',     label: 'Balanced',     sub: 'Some growth, some stability' },
  { value: 'growth',       label: 'Growth',       sub: 'I can handle volatility for higher returns' },
];

const STYLES: { value: UserPreferences['communication_style']; label: string; sub: string }[] = [
  { value: 'concise',  label: 'Concise',  sub: 'Short answers, numbers first' },
  { value: 'detailed', label: 'Detailed', sub: 'Full explanations welcome' },
];

/**
 * Shown once, right after workspace setup, when user_preferences.onboarding_completed
 * is false. Feeds risk_tolerance/primary_goal/communication_style into Asset Brain's
 * system prompt (see mobile-chat/index.ts buildSystemPrompt rule 10) so chat responses
 * match how the user actually wants to be talked to.
 */
export function PreferencesSheet({ visible, onDone }: Props) {
  const [goal,  setGoal]  = useState<UserPreferences['primary_goal'] | null>(null);
  const [risk,  setRisk]  = useState<UserPreferences['risk_tolerance'] | null>(null);
  const [style, setStyle] = useState<UserPreferences['communication_style'] | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = goal !== null && risk !== null && style !== null;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await updatePreferences({
        primary_goal:         goal,
        risk_tolerance:       risk,
        communication_style:  style,
        onboarding_completed: true,
      });
      hapticSuccess();
      onDone();
    } catch {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await updatePreferences({ onboarding_completed: true });
    } catch {
      // Non-critical — worst case we ask again next launch.
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <Sheet visible={visible} onClose={handleSkip} snapPoints={['85%']}>
      <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Help Asset Brain understand you</Text>
        <Text style={styles.subtitle}>
          Three quick questions so your AI briefings and chat answers match how you invest.
        </Text>

        <OptionGroup label="WHAT'S YOUR PRIMARY GOAL?" options={GOALS} value={goal} onChange={setGoal} />
        <OptionGroup label="RISK TOLERANCE" options={RISK_LEVELS} value={risk} onChange={setRisk} />
        <OptionGroup label="COMMUNICATION STYLE" options={STYLES} value={style} onChange={setStyle} />

        <Button
          label="Save Preferences"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave}
          style={styles.saveBtn}
        />
        <TouchableOpacity onPress={handleSkip} disabled={saving} style={styles.skipBtn}>
          <Text style={styles.skipLabel}>Skip for now</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </Sheet>
  );
}

function OptionGroup<T extends string>({
  label, options, value, onChange,
}: {
  label:    string;
  options:  { value: T; label: string; sub: string }[];
  value:    T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.groupCard}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.option, i < options.length - 1 && styles.optionBorder]}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionSub}>{opt.sub}</Text>
            </View>
            <View style={[styles.radio, value === opt.value && styles.radioSelected]}>
              {value === opt.value && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content:  { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  title:    { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: Colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 20 },

  group:      { marginBottom: 18 },
  groupLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  groupCard: {
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  option: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   12,
    gap:               12,
  },
  optionBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  optionLabel:  { color: Colors.text, fontSize: 14, fontWeight: '600' },
  optionSub:    { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.indigo },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.indigo },

  saveBtn:   { marginTop: 8 },
  skipBtn:   { alignItems: 'center', paddingVertical: 14 },
  skipLabel: { color: Colors.textMuted, fontSize: 13 },
});
