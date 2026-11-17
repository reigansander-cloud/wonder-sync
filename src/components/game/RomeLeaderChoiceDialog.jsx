import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import CardView from "./CardView";
import { CoinIcon } from "./Icons";
import { leaderCoinCost } from "@/lib/game/rules";

// Rome (night) stages 2 & 3: choose a leader from your hand to play when
// building the stage. The leader's coin cost is charged with Rome's
// leader_cost_reduction discount applied — unaffordable leaders are disabled.
// Skip builds the stage without playing a leader; Cancel aborts the build.
export default function RomeLeaderChoiceDialog({ player, allPlayers, gameAge, onConfirm, onCancel }) {
  const leaders = player?.leaders_hand || [];
  const coins = player?.coins || 0;
  const costOf = (c) => Math.max(0, leaderCoinCost(player, c, allPlayers || [], gameAge || 0) - 2);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/10 rounded-xl p-5 max-w-md w-full text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Rome — Play a Leader</h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-3">Build this stage to play a leader from your hand. Its coin cost is charged (with Rome's discount applied). You have <span className="flex items-center gap-0.5 inline-flex"><CoinIcon size={14} />{coins}</span>.</p>
        {leaders.length === 0 ? (
          <p className="text-sm text-stone-400">You have no leaders to play.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
            {leaders.map((c) => {
              const cost = costOf(c);
              const affordable = cost <= coins;
              return (
                <button key={c.id} type="button" onClick={() => affordable && onConfirm(c.id)} disabled={!affordable} className={`text-left rounded-lg border bg-white/5 p-2 transition flex flex-col items-center gap-1 ${affordable ? "hover:bg-white/10 hover:border-amber-500/50 border-white/10" : "border-red-500/30 opacity-50 cursor-not-allowed"}`}>
                  <CardView card={c} size="sm" />
                  <span className={`text-xs flex items-center gap-0.5 ${affordable ? "text-amber-300" : "text-red-400"}`}>
                    <CoinIcon size={12} />{cost}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => onConfirm(null)}>Skip</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}