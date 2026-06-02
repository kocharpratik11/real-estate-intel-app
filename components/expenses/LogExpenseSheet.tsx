import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { logExpense, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/api/expenses';
import { hapticSuccess, hapticError } from '@/lib/haptics';

const today = () => new Date().toISOString().slice(0, 10);

type Props = {
  propertyId:  string;
  propertyName: string;
  visible:     boolean;
  onClose:     () => void;
  onSuccess:   () => void;
};

export function LogExpenseSheet({ propertyId, propertyName, visible, onClose, onSuccess }: Props) {
  const [amount,      setAmount]   = useState('');
  const [category,    setCategory] = useState<ExpenseCategory>(EXPENSE_CATEGORIES[0].value);
  const [description, setDesc]     = useState('');
  const [vendor,      setVendor]   = useState('');
  const [date,        setDate]     = useState(today());
  const [loading,     setLoading]  = useState(false);
  const [error,       setError]    = useState<string | null>(null);

  const reset = () => {
    setAmount(''); setDesc(''); setVendor('');
    setCategory(EXPENSE_CATEGORIES[0].value); setDate(today()); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { setError('Date must be YYYY-MM-DD'); return; }
    setLoading(true);
    setError(null);
    try {
      await logExpense({
        property_id:  propertyId,
        category,
        amount:       amt,
        expense_date: date,
        description:  description || null,
        vendor:       vendor      || null,
      });
      hapticSuccess();
      reset();
      onSuccess();
    } catch (e: any) {
      hapticError();
      setError(e.message ?? 'Failed to log expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Log Expense</Text>

            {/* Property context */}
            <View style={styles.contextRow}>
              <Text style={styles.contextIcon}>🏠</Text>
              <Text style={styles.contextName}>{propertyName}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Amount */}
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
                  selectionColor={Colors.indigo}
                />
              </View>

              {/* Category */}
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {EXPENSE_CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={[styles.chip, c.value === category && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, c.value === category && styles.chipLabelActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Date */}
              <Text style={styles.fieldLabel}>DATE</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>DESCRIPTION (optional)</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDesc}
                placeholder="e.g. Replaced water heater"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />

              {/* Vendor */}
              <Text style={styles.fieldLabel}>VENDOR (optional)</Text>
              <TextInput
                style={styles.input}
                value={vendor}
                onChangeText={setVendor}
                placeholder="e.g. Mike's Plumbing"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Button label="Log Expense" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
              <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
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
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor:      Colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    16,
    paddingBottom:        36,
    maxHeight:            '88%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  contextRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.bg,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         12,
    gap:             10,
    marginBottom:    20,
  },
  contextIcon: { fontSize: 16 },
  contextName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  fieldLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 16,
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.indigo,
    padding: 14, gap: 4,
  },
  dollarSign:  { color: Colors.textMuted, fontSize: 20, fontWeight: '600' },
  amountInput: { flex: 1, color: Colors.text, fontSize: 26, fontWeight: '700' },
  chipRow:     { marginBottom: 4 },
  chip: {
    backgroundColor: Colors.bg, borderRadius: 8, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
  },
  chipActive:      { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  chipLabel:       { color: Colors.textMuted, fontSize: 12 },
  chipLabelActive: { color: Colors.white, fontWeight: '600' },
  input: {
    backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, padding: 14, color: Colors.text, fontSize: 13,
  },
  error:       { color: Colors.red, fontSize: 12, marginTop: 8 },
  submitBtn:   { marginTop: 20 },
  cancelBtn:   { alignItems: 'center', marginTop: 12 },
  cancelLabel: { color: Colors.textMuted, fontSize: 13 },
});
