import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import CardView from "@/components/game/CardView";
import { describeEffect } from "@/components/game/EffectEditor";

// Lets the player pick any card from the shared discard pile to play for free
// (the Unearth effect). Pass the full discard pile (array of card objects).
export default function UnearthDialog({ discard = [], onConfirm, onCancel }) {
  // Leaders are never playable via Unearth — exclude any leader cards (by color
  // or age) that may have entered the shared discard pile (e.g. via Bury).
  const cards = discard.filter((c) => c.color !== "leader" && c.age !== "leader");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/80">
      <div className="relative max-w-4xl w-full max-h-[80vh] overflow-y-auto rounded-xl border border-amber-500/40 bg-stone-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-amber-300">Unearth</h2>
            <p className="text-xs text-stone-400">Play any card from the discard pile for free (no resource/coin cost, no trade).</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onCancel}><X className="h-5 w-5" /></Button>
        </div>
        {cards.length === 0 ? (
          <p className="text-stone-500 text-sm py-8 text-center">The discard pile is empty.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {cards.map((c) => (
              <button key={c.id} type="button" onClick={() => onConfirm(c.id)} className="text-left hover:scale-105 transition">
                <CardView card={c} size="md" />
                <p className="text-[10px] text-stone-400 mt-1 line-clamp-2">{(c.effects || []).map(describeEffect).filter(Boolean).join(", ") || c.description || ""}</p>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/10">
          <Button variant="ghost" onClick={() => onCancel()}>Skip</Button>
          {cards.length === 0 && <Button onClick={() => onConfirm(null)}>Continue</Button>}
        </div>
      </div>
    </div>
  );
}