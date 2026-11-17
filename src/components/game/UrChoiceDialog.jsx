import React from "react";
import { X } from "lucide-react";
import { CoinIcon, VPIcon } from "./Icons";
import { edificeList } from "@/lib/game/edifices";

// Ur (day side) stage 2: choose which of the three ages to gain a duplicate
// patronage token for (from out of play). The edifice for that age (if any)
// receives the duplicate token.
export default function UrChoiceDialog({ game, onConfirm, onCancel }) {
  const edifices = edificeList(game);
  const byAge = { "1": null, "2": null, "3": null };
  for (const ed of edifices) byAge[String(ed.age)] = ed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/10 rounded-xl p-5 max-w-md w-full text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Ur — Choose an Age</h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-3">Gain a duplicate patronage token (from out of play) for one of the three ages.</p>
        <div className="space-y-2">
          {["1", "2", "3"].map((age) => {
            const ed = byAge[age];
            return (
              <button
                key={age}
                disabled={!ed}
                onClick={() => onConfirm(age)}
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Age {age}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">{ed ? ed.name : "No edifice"}</span>
                </div>
                {ed && (
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-300">
                    <span className="flex items-center gap-1"><CoinIcon size={13} /> {ed.cost}</span>
                    <span className="flex items-center gap-1 text-emerald-300"><VPIcon size={13} /> +{ed.rewards?.vp || 0}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}