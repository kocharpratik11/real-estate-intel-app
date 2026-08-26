import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import type { PropertyInsightData, Move } from '@/lib/api/propertyInsights';

const fmt = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString()}`;
const RISK_COLOR: Record<string, string> = { Low: Colors.green, Medium: Colors.yellow, High: Colors.red };

export function IntelligenceTab({ data }: { data: PropertyInsightData | null }) {
  if (!data) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>✨</Text>
        <Text style={styles.emptyTitle}>No AI analysis yet</Text>
        <Text style={styles.emptySub}>Insights are generated nightly and usually appear within 24 hours of adding a property.</Text>
      </View>
    );
  }

  const moves = [...data.moves].sort((a, b) => a.rank - b.rank);

  return (
    <View>
      <Text style={styles.disclaimerTop}>
        AI-generated educational analysis — not financial advice.
        {data.computedAt ? `  Last updated ${new Date(data.computedAt).toLocaleDateString()}.` : ''}
        {data.isStale ? '  Due for refresh.' : ''}
      </Text>

      {data.situationSummary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>{data.situationSummary}</Text>
        </View>
      )}

      {data.urgentAction?.exists && (
        <View style={styles.urgentCard}>
          <Text style={styles.urgentTitle}>
            ⚡ Action Needed{data.urgentAction.daysUntilDeadline != null ? ` — ${data.urgentAction.daysUntilDeadline} days` : ''}
          </Text>
          <Text style={styles.urgentDesc}>{data.urgentAction.description}</Text>
        </View>
      )}

      {moves.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>SCENARIOS TO EXPLORE</Text>
          {moves.map(m => <MoveCard key={m.rank} move={m} />)}
        </>
      )}

      {data.avoidList.length > 0 && (
        <View style={styles.avoidCard}>
          <Text style={styles.avoidTitle}>What The Data Suggests Avoiding</Text>
          {data.avoidList.map((item, i) => (
            <View key={i} style={styles.avoidRow}>
              <Text style={styles.avoidX}>✗</Text>
              <Text style={styles.avoidText}>
                <Text style={styles.avoidBold}>{item.option}: </Text>{item.reason}
              </Text>
            </View>
          ))}
        </View>
      )}

      {data.bottomLine && (
        <View style={styles.bottomCard}>
          <Text style={styles.bottomLabel}>BOTTOM LINE</Text>
          <Text style={styles.bottomText}>{data.bottomLine}</Text>
          {data.projectedReturn && (
            <View style={styles.returnsRow}>
              <ReturnStat label="Current" value={fmt(data.projectedReturn.current)} />
              <ReturnStat label="Illustrative" value={fmt(data.projectedReturn.afterMoves)} positive />
              <ReturnStat label="Difference" value={`+${fmt(data.projectedReturn.difference)}`} positive />
            </View>
          )}
        </View>
      )}

      {data.disclaimer && <Text style={styles.disclaimerBottom}>{data.disclaimer}</Text>}
    </View>
  );
}

function ReturnStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.returnLabel}>{label}</Text>
      <Text style={[styles.returnValue, positive && { color: Colors.green }]}>{value}</Text>
    </View>
  );
}

function MoveCard({ move }: { move: Move }) {
  const [expanded, setExpanded] = useState(false);
  const riskColor = RISK_COLOR[move.risk] ?? Colors.yellow;
  return (
    <TouchableOpacity style={styles.moveCard} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
      <View style={styles.moveTop}>
        <View style={styles.moveRank}><Text style={styles.moveRankText}>{move.rank}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.moveTitle}>{move.title}</Text>
          <Text style={styles.moveDesc} numberOfLines={expanded ? undefined : 3}>{move.description}</Text>
          <View style={styles.moveTags}>
            <View style={[styles.tag, { backgroundColor: riskColor + '1A' }]}>
              <Text style={[styles.tagText, { color: riskColor }]}>{move.risk} Risk</Text>
            </View>
            <View style={styles.tag}><Text style={styles.tagText}>{move.effort} Effort</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>{move.timeline}</Text></View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.moveImpact, { color: move.annualImpact >= 0 ? Colors.green : Colors.red }]}>
            {move.annualImpact >= 0 ? '+' : '-'}{fmt(move.annualImpact)}
          </Text>
          <Text style={styles.moveImpactLabel}>illus./yr</Text>
        </View>
      </View>
      {expanded && (
        <View style={styles.moveExpanded}>
          <Text style={styles.expandedLabel}>WHY THIS SCENARIO</Text>
          <Text style={styles.expandedText}>{move.why}</Text>
          <Text style={[styles.expandedLabel, { marginTop: 10 }]}>FIRST STEP TO EXPLORE</Text>
          <Text style={styles.expandedText}>{move.howTo}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  disclaimerTop: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 14 },
  summaryCard: { backgroundColor: Colors.aiCard, borderWidth: 1, borderColor: Colors.aiBorder, borderRadius: 12, padding: 14, marginBottom: 12 },
  summaryText: { color: Colors.text, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  urgentCard: { backgroundColor: Colors.yellowBg, borderWidth: 1, borderColor: Colors.yellowBd, borderRadius: 12, padding: 14, marginBottom: 12 },
  urgentTitle: { color: Colors.yellow, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  urgentDesc: { color: Colors.textSub, fontSize: 13, lineHeight: 18 },
  sectionLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  moveCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  moveTop: { flexDirection: 'row', gap: 10 },
  moveRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.aiCard, alignItems: 'center', justifyContent: 'center' },
  moveRankText: { color: Colors.indigo, fontSize: 11, fontWeight: '700' },
  moveTitle: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  moveDesc: { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
  moveTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  moveImpact: { fontSize: 14, fontWeight: '700' },
  moveImpactLabel: { color: Colors.textMuted, fontSize: 9 },
  moveExpanded: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 12, paddingTop: 12, gap: 4 },
  expandedLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  expandedText: { color: Colors.textSub, fontSize: 12, lineHeight: 17 },
  avoidCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, marginBottom: 12, marginTop: 4 },
  avoidTitle: { color: Colors.text, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  avoidRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  avoidX: { color: Colors.red, fontWeight: '700' },
  avoidText: { flex: 1, color: Colors.textSub, fontSize: 12, lineHeight: 17 },
  avoidBold: { fontWeight: '700', color: Colors.text },
  bottomCard: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, marginBottom: 12 },
  bottomLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  bottomText: { color: Colors.text, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  returnsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  returnLabel: { color: Colors.textMuted, fontSize: 10, marginBottom: 3 },
  returnValue: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  disclaimerBottom: { color: Colors.textMuted, fontSize: 10, lineHeight: 15 },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingBottom: 24, gap: 8, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
