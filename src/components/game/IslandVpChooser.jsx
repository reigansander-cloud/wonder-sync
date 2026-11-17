import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, MapPin } from "lucide-react";
import CardView from "@/components/game/CardView";

export default function IslandVpChooser({ player, allCardsById, vpAmount, onConfirm, onClose }) {
  const islands = (player.played_cards || []).filter((c) => {
    const full = allCardsById[c.id] || c;
    return full.is_island || full.pack === "island" || !full.color;
  });
  const [chosen, setChosen] = useState(() => new Set(player.island_vp_choices || []));

  const toggle = (id) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/80">
      <div className="bg-stone-900 border border-white/20 rounded-xl max-w-2xl w-full p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-amber-300 flex items-center gap-2"><MapPin className="h-5 w-5" /> Choose Islands for VP</h3>
            <p className="text-xs text-stone-400 mt-1">{vpAmount} VP per selected island · {chosen.size} selected = {vpAmount * chosen.size} VP</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        {islands.length === 0 ? (
          <p className="text-stone-500 text-sm py-4 text-center">You have no island cards.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {islands.map((c, i) => {
              const on = chosen.has(c.id);
              return (
                <button key={i} type="button" onClick={() => toggle(c.id)} className={`relative rounded-lg border-2 transition p-1 ${on ? "border-amber-400 bg-amber-400/15" : "border-white/10 hover:border-white/30"}`}>
                  <CardView card={allCardsById[c.id] || c} size="sm" />
                  {on && <span className="absolute top-1 right-1 bg-amber-400 text-black text-[10px] font-bold rounded-full px-1.5">✓</span>}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-black" onClick={() => { onConfirm([...chosen]); onClose(); }}>Save ({chosen.size})</Button>
        </div>
      </div>
    </div>
  );
}