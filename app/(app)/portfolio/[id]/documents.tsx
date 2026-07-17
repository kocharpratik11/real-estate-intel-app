import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

const DOCUMENTS_BUCKET = 'documents';

type Doc = {
  id: string;
  filename: string;
  storage_path: string;
  document_type: string | null;
  document_date: string | null;
};

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('documents')
      .select('id, filename, storage_path, document_type, document_date')
      .eq('property_id', id)
      .eq('archived', false)
      .order('document_date', { ascending: false });
    setDocuments((data ?? []) as Doc[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDocument = async (doc: Doc) => {
    const { data } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path, 3600);
    if (data?.signedUrl) {
      await WebBrowser.openBrowserAsync(data.signedUrl);
    }
  };

  const getIcon = (filename: string): keyof typeof Ionicons.glyphMap => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'document-text';
    if (ext && ['png', 'jpg', 'jpeg', 'heic'].includes(ext)) return 'image';
    return 'document';
  };

  if (loading) return <SafeAreaView style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No documents yet</Text>
            <Text style={styles.emptySubtext}>
              Upload documents from the web app
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.docRow}
            onPress={() => openDocument(item)}
          >
            <View style={styles.docIcon}>
              <Ionicons
                name={getIcon(item.filename)}
                size={24}
                color={Colors.blue}
              />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docName} numberOfLines={1}>
                {item.filename}
              </Text>
              <Text style={styles.docMeta}>
                {(item.document_type ?? 'document').replace(/_/g, ' ')}
                {item.document_date ? ` · ${new Date(item.document_date).toLocaleDateString()}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtext: { fontSize: 14, color: Colors.textMuted },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.aiCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: { flex: 1 },
  docName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  docMeta: { fontSize: 12, color: Colors.textMuted, textTransform: 'capitalize' },
});
