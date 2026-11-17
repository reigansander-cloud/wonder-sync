import React, { useState } from "react";
import { X, ScrollText } from "lucide-react";
import CardView from "./CardView";
import { describeEffect } from "./EffectEditor";

// A compact "Leaders (N)" button that opens a popup listing the player's held
// leaders. Hovering a leader reveals its description and effects.
export default function LeadersHandButton({ leaders }) {
  const [open, setOpen] = useState(false);
  if (!leaders || leaders.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25 transition text-xs font-medium">
        <ScrollText className="h-4 w-4" />
        Leaders ({leaders.length})
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(false)}>
          <div className="bg-stone-900 border border-white/20 rounded-xl p-5 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Your Leaders</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {leaders.map((c, i) => <LeaderCard key={c.id || i} card={c} />)}
            </div>
            <p className="text-[11px] text-stone-500 text-center mt-4">Hover a leader to see its effects and description.</p>
          </div>
        </div>
      )}
    </>
  );
}

function LeaderCard({ card }) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <CardView card={card} size="md" />
      {hover && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-lg bg-stone-800 border border-white/20 shadow-xl z-50 text-xs space-y-1 pointer-events-none">
          <p className="font-semibold text-white">{card.name}</p>
          {card.description && <p className="text-stone-300 italic">{card.description}</p>}
          {(card.effects || []).map((e, i) => <p key={i} className="text-stone-300">• {describeEffect(e)}</p>)}
          {(card.cost_coins || 0) > 0 && <p className="text-amber-300">Costs {card.cost_coins} coins</p>}
        </div>
      )}
    </div>
  );
}