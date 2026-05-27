import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useWorkspaces } from '@/hooks/useWorkspace';
import { Colors } from '@/constants/colors';

const INITIALS = (name: string) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const ACCENT_PAIRS = [
  [Colors.blue,   Colors.purple],
  [Colors.purple, Colors.indigo],
  [Colors.green,  Colors.blue],
  [Colors.indigo, Colors.blue],
];

export default function WorkspacePickerScreen() {
  const { workspaces, loading } = useWorkspaces();
  const [selecting, setSelecting] = useState<string | null>(null);

  const selectWorkspace = async (wsId: string, wsName: string) => {
    setSelecting(wsId);
    // Store selected workspace in user metadata for easy retrieval
    await supabase.auth.updateUser({
      data: { current_workspace_id: wsId, current_workspace_name: wsName },
    });
    setSelecting(null);
    router.replace('/(app)');
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>REI</Text>
        </View>
        <Text style={styles.heading}>Choose a workspace</Text>
        <Text style={styles.sub}>Select the portfolio you want to manage</Text>
      </View>

      {loading
        ? <ActivityIndicator color={Colors.blue} style={{ marginTop: 40 }} />
        : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {workspaces.map((ws, i) => {
              const [c1, c2] = ACCENT_PAIRS[i % ACCENT_PAIRS.length];
              const isSelecting = selecting === ws.id;
              return (
                <TouchableOpacity
                  key={ws.id}
                  onPress={() => selectWorkspace(ws.id, ws.name)}
                  disabled={!!selecting}
                  activeOpacity={0.8}
                >
                  <View style={styles.card}>
                    {/* Avatar */}
                    <View style={[styles.avatar, { backgroundColor: c1 }]}>
                      <Text style={styles.avatarText}>{INITIALS(ws.name)}</Text>
                    </View>

                    {/* Info */}
                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text style={styles.wsName}>{ws.name}</Text>
                        <View style={[
                          styles.roleBadge,
                          { borderColor: ws.role === 'owner' ? Colors.aiBorder : Colors.greenBd }
                        ]}>
                          <Text style={[
                            styles.roleText,
                            { color: ws.role === 'owner' ? Colors.blue : Colors.green }
                          ]}>
                            {ws.role.charAt(0).toUpperCase() + ws.role.slice(1)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.wsSub}>{ws.role === 'owner' ? 'Owner' : 'Manager'}</Text>
                    </View>

                    {isSelecting
                      ? <ActivityIndicator size="small" color={Colors.blue} />
                      : <Text style={styles.chevron}>›</Text>
                    }
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Create new */}
            <TouchableOpacity style={styles.createBtn} activeOpacity={0.8}>
              <Text style={styles.createLabel}>+   Create new workspace</Text>
            </TouchableOpacity>

            {/* Sign in to another account */}
            <TouchableOpacity style={styles.switchBtn} onPress={async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            }}>
              <Text style={styles.switchLabel}>Sign in to another account</Text>
            </TouchableOpacity>
          </ScrollView>
        )
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  logoWrap: { alignItems: 'center', paddingTop: 40, paddingBottom: 24 },
  logo: {
    width:           56,
    height:          56,
    borderRadius:    16,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  logoText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  heading:  { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  sub:      { color: Colors.textMuted, fontSize: 13 },
  list: { paddingHorizontal: 16, gap: 12, paddingBottom: 40 },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.aiDark,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     Colors.aiBorder,
    padding:         16,
    gap:             14,
  },
  avatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  info:    { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  wsName:  { color: Colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  roleBadge: {
    borderRadius:  4,
    borderWidth:   1,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  roleText: { fontSize: 9, fontWeight: '700' },
  wsSub:    { color: Colors.textMuted, fontSize: 11 },
  chevron:  { color: Colors.textMuted, fontSize: 20 },
  createBtn: {
    backgroundColor: Colors.bg,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    alignItems:      'center',
    marginTop:       4,
  },
  createLabel: { color: Colors.textMuted, fontSize: 14 },
  switchBtn:   { alignItems: 'center', paddingVertical: 12 },
  switchLabel: { color: Colors.blue, fontSize: 13 },
});
