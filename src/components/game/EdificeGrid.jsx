import React from "react";
import { CoinIcon } from "./Icons";
import { edificeList } from "@/lib/game/edifices";
import { describeEffect } from "./EffectEditor";
import { Image } from "@/components/ui/image";
import { PATRONAGE_TOKEN_IMAGES } from "@/lib/game/constants";

// The edifice directory grid: three age edifices shown left-to-right with cost,
// reward/penalty (or icon art), and remaining patronage tokens as token icons.
export default function EdificeGrid({ game, players }) {
  const edifices = edificeList(game).sort((a, b) => Number(a.age) - Number(b.age));
  const state = game.edifice_state || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {edifices.map((ed) => {
        const st = state[ed.id] || { remaining: 0, holders: [], completed: false };
        const tokenImg = PATRONAGE_TOKEN_IMAGES[String(ed.age)];
        return (
          <div key={ed.id} className={`rounded-lg border p-3 flex flex-col ${st.completed ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/5 border-white/10"}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{ed.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">Age {ed.age}</span>
            </div>
            {ed.icon_url && (
              <Image src={ed.icon_url} alt={ed.name} fittingType="fit" className="w-full h-72 mt-2 rounded bg-black/20 object-contain" />
            )}
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="flex items-center gap-1 text-amber-300"><CoinIcon size={14} /> {ed.cost}</span>
              {!ed.icon_url && ed.reward_effects?.length > 0 && <span className="text-emerald-300 leading-snug">Reward: {ed.reward_effects.map(describeEffect).join("; ")}</span>}
              {!ed.icon_url && ed.penalty_effects?.length > 0 && <span className="text-red-300 leading-snug">Penalty: {ed.penalty_effects.map(describeEffect).join("; ")}</span>}
            </div>
            <div className="mt-2 flex items-center gap-1 flex-wrap min-h-[1.5rem]">
              {st.completed
                ? <span className="text-[10px] text-emerald-300 font-semibold">✓ Completed</span>
                : Array.from({ length: Math.max(0, st.remaining || 0) }).map((_, i) => (
                    <img key={i} src={tokenImg} alt="patronage token" className="h-6 w-6 object-contain" />
                  ))}
            </div>
            {(st.holders || []).length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {(st.holders || []).map((id) => {
                  const p = players.find((x) => x.id === id);
                  return <span key={id} className="w-3 h-3 rounded-full" style={{ background: p?.player_color || "#888" }} />;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}