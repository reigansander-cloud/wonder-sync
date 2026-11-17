import React from "react";
import { Image } from "@/components/ui/image";
import { edificeList } from "@/lib/game/edifices";
import { PATRONAGE_TOKEN_IMAGES } from "@/lib/game/constants";

// Shows a player's patronage tokens (Edifice expansion): one age-themed token
// image per edifice the player holds a patronage token for, with a count badge
// for duplicates.
export default function PatronageBadges({ player, game }) {
  const tokens = player?.patronage_tokens || [];
  if (!tokens.length) return null;
  const edifices = edificeList(game);
  const byId = {};
  for (const e of edifices) byId[e.id] = e;
  const counts = {};
  for (const t of tokens) counts[t.edifice_id] = (counts[t.edifice_id] || 0) + 1;
  const entries = Object.entries(counts);
  return (
    <div className="flex items-center gap-1">
      {entries.map(([edId, count]) => {
        const ed = byId[edId];
        const age = ed?.age || "?";
        const img = PATRONAGE_TOKEN_IMAGES[String(age)];
        return (
          <div key={edId} className="relative" title={`Patronage — Age ${age}: ${ed?.name || ""}`}>
            {img ? (
              <div className="h-6 w-6"><Image src={img} alt={`Age ${age} patronage`} fittingType="fit" className="h-6 w-6" /></div>
            ) : (
              <span className="text-[10px] text-amber-200 font-semibold px-1 rounded bg-amber-500/15 border border-amber-500/40">{age}</span>
            )}
            {count > 1 && <span className="absolute -top-1 -right-1 text-[9px] text-amber-100 font-bold bg-amber-600 rounded-full px-1 leading-tight">×{count}</span>}
          </div>
        );
      })}
    </div>
  );
}