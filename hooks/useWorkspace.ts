import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Workspace } from '@/types';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('workspace_members')
      .select('role, workspaces(id, name)')
      .order('created_at');

    if (err) { setError(err.message); setLoading(false); return; }

    const seen = new Set<string>();
    const unique = (data ?? [])
      .map((row: any) => ({ id: row.workspaces.id, name: row.workspaces.name, role: row.role }))
      .filter((ws: any) => seen.has(ws.id) ? false : (seen.add(ws.id), true));
    setWorkspaces(unique);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { workspaces, loading, error, reload: load };
}
