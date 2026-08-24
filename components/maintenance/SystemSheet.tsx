import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Sheet, BottomSheetScrollView } from '@/components/ui/Sheet';
import {
  createPropertySystem, updatePropertySystem, deletePropertySystem,
  SYSTEM_TYPES, type SystemType, type PropertySystem,
} from '@/lib/api/propertySystems';
import { hapticSuccess, hapticError } from '@/lib/haptics';

type Props = {
  propertyId:   string;
  propertyName: string;
  system?:      PropertySystem | null;   // present = editing an existing system
  visible:      boolean;
  onClose:      () => void;
  onSuccess:    () => void;
};

export function SystemSheet({ propertyId, propertyName, system, visible, onClose, onSuccess }: Props) {
  const isEdit = !!system;

  const [type,      setType]      = useState<SystemType>(system?.system_type ?? SYSTEM_TYPES[0].value);
  const [installed, setInstalled] = useState(system?.installed_date ?? '');
  const [serviced,  setServiced]  = useState(system?.last_serviced_date ?? '');
  const [lifespan,  setLifespan]  = useState(system?.estimated_lifespan_years != null ? String(system.estimated_lifespan_years) : '');
  const [cost,      setCost]      = useState(system?.replacement_cost_estimate != null ? String(system.replacement_cost_estimate) : '');
  const [notes,     setNotes]     = useState(system?.notes ?? '');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const reset = () => {
    setType(system?.system_type ?? SYSTEM_TYPES[0].value);
    setInstalled(system?.installed_date ?? '');
    setServiced(system?.last_serviced_date ?? '');
    setLifespan(system?.estimated_lifespan_years != null ? String(system.estimated_lifespan_years) : '');
    setCost(system?.replacement_cost_estimate != null ? String(system.replacement_cost_estimate) : '');
    setNotes(system?.notes ?? '');
    setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    const lifespanNum = lifespan ? parseInt(lifespan, 10) : null;
    if (lifespan && (isNaN(lifespanNum!) || lifespanNum! < 0)) { setError('Enter a valid lifespan'); return; }
    const costNum = cost ? parseFloat(cost) : null;
    if (cost && (isNaN(costNum!) || costNum! < 0)) { setError('Enter a valid replacement cost'); return; }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        system_type:                type,
        installed_date:             installed || null,
        last_serviced_date:         serviced  || null,
        estimated_lifespan_years:   lifespanNum,
        replacement_cost_estimate:  costNum,
        notes:                      notes.trim() || null,
      };
      if (isEdit && system) {
        await updatePropertySystem(system.id, payload);
      } else {
        await createPropertySystem({ property_id: propertyId, ...payload });
      }
      hapticSuccess();
      reset();
      onSuccess();
    } catch (e: any) {
      hapticError();
      setError(e.message ?? 'Failed to save system');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!system) return;
    setLoading(true);
    setError(null);
    try {
      await deletePropertySystem(system.id);
      hapticSuccess();
      onSuccess();
    } catch (e: any) {
      hapticError();
      setError(e.message ?? 'Failed to remove system');
      setLoading(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={handleClose}>
      <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isEdit ? 'Edit System' : 'New System'}</Text>

        <View style={styles.contextRow}>
          <Text style={styles.contextIcon}>⚙️</Text>
          <Text style={styles.contextName}>{propertyName}</Text>
        </View>

        <Text style={styles.hint}>
          Track ages of major systems (HVAC, roof, water heater, etc.) so Asset Brain can flag replacements before they become emergencies.
        </Text>

        <Text style={styles.fieldLabel}>SYSTEM</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {SYSTEM_TYPES.map(t => (
            <TouchableOpacity
              key={t.value}
              onPress={() => setType(t.value)}
              style={[styles.chip, t.value === type && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, t.value === type && styles.chipLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>INSTALLED DATE (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={installed}
          onChangeText={setInstalled}
          placeholder="e.g. 2015-06-01"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.indigo}
        />

        <Text style={styles.fieldLabel}>LAST SERVICED (optional)</Text>
        <TextInput
          style={styles.input}
          value={serviced}
          onChangeText={setServiced}
          placeholder="e.g. 2023-09-15"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.indigo}
        />

        <Text style={styles.fieldLabel}>EXPECTED LIFESPAN (years, optional)</Text>
        <TextInput
          style={styles.input}
          value={lifespan}
          onChangeText={setLifespan}
          keyboardType="number-pad"
          placeholder="e.g. 15"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.indigo}
        />

        <Text style={styles.fieldLabel}>REPLACEMENT COST ESTIMATE (optional)</Text>
        <View style={styles.amountRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={cost}
            onChangeText={setCost}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
          />
        </View>

        <Text style={styles.fieldLabel}>NOTES (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Brand, model, warranty info..."
          placeholderTextColor={Colors.textMuted}
          multiline
          selectionColor={Colors.indigo}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          label={isEdit ? 'Save Changes' : 'Add System'}
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
        />
        {isEdit && (
          <Button
            label="Remove System"
            variant="danger"
            onPress={handleDelete}
            loading={loading}
            style={styles.deleteBtn}
          />
        )}
        <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom:     36,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  contextRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 10, marginBottom: 12,
  },
  contextIcon: { fontSize: 16 },
  contextName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  hint:        { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 8 },
  fieldLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, padding: 14, color: Colors.text, fontSize: 13,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  chipRow: { marginBottom: 4 },
  chip: {
    backgroundColor: Colors.bg, borderRadius: 8, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
  },
  chipActive:      { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  chipLabel:       { color: Colors.textMuted, fontSize: 12 },
  chipLabelActive: { color: Colors.white, fontWeight: '600' },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 4,
  },
  dollarSign:  { color: Colors.textMuted, fontSize: 20, fontWeight: '600' },
  amountInput: { flex: 1, color: Colors.text, fontSize: 22, fontWeight: '700' },
  error:       { color: Colors.red, fontSize: 12, marginTop: 8 },
  submitBtn:   { marginTop: 20 },
  deleteBtn:   { marginTop: 10 },
  cancelBtn:   { alignItems: 'center', marginTop: 12 },
  cancelLabel: { color: Colors.textMuted, fontSize: 13 },
});
