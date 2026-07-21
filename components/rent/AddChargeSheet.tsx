import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { createOneOffCharge } from '@/lib/api/rent';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import type { Lease } from '@/types';

type Props = {
  propertyId:     string;
  activeLeases:   Lease[];
  defaultLeaseId?: string;
  visible:        boolean;
  onClose:        () => void;
  onSuccess:      () => void;
};

const CHARGE_TYPES = [
  { value: 'late_fee',         label: 'Late Fee' },
  { value: 'security_deposit', label: 'Security Deposit' },
  { value: 'pet_fee',          label: 'Pet Fee' },
  { value: 'other',            label: 'Other' },
] as const;
type ChargeType = typeof CHARGE_TYPES[number]['value'];

const today = () => new Date().toISOString().slice(0, 10);

const PLACEHOLDERS: Record<ChargeType, string> = {
  late_fee:         'e.g. Late fee for Apr',
  security_deposit: 'e.g. Security deposit',
  pet_fee:          'e.g. Pet deposit',
  other:            'Describe the charge',
};

export function AddChargeSheet({ propertyId, activeLeases, defaultLeaseId, visible, onClose, onSuccess }: Props) {
  const [leaseId,     setLeaseId]     = useState(defaultLeaseId ?? activeLeases[0]?.id ?? '');
  const [chargeType,  setChargeType]  = useState<ChargeType>('late_fee');
  const [description, setDescription] = useState('');
  const [amount,       setAmount]     = useState('');
  const [dueDate,      setDueDate]    = useState(today());
  const [notes,        setNotes]      = useState('');
  const [loading,      setLoading]    = useState(false);
  const [error,        setError]      = useState<string | null>(null);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
    if (!leaseId) { setError('Select a unit'); return; }
    if (chargeType === 'other' && !description.trim()) { setError('Description is required for "Other" charges'); return; }
    setLoading(true);
    setError(null);
    try {
      await createOneOffCharge({
        propertyId,
        leaseId,
        chargeType,
        chargeDescription: description.trim() || undefined,
        amount: amt,
        dueDate,
        notes: notes.trim() || undefined,
      });
      hapticSuccess();
      onSuccess();
    } catch (e: any) {
      hapticError();
      setError(e.message ?? 'Failed to add charge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Add One-Off Charge</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Unit / lease picker */}
              {activeLeases.length > 1 && (
                <>
                  <Text style={styles.fieldLabel}>UNIT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {activeLeases.map(l => (
                      <TouchableOpacity
                        key={l.id}
                        onPress={() => setLeaseId(l.id)}
                        style={[styles.chip, leaseId === l.id && styles.chipActive]}
                      >
                        <Text style={[styles.chipLabel, leaseId === l.id && styles.chipLabelActive]}>
                          {l.units?.label ?? 'Unit'} — ${l.monthly_rent.toLocaleString()}/mo
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Charge type */}
              <Text style={styles.fieldLabel}>CHARGE TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {CHARGE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setChargeType(t.value)}
                    style={[styles.chip, chargeType === t.value && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, chargeType === t.value && styles.chipLabelActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Description */}
              <Text style={styles.fieldLabel}>
                DESCRIPTION {chargeType === 'other' ? '(required)' : '(optional)'}
              </Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder={PLACEHOLDERS[chargeType]}
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.blue}
              />

              {/* Amount + Due date */}
              <Text style={styles.fieldLabel}>AMOUNT</Text>
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.blue}
                />
              </View>

              <Text style={styles.fieldLabel}>DUE DATE</Text>
              <TextInput
                style={styles.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.blue}
              />

              {/* Notes */}
              <Text style={styles.fieldLabel}>NOTE (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add a note..."
                placeholderTextColor={Colors.textMuted}
                multiline
                selectionColor={Colors.blue}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Button label="Add Charge" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent:  'flex-end',
  },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom:     36,
    maxHeight:         '88%',
  },
  handle: {
    width:           40,
    height:          4,
    backgroundColor: Colors.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    16,
  },
  title: {
    color:      Colors.text,
    fontSize:   18,
    fontWeight: '700',
    marginBottom: 16,
  },
  fieldLabel: {
    color:      Colors.textMuted,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop:   16,
  },
  chipRow: { marginBottom: 4 },
  chip: {
    backgroundColor:   Colors.bg,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: 12,
    paddingVertical:   8,
    marginRight:       8,
  },
  chipActive:      { backgroundColor: Colors.blue, borderColor: Colors.blue },
  chipLabel:       { color: Colors.textMuted, fontSize: 12 },
  chipLabelActive: { color: Colors.white, fontWeight: '600' },
  input: {
    backgroundColor: Colors.bg,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    color:           Colors.text,
    fontSize:        13,
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  amountRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.bg,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     Colors.blue,
    padding:         14,
    gap:             4,
  },
  dollarSign: { color: Colors.textMuted, fontSize: 20, fontWeight: '600' },
  amountInput: {
    flex:      1,
    color:     Colors.text,
    fontSize:  26,
    fontWeight:'700',
  },
  error: { color: Colors.red, fontSize: 12, marginTop: 12 },
  submitBtn: { marginTop: 20 },
  cancelBtn: { alignItems: 'center', marginTop: 12 },
  cancelLabel: { color: Colors.textMuted, fontSize: 13 },
});
