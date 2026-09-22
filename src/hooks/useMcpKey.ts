import { useEffect, useState, useCallback } from 'react';
import {
  McpKeyItem,
  getMcpKeys,
  getActiveMcpKey,
  saveMcpKey,
  setActiveMcpKey,
  deleteMcpKey,
  subscribeMcpKeyChanges,
  DEFAULT_SERVER_URL,
} from '../utils/mcpStorage';

export function useMcpKey() {
  const [keys, setKeys] = useState<McpKeyItem[]>([]);
  const [activeKey, setActiveKey] = useState<McpKeyItem | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const all = await getMcpKeys();
      setKeys(all);
      const currentActive = all.find(k => k.isActive) || (all.length > 0 ? all[0] : null);
      setActiveKey(currentActive);
    } catch (e) {
      console.warn('Failed to load MCP keys', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeMcpKeyChanges(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const saveKey = useCallback(async (item: Omit<McpKeyItem, 'id' | 'createdAt'> & { id?: string }) => {
    const saved = await saveMcpKey(item);
    await refresh();
    return saved;
  }, [refresh]);

  const selectActive = useCallback(async (id: string) => {
    await setActiveMcpKey(id);
    await refresh();
  }, [refresh]);

  const removeKey = useCallback(async (id: string) => {
    await deleteMcpKey(id);
    await refresh();
  }, [refresh]);

  return {
    keys,
    activeKey,
    loading,
    refresh,
    saveKey,
    selectActive,
    removeKey,
    defaultServerUrl: DEFAULT_SERVER_URL,
  };
}
