import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ResourceIcon, CoinIcon } from "./Icons";
import { getTradeInfo, tradeUnitCost, getScamState, countEffects, producesResource, effectiveCoinCost } from "@/lib/game/rules";

export default function TradeDialog({ card, player, leftNeighbor, rightNeighbor, allCardsById, farNeighbors = [], onConfirm, onCancel, freeCardAvailable, onPlayFree, pools }) {
  const info = useMemo(
    () => getTradeInfo(player, card, leftNeighbor, rightNeighbor, allCardsById, pools),
    [card, player, leftNeighbor, rightNeighbor, allCardsById, pools]
  );

  const hasForeignTrade = countEffects(player, "foreign_trade", allCardsById) > 0;
  const farList = farNeighbors || [];

  const missingKeys = Object.keys(info.missing).filter((r) => info.missing[r] > 0);

  // For each missing resource, list every supplier that can provide it:
  // left neighbor, right neighbor, and (if you have Foreign Trade) a player 2
  // seats away. Foreign Trade buys a single resource once per turn, so it is
  // only offered for resources you need exactly one of.
  const suppliers = useMemo(() => {
    const map = {};
    for (const r of missingKeys) {
      const amt = info.missing[r];
      const list = [];
      if (leftNeighbor && producesResource(leftNeighbor, r, allCardsById)) list.push({ side: "left" });
      if (rightNeighbor && producesResource(rightNeighbor, r, allCardsById)) list.push({ side: "right" });
      if (hasForeignTrade && amt === 1) {
        for (const fn of farList) {
          if (fn && producesResource(fn, r, allCardsById)) list.push({ side: "far", seat: fn.seat, name: fn.player_name });
        }
      }
      map[r] = list;
    }
    return map;
  }, [missingKeys, info.missing, leftNeighbor, rightNeighbor, farList, hasForeignTrade, allCardsById]);

  const [choices, setChoices] = useState(() => {
    const init = {};
    for (const r of missingKeys) init[r] = suppliers[r][0]?.side || null;
    return init;
  });

  // Foreign Trade is once per turn — track which resource (if any) uses it.
  const farUsedFor = missingKeys.find((r) => choices[r] === "far");

  const scamState = getScamState(player, allCardsById);
  const availability = info.availability || {};
  const plan = [];
  let tradeCost = 0;
  for (const r of missingKeys) {
    const amt = info.missing[r];
    const side = choices[r];
    if (!side) continue;
    if (side === "far") {
      const sup = suppliers[r].find((s) => s.side === "far");
      if (sup) { plan.push({ resource: r, side: "far", seat: sup.seat, cost: 1 }); tradeCost += 1; }
    } else {
      const nbr = side === "left" ? leftNeighbor : rightNeighbor;
      const otherSide = side === "left" ? "right" : "left";
      const otherNbr = otherSide === "left" ? leftNeighbor : rightNeighbor;
      // Each neighbor resource can only be bought once per turn — cap at the
      // slots that side actually has, then cover any remainder from the other
      // side (so a 2-ore card split across two 1-ore neighbors still works).
      const cap = Math.min(amt, (availability[r]?.[side]) || 0);
      for (let i = 0; i < cap; i++) {
        const unitCost = tradeUnitCost(player, nbr, side, r, allCardsById, scamState);
        plan.push({ resource: r, side, cost: unitCost });
        tradeCost += unitCost;
      }
      let rest = amt - cap;
      if (rest > 0 && (availability[r]?.[otherSide]) > 0) {
        const oc = Math.min(rest, availability[r][otherSide]);
        for (let i = 0; i < oc; i++) {
          const unitCost = tradeUnitCost(player, otherNbr, otherSide, r, allCardsById, scamState);
          plan.push({ resource: r, side: otherSide, cost: unitCost });
          tradeCost += unitCost;
        }
        rest -= oc;
      }
    }
  }
  const availableCoins = pools ? (pools.coins ?? 0) : (player.coins || 0);
  const totalCost = effectiveCoinCost(card) + tradeCost;
  const canPay = totalCost <= availableCoins;
  const coveredCount = {};
  for (const t of plan) coveredCount[t.resource] = (coveredCount[t.resource] || 0) + 1;
  const allCovered = missingKeys.every((r) => (coveredCount[r] || 0) >= info.missing[r]);
  const hasFarOption = hasForeignTrade && missingKeys.some((r) => suppliers[r].some((s) => s.side === "far"));

  const setChoice = (r, side) => setChoices((c) => ({ ...c, [r]: side }));

  const sideName = (s) => {
    if (s.side === "left") return leftNeighbor?.player_name || "Left";
    if (s.side === "right") return rightNeighbor?.player_name || "Right";
    return s.name || "Far";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/10 rounded-xl p-5 max-w-md w-full text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Trade for resources</h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-3">
          Playing <span className="text-amber-300 font-medium">{card.name}</span> needs resources you don't produce. Choose who to buy each from.
        </p>

        {missingKeys.length === 0 ? (
          <p className="text-sm text-stone-300">No trade needed.</p>
        ) : (
          <div className="space-y-2">
            {missingKeys.map((r) => {
              const leftSup = suppliers[r].find((s) => s.side === "left");
              const otherSups = suppliers[r].filter((s) => s.side !== "left");
              const renderSup = (s) => {
                const farBlocked = s.side === "far" && farUsedFor && farUsedFor !== r;
                const active = choices[r] === s.side;
                const isFar = s.side === "far";
                return (
                  <button key={s.side + (s.seat ?? "")} type="button" disabled={farBlocked}
                    onClick={() => setChoice(r, s.side)}
                    className={`px-2 py-1 rounded text-xs border whitespace-nowrap ${active ? (isFar ? "bg-emerald-500 text-black border-emerald-400" : "bg-amber-500 text-black border-amber-400") : "bg-white/5 border-white/10 text-stone-300"} ${farBlocked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"}`}>
                    {sideName(s)}{isFar ? " · 1c" : ""}
                  </button>
                );
              };
              return (
                <div key={r} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  {/* Left supplier */}
                  <div className="w-24 shrink-0 flex flex-wrap gap-1">
                    {leftSup ? renderSup(leftSup) : <span className="text-[10px] text-stone-600">—</span>}
                  </div>
                  {/* Resource in the middle */}
                  <div className="flex-1 flex items-center justify-center gap-1.5">
                    <ResourceIcon resource={r} size={22} />
                    <span className="text-sm font-medium">×{info.missing[r]}</span>
                  </div>
                  {/* Right / Far suppliers */}
                  <div className="w-24 shrink-0 flex flex-wrap gap-1 justify-end">
                    {otherSups.length ? otherSups.map(renderSup) : <span className="text-[10px] text-stone-600">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasFarOption && (
          <p className="mt-3 text-[11px] text-emerald-300/80">Foreign Trade: buy 1 resource from 2 seats away for 1 coin, once per turn.</p>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
          <div className="text-sm">
            <span className="text-stone-400">Cost: </span>
            <span className="inline-flex items-center gap-1 text-amber-300 font-semibold"><CoinIcon size={16} /> {totalCost}</span>
            <span className="text-stone-500 text-xs ml-2">(you have {availableCoins})</span>
          </div>
          {freeCardAvailable && onPlayFree && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white mr-2" onClick={onPlayFree}>Play for free</Button>
          )}
          <Button className="bg-amber-500 hover:bg-amber-600 text-black" disabled={!canPay || !allCovered || plan.length === 0} onClick={() => onConfirm(plan)}>
            Confirm & Play
          </Button>
        </div>
        {!canPay && <p className="text-[11px] text-red-400 mt-2 text-right">Not enough coins.</p>}
        {!allCovered && canPay && <p className="text-[11px] text-red-400 mt-2 text-right">Choose a supplier for every resource.</p>}
      </div>
    </div>
  );
}