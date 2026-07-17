import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Gradients } from '@/constants/colors';
import { Badge } from '@/components/ui/Badge';
import { NewLeaseSheet } from '@/components/leases/NewLeaseSheet';
import type { Lease, RentPayment } from '@/types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt    = (n: number) => `$${n.toLocaleString()}`;

export default function UnitDetailScreen() {
  const { id: propertyId, unitId } = useLocalSearchParams<{ id: string; unitId: string }>();
  const insets = useSafeAreaInsets();

  const [unit,        setUnit]        = useState<any>(null);
  const [lease,       setLease]       = useState<Lease | null>(null);
  const [tenants,     setTenants]     = useState<any[]>([]);
  const [history,     setHistory]     = useState<RentPayment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showNewLease, setShowNewLease] = useState(false);
  const [workspaceId,  setWorkspaceId]  = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setWorkspaceId(user?.user_metadata?.current_workspace_id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!unitId) return;

    Promise.all([
      supabase.from('units').select('*').eq('id', unitId).single(),
      supabase
        .from('leases')
        .select('*, units(label)')
        .eq('unit_id', unitId)
        .eq('status', 'active')
        .maybeSingle(),
    ]).then(async ([{ data: u }, { data: l }]) => {
      setUnit(u);
      setLease(l as Lease | null);

      if (l) {
        const { data: lt } = await supabase
          .from('lease_tenants')
          .select('tenants(id, first_name, last_name, email, phone)')
          .eq('lease_id', l.id);
        setTenants((lt ?? []).map((r: any) => r.tenants).filter(Boolean));

        const { data: rp } = await supabase
          .from('rent_payments')
          .select('id, period_year, period_month, amount_due, amount_paid, status, due_date')
          .eq('lease_id', l.id)
          .eq('charge_type', 'rent')
          .order('period_year', { ascending: false })
          .order('period_month', { ascending: false })
          .limit(6);
        setHistory((rp ?? []) as any[]);
      }

      setLoading(false);
    });
  }, [unitId]);

  const tenant     = tenants[0] ?? null;
  const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}` : null;
  const initials   = tenantName ? tenantName.split(' ').map((w: string) => w[0]).join('').slice(0, 2) : '?';
  const leaseEnd   = lease?.end_date ? new Date(lease.end_date) : null;
  const daysLeft   = leaseEnd ? Math.round((leaseEnd.getTime() - Date.now()) / 86400000) : null;

  return (
    <View style={[s.root, { backgroundColor: Colors.indigo }]}>
      {/* Gradient tenant hero */}
      <LinearGradient
        colors={Gradients.primary}
        style={[s.hero, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={s.backWrap}>
          <Text style={s.back}>‹ {unit?.label ?? 'Unit'}</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={Colors.white} style={{ marginVertical: 24 }} />
        ) : tenant ? (
          <>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials.toUpperCase()}</Text>
            </View>
            <Text style={s.tenantName}>{tenantName}</Text>
            <Text style={s.tenantSub}>{unit?.label}</Text>
            <View style={s.contactRow}>
              {tenant.phone && (
                <TouchableOpacity
                  style={s.contactBtn}
                  onPress={() => Linking.openURL(`tel:${tenant.phone}`)}
                >
                  <Text style={s.contactIcon}>📞</Text>
                  <Text style={s.contactLabel}>Call</Text>
                </TouchableOpacity>
              )}
              {tenant.email && (
                <TouchableOpacity
                  style={s.contactBtn}
                  onPress={() => Linking.openURL(`mailto:${tenant.email}`)}
                >
                  <Text style={s.contactIcon}>✉️</Text>
                  <Text style={s.contactLabel}>Email</Text>
                </TouchableOpacity>
              )}
              {tenant.phone && (
                <TouchableOpacity
                  style={s.contactBtn}
                  onPress={() => Linking.openURL(`sms:${tenant.phone}`)}
                >
                  <Text style={s.contactIcon}>💬</Text>
                  <Text style={s.contactLabel}>Text</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={s.vacantIcon}>🏠</Text>
            <Text style={s.vacantTitle}>Unit is vacant</Text>
            <Text style={s.vacantSub}>{unit?.label}</Text>
            <TouchableOpacity
              style={s.createLeaseBtn}
              onPress={() => setShowNewLease(true)}
              activeOpacity={0.8}
            >
              <Text style={s.createLeaseBtnLabel}>+ Create Lease</Text>
            </TouchableOpacity>
          </>
        )}
      </LinearGradient>

      {/* New Lease Sheet */}
      {unit && workspaceId && !lease && (
        <NewLeaseSheet
          unitId={unitId ?? ''}
          unitLabel={unit?.label ?? 'Unit'}
          workspaceId={workspaceId}
          visible={showNewLease}
          onClose={() => setShowNewLease(false)}
          onSuccess={() => {
            setShowNewLease(false);
            // Reload the screen to show new lease
            if (unitId) {
              Promise.all([
                supabase.from('units').select('*').eq('id', unitId).single(),
                supabase.from('leases').select('*, units(label)').eq('unit_id', unitId).eq('status', 'active').maybeSingle(),
              ]).then(([{ data: u }, { data: l }]) => {
                setUnit(u);
                setLease(l as Lease | null);
              });
            }
          }}
        />
      )}

      {/* Scrollable sections */}
      {!loading && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={s.scroll}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 40 }}
        >
          {/* Lease card */}
          {lease && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>LEASE</Text>
              <View style={s.card}>
                <View style={s.leaseHeader}>
                  <Badge variant="active" label="ACTIVE" />
                  {daysLeft !== null && (
                    <Text style={[s.daysLeft, { color: daysLeft < 60 ? Colors.yellow : Colors.textMuted }]}>
                      {daysLeft > 0 ? `Expires in ${daysLeft} days` : 'Expired'}
                    </Text>
                  )}
                </View>
                <View style={s.leaseGrid}>
                  {[
                    ['Start',   lease.start_date],
                    ['End',     lease.end_date ?? 'Month-to-month'],
                    ['Rent',    fmt(lease.monthly_rent) + ' / mo'],
                    ['Deposit', '—'],
                  ].map(([label, val]) => (
                    <View key={label} style={s.leaseField}>
                      <Text style={s.leaseFieldLabel}>{label}</Text>
                      <Text style={s.leaseFieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Payment history */}
          {history.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>PAYMENT HISTORY</Text>
              <View style={s.card}>
                <View style={s.historyRow}>
                  {[...history].reverse().map((p) => {
                    const isPaid = p.status === 'paid';
                    const isLate = p.status === 'late';
                    const mon    = p.period_month ? MONTHS[(p.period_month - 1)] : '?';
                    return (
                      <View key={p.id} style={s.historyChip}>
                        <View style={[s.historyBar, {
                          backgroundColor: isPaid ? Colors.greenBg : isLate ? Colors.redBg : Colors.yellowBg,
                          borderColor:     isPaid ? Colors.green  : isLate ? Colors.red    : Colors.yellow,
                        }]}>
                          <Text style={[s.historyMonth, {
                            color: isPaid ? Colors.green : isLate ? Colors.red : Colors.yellow,
                          }]}>{mon}</Text>
                          <Text style={[s.historyCheck, {
                            color: isPaid ? Colors.green : isLate ? Colors.red : Colors.yellow,
                          }]}>{isPaid ? '✓' : isLate ? '✗' : '~'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(app)/portfolio/[id]/rent', params: { id: propertyId! } })}
                >
                  <Text style={s.viewLedger}>View full ledger →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Unit details */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>UNIT DETAILS</Text>
            <View style={s.card}>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Unit</Text>
                <Text style={s.detailValue}>{unit?.label}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     24,
    gap:               8,
    alignItems:        'center',
  },
  backWrap: { alignSelf: 'flex-start', marginBottom: 8 },
  back:     { color: 'rgba(255,255,255,0.8)', fontSize: 13 },

  avatar: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.4)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  tenantName: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  tenantSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  contactRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  contactBtn: {
    flex:            1,
    alignItems:      'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius:    10,
    paddingVertical: 10,
    gap:             4,
  },
  contactIcon:  { fontSize: 18 },
  contactLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },

  vacantIcon:  { fontSize: 36 },
  vacantTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  vacantSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  createLeaseBtn: {
    backgroundColor:   'rgba(255,255,255,0.2)',
    borderRadius:      10,
    paddingHorizontal: 20,
    paddingVertical:   10,
    marginTop:         4,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.35)',
  },
  createLeaseBtnLabel: { color: Colors.white, fontSize: 13, fontWeight: '700' },

  scroll: { backgroundColor: Colors.bg },

  section:      { marginHorizontal: 16, marginBottom: 20 },
  sectionLabel: {
    color:         Colors.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.8,
    marginBottom:  8,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    gap:             10,
  },
  leaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  daysLeft:    { fontSize: 11 },
  leaseGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  leaseField:  { width: '50%', paddingVertical: 8 },
  leaseFieldLabel: { color: Colors.textMuted, fontSize: 10 },
  leaseFieldValue: { color: Colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },

  historyRow:  { flexDirection: 'row', gap: 6 },
  historyChip: { flex: 1 },
  historyBar:  {
    borderRadius:    6,
    borderWidth:     1,
    paddingVertical: 6,
    alignItems:      'center',
    gap:             2,
  },
  historyMonth: { fontSize: 9, fontWeight: '700' },
  historyCheck: { fontSize: 10 },
  viewLedger:   { color: Colors.blue, fontSize: 12, textAlign: 'right', marginTop: 4 },

  detailRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingVertical:   8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: { color: Colors.textMuted, fontSize: 13 },
  detailValue: { color: Colors.text, fontSize: 13, fontWeight: '600' },
});
