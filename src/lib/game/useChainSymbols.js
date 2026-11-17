import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { DEFAULT_CHAIN_SYMBOLS } from "./constants";

// Merges the default chain symbols with custom ones stored in the ChainSymbol entity.
export function useChainSymbols() {
  const [symbols, setSymbols] = useState(DEFAULT_CHAIN_SYMBOLS);
  const [custom, setCustom] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ChainSymbol.list("-created_date", 200);
      setCustom(list);
      const merged = [...DEFAULT_CHAIN_SYMBOLS];
      for (const c of list) if (!merged.includes(c.name)) merged.push(c.name);
      setSymbols(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (name) => {
    const clean = name.trim();
    if (!clean) return;
    const existing = await base44.entities.ChainSymbol.filter({ name: clean });
    if (existing.length) return;
    await base44.entities.ChainSymbol.create({ name: clean });
    await load();
  }, [load]);

  const remove = useCallback(async (id) => {
    await base44.entities.ChainSymbol.delete(id);
    await load();
  }, [load]);

  return { symbols, custom, loading, add, remove, reload: load };
}