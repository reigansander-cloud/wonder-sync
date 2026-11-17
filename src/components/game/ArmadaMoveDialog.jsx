import React, { useState } from "react";
import { ARMADA_REWARDS } from "@/lib/game/constants";
import { CoinIcon, ResourceIcon } from "./Icons";
import { canAfford } from "@/lib/game/rules";
import TradeDialog from "./TradeDialog";
import ShipyardPanel from "./ShipyardPanel";
import CardView from "./CardView";
import { describeEffect } from "./EffectEditor";

const TRACK_HEX = { red: "#b83232", yellow: "#d9b920", blue: "#2e5fa3", green: "#3d8b3d" };

function rewardText(color, level) {
  const r = ARMADA_REWARDS[color]?.[level];
  if (!r) return "—";
  const parts = [];
  if (r.navalShields) parts.push(`${r.navalShields} naval shields`);
  if (r.coins) parts.push(`${r.coins} coins`);
  if (r.trade) parts.push(`trade level ${r.trade}`);
  if (r.cull) parts.push(`cull others ${r.cull}`);
  if (r.vp) parts.push(`${r.vp} VP`);
  if (r.island) parts.push(`draw 4 Age ${r.island} islands, play 1`);
  return parts.join(", ");
}

// Prompts the player to move their ship on `color` track or decline. Handles
// resource trade (via TradeDialog) and green-track island selection inline.
export default function ArmadaMoveDialog({ player, color, game, allCardsById, islands, leftNeighbor, rightNeighbor, farNeighbors, onConfirm, onCancel, pools, free }) {
  const board = player?.armada_board?.[color];
  const level = board?.level || 1;
  const next = level + 1;
  const cost = board?.costs?.[next];
  const maxed = next > 7;
  const [step, setStep] = useState("choose");
  const [trades, setTrades] = useState([]);
  const [islandId, setIslandId] = useState(null);
  // Capture the 4 islands once on mount — the parent re-shuffles on every
  // render which caused the visible cards to flicker. useState initializer
  // only runs once so the choices stay stable.
  const [stableIslands] = useState(() => islands || []);

  if (maxed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
        <div className="bg-stone-900 border border-white/20 rounded-xl p-5 max-w-sm w-full text-white">
          <h3 className="font-semibold mb-2">Armada — {color} track</h3>
          <p className="text-sm text-stone-300 mb-4">Your ship is already at the top (level 7). No move available.</p>
          <button onClick={() => onConfirm({ decline: true })} className="w-full px-4 py-2 rounded bg-white/10 hover:bg-white/20">Close</button>
        </div>
      </div>
    );
  }

  const pseudoCard = { color, is_wonder: false, cost_coins: cost?.coins || 0, cost_resources: Object.fromEntries(Object.entries(cost || {}).filter(([k]) => k !== "coins")), chain_cost: null };
  const aff = free ? { ok: true, tradePairs: [] } : canAfford(player, pseudoCard, leftNeighbor, rightNeighbor, allCardsById, farNeighbors, null, pools);
  // Islands are only granted by the GREEN track's reward — never red/yellow/blue.
  const islandReward = color === "green" && !!ARMADA_REWARDS.green?.[next]?.island;

  const confirmMove = (mv) => onConfirm(mv);

  const onMoveClick = () => {
    if (free) {
      if (islandReward) setStep("island");
      else confirmMove({ color, trades: [], islandId: null });
      return;
    }
    if (!aff.ok) return;
    if (aff.tradePairs.length > 0) setStep("trade");
    else if (islandReward) setStep("island");
    else confirmMove({ color, trades: [], islandId: null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border-4 rounded-xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto text-white space-y-4" style={{ borderColor: TRACK_HEX[color] || "#fff" }}>
        {step === "choose" && (<>
          <h3 className="font-semibold text-lg">⚓ Move Ship — {color} track</h3>
          <p className="text-sm text-stone-300">Level {level} → {next}</p>
          <ShipyardPanel player={player} onlyColor={color} compact />
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1.5">
            {!free && <div className="flex items-center gap-2 text-sm"><span className="text-stone-400 w-16">Cost:</span>
              {cost && Object.entries(cost).map(([k, v]) => k === "coins" ? <span key={k} className="flex items-center gap-0.5"><CoinIcon size={16} />{v}</span> :
                Array.from({ length: v }).map((_, i) => <ResourceIcon key={k + i} resource={k} size={18} />))}
            </div>}
            {free && <div className="text-sm text-emerald-300">Free move (wonder badge)</div>}
            <div className="text-sm"><span className="text-stone-400">Reward:</span> <span className="text-amber-200">{rewardText(color, next)}</span></div>
          </div>
          {!aff.ok && !free && <p className="text-xs text-red-400">You cannot afford this move.</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onMoveClick} disabled={!aff.ok} className="flex-1 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium">Move Ship</button>
            <button onClick={() => confirmMove({ decline: true })} className="flex-1 px-4 py-2 rounded bg-white/10 hover:bg-white/20">Decline</button>
          </div>
        </>)}

        {step === "trade" && (<>
          <h3 className="font-semibold">Trade for the move</h3>
          <TradeDialog
            card={pseudoCard} player={player} leftNeighbor={leftNeighbor} rightNeighbor={rightNeighbor}
            allCardsById={allCardsById} farNeighbors={farNeighbors} pools={pools}
            onConfirm={(plan) => { setTrades(plan); if (islandReward) setStep("island"); else confirmMove({ color, trades: plan, islandId: null }); }}
            onCancel={() => setStep("choose")}
          />
        </>)}

        {step === "island" && (<>
          <h3 className="font-semibold">Choose an Island (Age {ARMADA_REWARDS.green[next]?.island})</h3>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {(stableIslands || []).map((i) => (
              <button key={i.id} onClick={() => { setIslandId(i.id); confirmMove({ color, trades, islandId: i.id }); }}
                className="text-left hover:scale-105 transition">
                <CardView card={i} size="md" />
                <p className="text-[10px] text-stone-400 mt-1 line-clamp-2">{(i.effects || []).map(describeEffect).filter(Boolean).join(", ") || i.description || ""}</p>
              </button>
            ))}
            {(!stableIslands || stableIslands.length === 0) && <p className="text-xs text-stone-500 col-span-2">No islands of this age available.</p>}
          </div>
          <button onClick={() => setStep("choose")} className="text-xs text-stone-400 hover:text-white">← Back</button>
        </>)}
      </div>
    </div>
  );
}