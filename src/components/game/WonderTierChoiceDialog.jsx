import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { describeEffect } from "@/components/game/EffectEditor";

// Prompt the player to choose which option (set of effects) to apply when
// building a wonder stage that has multiple choices.
export default function WonderTierChoiceDialog({ wonder, stageIndex, stage, onConfirm, onCancel }) {
  const options = Array.isArray(stage?.choices) ? stage.choices : [];
  const [selected, setSelected] = useState(0);
  const stageNum = (stageIndex || 0) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/10 rounded-xl p-5 max-w-lg w-full text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">{wonder?.name || "Wonder"} — Stage {stageNum}</h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-3">Choose one of this stage's options:</p>
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {options.map((opt, oi) => {
            const effs = Array.isArray(opt) ? opt : (opt?.effects || []);
            return (
              <button
                key={oi}
                onClick={() => setSelected(oi)}
                className={`w-full text-left rounded-lg border p-3 transition ${selected === oi ? "border-amber-400 bg-amber-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected === oi ? "border-amber-400 bg-amber-400" : "border-stone-500"}`} />
                  <span className="font-medium">Option {oi + 1}</span>
                </div>
                <div className="pl-6 space-y-0.5">
                  {effs.length === 0 ? (
                    <span className="text-xs text-stone-500 italic">No effects</span>
                  ) : effs.map((e, i) => (
                    <p key={i} className="text-xs text-stone-300">• {describeEffect(e)}</p>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button className="bg-amber-500 hover:bg-amber-600 text-black" onClick={() => onConfirm(selected)}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}