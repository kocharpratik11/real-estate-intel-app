import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

function getStorage() {
  if (Platform.OS === 'web') {
    return {
      getItem:    (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem:    (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
      removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
    };
  }
  // Native: chunk values >2048 bytes across multiple SecureStore keys
  const CHUNK = 1800;
  async function getItem(key: string): Promise<string | null> {
    const first = await SecureStore.getItemAsync(key);
    if (!first) return null;
    try {
      const { chunks } = JSON.parse(first);
      if (!chunks) return first;
      const parts = await Promise.all(
        Array.from({ length: chunks }, (_, i) => SecureStore.getItemAsync(`${key}_chunk_${i}`))
      );
      return parts.join('');
    } catch {
      return first;
    }
  }
  async function setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
    await SecureStore.setItemAsync(key, JSON.stringify({ chunks: parts.length }));
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}_chunk_${i}`, p)));
  }
  async function removeItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(key);
    if (meta) {
      try {
        const { chunks } = JSON.parse(meta);
        if (chunks) await Promise.all(
          Array.from({ length: chunks }, (_, i) => SecureStore.deleteItemAsync(`${key}_chunk_${i}`))
        );
      } catch {}
    }
    await SecureStore.deleteItemAsync(key);
  }
  return { getItem, setItem, removeItem };
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    storage:          getStorage(),
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});
