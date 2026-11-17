import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import CardView from "./CardView";
import { describeEffect } from "./EffectEditor";

// Lets the player pick an island card from the age's island pool to play for
// free (the Gain Island effect). Pass the available islands for the effect's age.
export default function GainIslandDialog({ islands = [], onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/80">
      <div className="relative max-w-4xl w-full max-h-[80vh] overflow-y-auto rounded-xl border border-emerald-500/40 bg-stone-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-emerald-300">Gain an Island</h2>
            <p className="text-xs text-stone-400">Choose an island card to play for free (no resource/coin cost, no trade).</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onCancel}><X className="h-5 w-5" /></Button>
        </div>
        {islands.length === 0 ? (
          <p className="text-stone-500 text-sm py-8 text-center">No island cards are available for this age.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {islands.map((c) => (
              <button key={c.id} type="button" onClick={() => onConfirm(c.id)} className="text-left hover:scale-105 transition">
                <CardView card={c} size="md" />
                <p className="text-[10px] text-stone-400 mt-1 line-clamp-2">{(c.effects || []).map(describeEffect).filter(Boolean).join(", ") || c.description || ""}</p>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/10">
          <Button variant="ghost" onClick={() => onCancel()}>Skip</Button>
        </div>
      </div>
    </div>
  );
}