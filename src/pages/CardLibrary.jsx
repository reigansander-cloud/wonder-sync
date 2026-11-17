import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ArrowLeft, Trash2, Copy } from "lucide-react";
import CardView from "@/components/game/CardView";
import { CARD_COLORS } from "@/lib/game/constants";

function playerCountLabel(card) {
  const MAX = 7;
  let included = [...new Set((card.player_counts || []).slice())].sort((a, b) => a - b);
  if (!included.length) return "";
  const runs = [];
  let start = included[0], prev = included[0];
  for (let i = 1; i < included.length; i++) {
    if (included[i] === prev + 1) prev = included[i];
    else { runs.push([start, prev]); start = included[i]; prev = included[i]; }
  }
  runs.push([start, prev]);
  return runs.map(([a, b]) => (a === b ? `${a}` : b === MAX ? `${a}+` : `${a}-${b}`)).join(", ");
}

export default function CardLibrary() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ age: "all", color: "all", search: "" });

  const load = () => {
    setLoading(true);
    base44.entities.Card.list("-created_date", 2000).then(setCards).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = cards.filter((c) => {
    if (filter.age !== "all" && c.age !== filter.age) return false;
    if (filter.color !== "all" && c.color !== filter.color) return false;
    if (filter.search && !c.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const AGE_ORDER = { leader: 0, "1": 1, "2": 2, "3": 3 };
  const sorted = [...filtered].sort((a, b) => {
    const ad = (AGE_ORDER[a.age] ?? 9) - (AGE_ORDER[b.age] ?? 9);
    if (ad) return ad;
    const am = a.player_counts?.length ? Math.min(...a.player_counts) : 3;
    const bm = b.player_counts?.length ? Math.min(...b.player_counts) : 3;
    return am - bm;
  });

  const remove = async (id) => {
    if (!confirm("Delete this card permanently?")) return;
    await base44.entities.Card.delete(id);
    load();
  };

  const duplicate = async (c) => {
    const { id, created_date, updated_date, created_by_id, ...rest } = c;
    await base44.entities.Card.create({ ...rest, name: `${c.name} (Copy)` });
    load();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link to="/" className="inline-flex items-center text-stone-400 hover:text-white text-sm mb-6"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-display font-bold">Card Library</h1>
            <p className="text-stone-400">{cards.length} custom card{cards.length !== 1 ? "s" : ""}</p>
          </div>
          <Link to="/cards/new"><Button className="bg-amber-500 hover:bg-amber-600 text-black"><Plus className="h-4 w-4 mr-1" /> New Card</Button></Link>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Input value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} placeholder="Search by name…" className="w-56 bg-white/5 border-white/10" />
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
            {[
              { key: "all", label: "All" },
              { key: "leader", label: "Leaders" },
              { key: "1", label: "Age I" },
              { key: "2", label: "Age II" },
              { key: "3", label: "Age III" },
            ].map((t) => (
              <button key={t.key} onClick={() => setFilter({ ...filter, age: t.key })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter.age === t.key ? "bg-amber-500 text-black" : "text-stone-300 hover:bg-white/10"}`}>
                {t.label}
                <span className="ml-1.5 text-[10px] opacity-70">{t.key === "all" ? cards.length : cards.filter((c) => c.age === t.key).length}</span>
              </button>
            ))}
          </div>
          <select value={filter.color} onChange={(e) => setFilter({ ...filter, color: e.target.value })} className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm">
            <option value="all">All Colors</option>
            {CARD_COLORS.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-400 mb-4">No cards yet. The library is empty — create your first card to start playing.</p>
            <Link to="/cards/new"><Button className="bg-amber-500 hover:bg-amber-600 text-black"><Plus className="h-4 w-4 mr-1" /> Create Card</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {sorted.map((c) => (
              <div key={c.id} className="space-y-2 group">
                <Link to={`/cards/${c.id}/edit`}>
                  <CardView card={c} size="md" />
                </Link>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-stone-500">Age {c.age}</span>
                    {(() => { const pl = playerCountLabel(c); return pl ? <span className="text-[10px] text-stone-400">{pl}</span> : null; })()}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => duplicate(c)} className="opacity-0 group-hover:opacity-100 text-stone-500 hover:text-amber-400" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(c.id)} className="opacity-0 group-hover:opacity-100 text-stone-500 hover:text-red-400" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}