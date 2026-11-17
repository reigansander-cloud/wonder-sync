import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Plus, Trash2 } from "lucide-react";

// Reusable chain-symbol manager. Takes the outputs of useChainSymbols so the
// host hook (e.g. in the card editor) stays the single source of truth.
export default function ChainSymbolsManager({ symbols, custom, add, remove }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    const clean = name.trim();
    if (!clean) return;
    if (symbols.includes(clean)) { setErr("That chain symbol already exists."); return; }
    setErr("");
    await add(clean);
    setName("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sphinx" className="bg-white/5 border-white/10" onKeyDown={(e) => e.key === "Enter" && submit()} />
        <Button type="button" onClick={submit} className="bg-amber-500 hover:bg-amber-600 text-black"><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {symbols.map((s) => {
          const rec = custom.find((c) => c.name === s);
          return (
            <div key={s} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <Tag className="h-4 w-4 text-amber-400" />
              <span className="flex-1 font-medium">{s}</span>
              {rec ? (
                <button onClick={() => remove(rec.id)} className="text-stone-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              ) : (
                <span className="text-xs text-stone-500">default</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}