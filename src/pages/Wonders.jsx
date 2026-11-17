import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Trash2 } from "lucide-react";
import { WONDERS, builtinWonderOverride } from "@/lib/game/constants";

export default function Wonders() {
  const [wonders, setWonders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const ws = await base44.entities.Wonder.list("-created_date", 200);
      // Ensure the three built-in wonders are present as editable art overrides.
      const have = new Set((ws || []).map((w) => w.builtin_id).filter(Boolean));
      const missing = WONDERS.map(builtinWonderOverride).filter((w) => !have.has(w.builtin_id));
      let all = ws || [];
      if (missing.length) {
        const created = await base44.entities.Wonder.bulkCreate(missing);
        all = [...(created || []), ...all];
      }
      setWonders(all);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("Delete this wonder permanently?")) return;
    await base44.entities.Wonder.delete(id);
    load();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link to="/" className="inline-flex items-center text-stone-400 hover:text-white text-sm mb-6"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-display font-bold">Wonders</h1>
            <p className="text-stone-400">{wonders.length} custom wonder{wonders.length !== 1 ? "s" : ""}</p>
          </div>
          <Link to="/wonders/new"><Button className="bg-amber-500 hover:bg-amber-600 text-black"><Plus className="h-4 w-4 mr-1" /> New Wonder</Button></Link>
        </div>

        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : wonders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-400 mb-4">No custom wonders yet. Each wonder has a day and night side, each with a starting resource and up to 3 tiers.</p>
            <Link to="/wonders/new"><Button className="bg-amber-500 hover:bg-amber-600 text-black"><Plus className="h-4 w-4 mr-1" /> Create Wonder</Button></Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {wonders.map((w) => (
              <div key={w.id} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 group">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: w.color || "#d4a64a" }} />
                  <Link to={`/wonders/${w.id}/edit`} className="font-semibold flex-1 hover:text-amber-300">{w.name}</Link>
                  {w.builtin_id && <span className="text-[10px] text-amber-300 border border-amber-500/40 rounded px-1">built-in</span>}
                  {!w.builtin_id && <button onClick={() => remove(w.id)} className="opacity-0 group-hover:opacity-100 text-stone-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <p className="text-xs text-stone-400">Day: {w.day?.stages?.length || 0} tiers · Night: {w.night?.stages?.length || 0} tiers</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}