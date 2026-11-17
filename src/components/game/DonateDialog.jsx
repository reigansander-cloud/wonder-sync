import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CoinIcon } from "./Icons";
import { describeEffect } from "./EffectEditor";

// Shown after a player chooses to build a wonder stage (first stage this age),
// if the current-age edifice is active and affordable. Donate spends the
// edifice cost and grants a patronage token; Decline does nothing.
export default function DonateDialog({ edifice, player, coinsAfter, onConfirm, onCancel }) {
  if (!edifice) return null;
  const coins = coinsAfter != null ? coinsAfter : (player?.coins || 0);
  const affordable = coins >= (edifice.cost || 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/10 rounded-xl p-5 max-w-sm w-full text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Donate to {edifice.name}?</h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-3">You built a wonder stage. You may donate to the Age {edifice.age} edifice to gain a patronage token.</p>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-stone-400">Cost</span>
            <span className="flex items-center gap-1 text-amber-300 font-semibold"><CoinIcon size={16} /> {edifice.cost}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-stone-400 shrink-0">Reward (patrons)</span>
            <span className="text-emerald-300 text-right text-xs max-w-[60%]">{edifice.reward_effects?.length ? edifice.reward_effects.map(describeEffect).join("; ") : `+${edifice.rewards?.vp || 0} VP${edifice.rewards?.coins ? ` +${edifice.rewards.coins}🪙` : ""}`}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-stone-400 shrink-0">Penalty (non-patrons)</span>
            <span className="text-red-300 text-right text-xs max-w-[60%]">{edifice.penalty_effects?.length ? edifice.penalty_effects.map(describeEffect).join("; ") : `${edifice.penalties?.vp || 0} VP`}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">Coins after build</span>
            <span className="flex items-center gap-1"><CoinIcon size={16} /> {coins}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black" disabled={!affordable} onClick={() => onConfirm("donate")}>
            Donate {edifice.cost}🪙
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => onConfirm("decline")}>Decline</Button>
        </div>
        {!affordable && <p className="text-[11px] text-red-400 mt-2 text-center">Not enough coins — you must decline.</p>}
      </div>
    </div>
  );
}