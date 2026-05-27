import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '@/constants/colors';
import { Badge } from '@/components/ui/Badge';

type Alert = {
  id:       string;
  severity: 'emergency' | 'warning' | 'info';
  title:    string;
  body:     string;
  action:   string;
  property: string;
  time:     string;
};

const ALERTS: Alert[] = [
  { id:'1', severity:'emergency', title:'Unit 3B vacant 47 days',            body:'Losing $1,800/mo. Market avg vacancy is 18 days.',                    action:'List Unit Now →',     property:'Maple Street',   time:'Today' },
  { id:'2', severity:'warning',   title:'2 leases expire in 28 days',        body:'Maple 1B & Oak 2A. Send renewal notices now.',                       action:'Send Renewals →',    property:'Portfolio',      time:'2d ago' },
  { id:'3', severity:'warning',   title:'Expense ratio at 62%',              body:'Pine Ridge above 50% target. Review utility costs.',                 action:'View Breakdown →',   property:'Pine Ridge',     time:'3d ago' },
  { id:'4', severity:'info',      title:'Refi opportunity: Maple St',        body:'Current rate 6.2% vs your 7.8%. Save $340/mo.',                      action:'View Analysis →',    property:'Maple Street',   time:'5d ago' },
  { id:'5', severity:'info',      title:'Oak Ave: 11.4% ROE — top performer', body:'Full occupancy + 2023 refi driving outperformance.',                action:'View Details →',     property:'Oak Avenue',     time:'1wk ago' },
];

const SEV_COLOR: Record<string, string>  = { emergency: Colors.red,    warning: Colors.yellow, info: Colors.blue };
const SEV_BG:    Record<string, string>  = { emergency: Colors.redBg,  warning: Colors.yellowBg, info: Colors.aiDark };
const SEV_BD:    Record<string, string>  = { emergency: Colors.redBd,  warning: Colors.yellowBd, info: Colors.aiBorder };

export default function AlertsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Intelligence</Text>
        <Text style={styles.sub}>{ALERTS.length} alerts this month</Text>
      </View>

      {/* Tab pills */}
      <View style={styles.tabs}>
        {['Alerts', 'Optimizer', 'Scenarios'].map((t, i) => (
          <TouchableOpacity key={t} style={[styles.tabBtn, i === 0 && styles.tabBtnActive]}>
            <Text style={[styles.tabLabel, i === 0 && styles.tabLabelActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {ALERTS.map(a => (
          <TouchableOpacity key={a.id} activeOpacity={0.8}>
            <View style={[styles.card, { backgroundColor: SEV_BG[a.severity], borderColor: SEV_BD[a.severity] }]}>
              <View style={styles.cardTop}>
                <Badge
                  variant={a.severity === 'emergency' ? 'emergency' : a.severity === 'warning' ? 'warning' : 'info'}
                  label={a.severity.toUpperCase()}
                />
                <Text style={styles.cardTime}>{a.time}</Text>
              </View>
              <Text style={styles.cardTitle}>{a.title}</Text>
              <Text style={styles.cardBody}>{a.body}</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.cardAction, { color: SEV_COLOR[a.severity] }]}>{a.action}</Text>
                <Text style={styles.cardProperty}>{a.property}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title:  { color: Colors.text, fontSize: 22, fontWeight: '700' },
  sub:    { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  tabs: {
    flexDirection:   'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginHorizontal: 16,
    marginBottom:    16,
  },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:   { borderBottomColor: Colors.blue },
  tabLabel:       { color: Colors.textMuted, fontSize: 14 },
  tabLabelActive: { color: Colors.blue, fontWeight: '600' },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    borderRadius:  12,
    borderWidth:   1,
    padding:       16,
    gap:           8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTime: { color: Colors.textMuted, fontSize: 10 },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  cardBody:  { color: Colors.textSub, fontSize: 12, lineHeight: 18 },
  cardFooter:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardAction:{ fontSize: 12, fontWeight: '600' },
  cardProperty: { color: Colors.textMuted, fontSize: 10 },
});
