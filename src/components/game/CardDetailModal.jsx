import React from "react";
import { X } from "lucide-react";
import CardView from "./CardView";
import { describeEffect } from "./EffectEditor";

// Full-card detail overlay: shows the card image alongside its description and
// a readable breakdown of every effect. Used when a player clicks a card in
// their own city.
export default function CardDetailModal({ card, onClose }) {
  if (!card) return null;
  const effects = card.effects || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="relative flex flex-col md:flex-row gap-4 max-w-3xl w-full items-stretch md:items-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center">
          <CardView card={card} size="lg" />
        </div>
        <div className="flex-1 bg-stone-900 border border-white/20 rounded-xl p-5 space-y-3 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">{card.name}</h3>
            <button type="button" onClick={onClose} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          {card.description && <p className="text-sm text-stone-300 italic">{card.description}</p>}
          <div>
            <p className="text-xs uppercase text-stone-500 mb-1">Effects</p>
            {effects.length ? (
              <ul className="space-y-1">
                {effects.map((e, i) => <li key={i} className="text-sm text-stone-200">• {describeEffect(e)}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-stone-500">No effects.</p>
            )}
          </div>
          {(card.cost_coins || 0) > 0 && <p className="text-amber-300 text-sm">Costs {card.cost_coins} coins</p>}
          {(card.cost_coins || 0) < 0 && <p className="text-amber-300 text-sm">Costs coins equal to the current age</p>}
          {card.chain_cost && <p className="text-purple-300 text-sm">Chain (free if you own the “{card.chain_cost}” symbol)</p>}
        </div>
      </div>
    </div>
  );
}