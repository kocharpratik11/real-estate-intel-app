import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { createTicket, updateTicket, updateTicketStatus, MAINTENANCE_CATEGORIES, type MaintenanceCategory } from '@/lib/api/maintenance';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import type { MaintenanceEvent } from '@/types';

type Priority = MaintenanceEvent['priority'];
type Status   = MaintenanceEvent['status'];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low',    label: 'Low',    color: Colors.textMuted },
  { value: 'normal', label: 'Normal', color: Colors.indigo },
  { value: 'high',   label: 'High',   color: Colors.yellow },
  { value: 'urgent', label: 'Urgent', color: Colors.red },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: 'requested',   label: 'Requested' },
  { value: 'scheduled',   label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
];

type Props = {
  propertyId:   string;
  propertyName: string;
  ticket?:      MaintenanceEvent | null;   // present = edit/close an existing ticket
  visible:      boolean;
  onClose:      () => void;
  onSuccess:    () => void;
};

export function TicketSheet({ propertyId, propertyName, ticket, visible, onClose, onSuccess }: Props) {
  const isEdit = !!ticket;

  const [title,      setTitle]      = useState(ticket?.title ?? '');
  const [desc,       setDesc]       = useState(ticket?.description ?? '');
  const [category,   setCategory]   = useState<MaintenanceCategory>((ticket?.category as MaintenanceCategory) ?? MAINTENANCE_CATEGORIES[0].value);
  const [priority,   setPriority]   = useState<Priority>(ticket?.priority ?? 'normal');
  const [status,     setStatus]     = useState<Status>(ticket?.status ?? 'requested');
  const [estCost,    setEstCost]    = useState(ticket?.estimated_cost != null ? String(ticket.estimated_cost) : '');
  const [actualCost, setActualCost] = useState(ticket?.actual_cost != null ? String(ticket.actual_cost) : '');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const reset = () => {
    setTitle(ticket?.title ?? ''); setDesc(ticket?.description ?? '');
    setCategory((ticket?.category as MaintenanceCategory) ?? MAINTENANCE_CATEGORIES[0].value);
    setPriority(ticket?.priority ?? 'normal');
    setStatus(ticket?.status ?? 'requested');
    setEstCost(ticket?.estimated_cost != null ? String(ticket.estimated_cost) : '');
    setActualCost(ticket?.actual_cost != null ? String(ticket.actual_cost) : '');
    setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    const cost = estCost ? parseFloat(estCost) : null;
    if (estCost && (isNaN(cost!) || cost! < 0)) { setError('Enter a valid estimated cost'); return; }
    let actual: number | undefined;
    if (status === 'completed' && actualCost) {
      actual = parseFloat(actualCost);
      if (isNaN(actual) || actual < 0) { setError('Enter a valid actual cost'); return; }
    }
    setLoading(true);
    setError(null);
    try {
      if (isEdit && ticket) {
        await updateTicket(ticket.id, {
          title:          title.trim(),
          description:    desc || null,
          category,
          priority,
          estimated_cost: cost,
        });
        if (status !== ticket.status) {
          await updateTicketStatus(ticket.id, status, status === 'completed' ? { actual_cost: actual } : undefined);
        }
      } else {
        await createTicket({
          property_id:    propertyId,
          title:          title.trim(),
          description:    desc || null,
          category,
          priority,
          estimated_cost: cost,
        });
      }
      hapticSuccess();
      reset();
      onSuccess();
    } catch (e: any) {
      hapticError();
      setError(e.message ?? 'Failed to save ticket');
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
            <Text style={styles.title}>{isEdit ? 'Edit Maintenance Ticket' : 'New Maintenance Ticket'}</Text>

            {/* Property context */}
            <View style={styles.contextRow}>
              <Text style={styles.contextIcon}>🔧</Text>
              <Text style={styles.contextName}>{propertyName}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Status (edit only) */}
              {isEdit && (
                <>
                  <Text style={styles.fieldLabel}>STATUS</Text>
                  <View style={styles.statusRow}>
                    {STATUSES.map(s => (
                      <TouchableOpacity
                        key={s.value}
                        onPress={() => setStatus(s.value)}
                        style={[styles.chip, status === s.value && styles.chipActive]}
                      >
                        <Text style={[styles.chipLabel, status === s.value && styles.chipLabelActive]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Title */}
              <Text style={styles.fieldLabel}>ISSUE TITLE</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Leaking kitchen faucet"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />

              {/* Priority */}
              <Text style={styles.fieldLabel}>PRIORITY</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p.value}
                    onPress={() => setPriority(p.value)}
                    style={[styles.priorityBtn, priority === p.value && { borderColor: p.color, backgroundColor: p.color + '1A' }]}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.priorityLabel, priority === p.value && { color: p.color, fontWeight: '700' }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category */}
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {MAINTENANCE_CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={[styles.chip, c.value === category && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, c.value === category && styles.chipLabelActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Description */}
              <Text style={styles.fieldLabel}>DESCRIPTION (optional)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={desc ?? ''}
                onChangeText={setDesc}
                placeholder="Describe the issue in detail..."
                placeholderTextColor={Colors.textMuted}
                multiline
                selectionColor={Colors.indigo}
              />

              {/* Estimated cost */}
              <Text style={styles.fieldLabel}>ESTIMATED COST (optional)</Text>
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={estCost}
                  onChangeText={setEstCost}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.indigo}
                />
              </View>

              {/* Actual cost — only relevant once marked completed */}
              {isEdit && status === 'completed' && (
                <>
                  <Text style={styles.fieldLabel}>ACTUAL COST (optional)</Text>
                  <View style={styles.amountRow}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={actualCost}
                      onChangeText={setActualCost}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      selectionColor={Colors.indigo}
                    />
                  </View>
                </>
              )}

              {error && <Text style={styles.error}>{error}</Text>}

              <Button
                label={isEdit ? 'Save Changes' : 'Submit Ticket'}
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitBtn}
              />
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 10, marginBottom: 20,
  },
  contextIcon: { fontSize: 16 },
  contextName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  fieldLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, padding: 14, color: Colors.text, fontSize: 13,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg, borderRadius: 8, borderWidth: 1,
    borderColor: Colors.border, paddingVertical: 10, gap: 6,
  },
  priorityDot:   { width: 8, height: 8, borderRadius: 4 },
  priorityLabel: { color: Colors.textMuted, fontSize: 12 },
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
  cancelBtn:   { alignItems: 'center', marginTop: 12 },
  cancelLabel: { color: Colors.textMuted, fontSize: 13 },
});
