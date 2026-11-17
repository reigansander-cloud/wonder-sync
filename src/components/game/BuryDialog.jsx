import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import CardView from "./CardView";
import { effectiveCoinCost } from "@/lib/game/rules";

// Bury: choose an in-play leader to remove from the game. You gain VP equal to
// twice the leader's coin cost (A-cost leaders are always worth 6 VP).
export default function BuryDialog({ player, allCardsById, onConfirm, onCancel }) {
  const leaders = (player?.played_cards || []).filter((pc) => (allCardsById?.[pc.id] || pc).color === "leader");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/10 rounded-xl p-5 max-w-md w-full text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Bury a Leader</h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-3">Remove a leader from the game and gain VP equal to twice its coin cost.</p>
        {leaders.length === 0 ? (
          <p className="text-sm text-stone-400">You have no leaders in play.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
            {leaders.map((c) => {
              const full = allCardsById?.[c.id] || c;
              const vp = 2 * effectiveCoinCost(full);
              return (
                <button key={c.id} type="button" onClick={() => onConfirm(c.id)} className="text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-500/50 p-2 transition flex flex-col items-center gap-1">
                  <CardView card={full} size="sm" />
                  <span className="text-xs text-emerald-300 font-semibold">+{vp} VP</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => onConfirm(null)}>Skip (auto-pick)</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}