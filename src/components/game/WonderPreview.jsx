import React from "react";
import { getWonder } from "@/lib/game/constants";
import { describeEffect } from "@/components/game/EffectEditor";
import { ResourceIcon, CoinIcon } from "@/components/game/Icons";

// Preview the stages of a selected wonder (day/night side) inside the lobby.
// Shows each stage's resource cost and its effects.
export default function WonderPreview({ wonder, side }) {
  if (!wonder) return null;
  const w = getWonder(wonder, side);
  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
      {w.image_url && (
        <div className="rounded-lg overflow-hidden border border-white/10 mb-2">
          <img src={w.image_url} alt={w.name} className="w-full max-h-72 object-contain bg-stone-900" />
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap text-xs text-stone-400">
        <span className="uppercase tracking-wide">Starting resource:</span>
        {w.start_resource ? <ResourceIcon resource={w.start_resource} size={18} /> : <span className="italic text-stone-500">none</span>}
      </div>
      <div className="space-y-1.5">
        {(w.stages || []).map((stage, i) => {
          const cost = stage.cost || {};
          const entries = Object.entries(cost).filter(([, v]) => v > 0);
          return (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
              <span className="text-xs font-bold w-5 text-center text-amber-300">{i + 1}</span>
              <span className="flex items-center gap-1 flex-1">
                {entries.length === 0 && !(stage.cost_coins || 0) ? <span className="text-[10px] text-stone-500">Free</span> : (<>
                  {entries.map(([r, n]) => (
                    <span key={r} className="flex items-center gap-0.5">{Array.from({ length: n }).map((_, idx) => <ResourceIcon key={r + idx} resource={r} size={16} />)}</span>
                  ))}
                  {(stage.cost_coins || 0) > 0 && <span className="flex items-center gap-0.5"><CoinIcon size={16} /><span className="text-[10px] font-semibold text-amber-200">×{stage.cost_coins}</span></span>}
                </>)}
              </span>
              <span className="text-[10px] text-stone-400 text-right leading-tight max-w-[140px]">{(stage.effects || []).map(describeEffect).filter(Boolean).join(", ") || "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}