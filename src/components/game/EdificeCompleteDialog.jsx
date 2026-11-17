// Edifice completion popup shown to every player at round end (or age end) when
// an edifice completes. Shows what the player gained/lost and, if a penalty
// requires it, a choice of which card/trophy to discard.
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import CardView from "./CardView";

export default function EdificeCompleteDialog({ edifice, summary, penaltyEffect, allCardsById, onConfirm }) {
  const [discardChoice, setDiscardChoice] = useState(null);
  const rewards = summary?.rewards || [];
  const penalties = summary?.penalties || [];
  const needsDiscard = penaltyEffect && (penaltyEffect.effect.kind === "self_discard");
  const eligible = penaltyEffect?.eligible || [];
  const discardMode = penaltyEffect?.discardMode || "card";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
      <div className="bg-stone-900 border border-amber-500/40 rounded-xl p-5 max-w-lg w-full text-white shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg text-amber-300">Edifice Completed — {edifice.name}</h3>
          <span className="text-xs text-stone-400">Age {edifice.age}</span>
        </div>

        <div className="space-y-2 mb-4">
          {rewards.length > 0 && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
              <p className="text-xs uppercase text-emerald-400 mb-1">You Gained</p>
              <p className="text-sm text-emerald-200">{rewards.join(", ")}</p>
            </div>
          )}
          {penalties.length > 0 && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
              <p className="text-xs uppercase text-red-400 mb-1">You Lost</p>
              <p className="text-sm text-red-200">{penalties.join(", ")}</p>
            </div>
          )}
          {rewards.length === 0 && penalties.length === 0 && (
            <p className="text-sm text-stone-400">No effect on you.</p>
          )}
        </div>

        {needsDiscard && eligible.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-stone-300 mb-2">
              {discardMode === "trophy"
                ? "Choose a trophy to discard (or take a penalty token):"
                : `Choose a ${penaltyEffect.effect.color || ""} card to discard (or take a penalty token):`}
            </p>
            <div className="flex gap-2 flex-wrap">
              {discardMode === "trophy"
                ? eligible.map((t) => (
                    <button key={t.id} onClick={() => setDiscardChoice(t.id)} className={`px-3 py-2 rounded-lg border-2 transition text-sm ${discardChoice === t.id ? "border-amber-400 bg-amber-500/20" : "border-white/20 hover:border-white/40"}`}>
                      {t.label}
                    </button>
                  ))
                : eligible.map((c) => (
                    <button key={c.id} onClick={() => setDiscardChoice(c.id)} className={`rounded-lg border-2 transition ${discardChoice === c.id ? "border-amber-400" : "border-transparent hover:border-white/30"}`}>
                      <CardView card={c} size="sm" />
                    </button>
                  ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button className="bg-amber-500 hover:bg-amber-600 text-black" onClick={() => onConfirm(discardChoice)} disabled={needsDiscard && eligible.length > 0 && !discardChoice}>
            <Check className="h-4 w-4 mr-1" /> Acknowledge
          </Button>
        </div>
      </div>
    </div>
  );
}