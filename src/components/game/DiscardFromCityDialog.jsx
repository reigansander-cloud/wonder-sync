import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import CardView from "./CardView";
import { ShieldIcon } from "./Icons";

// Self-discard: choose a card (or trophy) from your city to discard. If the
// player skips, the effect auto-picks (first eligible / highest-cost).
export default function DiscardFromCityDialog({ player, effect, allCardsById, onConfirm, onCancel }) {
  const isTrophy = effect?.mode === "trophy";
  const trophies = player?.trophies || [];
  const eligibleCards = isTrophy
    ? []
    : (player?.played_cards || []).filter((c) => (allCardsById?.[c.id] || c).color === effect?.color);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/10 rounded-xl p-5 max-w-md w-full text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">
            {isTrophy ? "Discard a Trophy" : `Discard a ${effect?.color || ""} Card`}
          </h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-3">
          {isTrophy
            ? "Choose a military trophy to discard."
            : `Choose a ${effect?.color || ""} card from your city to discard.`}
        </p>
        {isTrophy ? (
          trophies.length === 0 ? (
            <p className="text-sm text-stone-400">You have no trophies to discard.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
              {trophies.map((t, i) => {
                const eligible = effect?.trophyAge != null && effect?.trophyAge !== ""
                  ? String(t.age) === String(effect.trophyAge)
                  : true;
                if (!eligible) return null;
                return (
                  <button key={i} type="button" onClick={() => onConfirm(String(i))}
                    className="text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-red-500/50 p-2 transition flex flex-col items-center gap-1">
                    <ShieldIcon size={28} />
                    <span className="text-xs text-stone-300">Age {t.age}</span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          eligibleCards.length === 0 ? (
            <p className="text-sm text-stone-400">You have no {effect?.color} cards in play.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {eligibleCards.map((c) => {
                const full = allCardsById?.[c.id] || c;
                return (
                  <button key={c.id} type="button" onClick={() => onConfirm(c.id)}
                    className="text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-red-500/50 p-2 transition flex flex-col items-center gap-1">
                    <CardView card={full} size="sm" />
                  </button>
                );
              })}
            </div>
          )
        )}
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => onConfirm(null)}>Skip (auto-pick)</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}