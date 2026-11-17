import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ARMADA_TRACK_COLORS } from "@/lib/game/constants";

const COLOR_HEX = { red: "#b83232", yellow: "#d9b920", blue: "#2e5fa3", green: "#3d8b3d" };

export default function MoveShipChooser({ player, amount, onConfirm, onCancel }) {
  const avail = ARMADA_TRACK_COLORS.filter((c) => (player.armada_board?.[c]?.level || 1) < 7);
  const [picked, setPicked] = useState([]);
  const max = Math.min(amount || 1, avail.length, 4);

  const toggle = (c) => {
    if (picked.includes(c)) setPicked(picked.filter((x) => x !== c));
    else if (picked.length < max) setPicked([...picked, c]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-stone-900 border border-white/20 rounded-xl max-w-lg w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-amber-300">Move up to {max} ship{max > 1 ? "s" : ""}</h3>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
        <p className="text-xs text-stone-400">
          Pick up to {max} different track{max > 1 ? "s" : ""} to advance one level each for free. Unpicked slots move the lowest available track automatically.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {avail.map((c) => {
            const on = picked.includes(c);
            const lvl = player.armada_board?.[c]?.level || 1;
            return (
              <button key={c} type="button" onClick={() => toggle(c)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 transition ${on ? "border-amber-400 bg-amber-400/20" : "border-white/10 hover:border-white/30"}`}>
                <span className="w-6 h-6 rounded-full" style={{ background: COLOR_HEX[c] }} />
                <span className="text-xs capitalize">{c}</span>
                <span className="text-[10px] text-stone-400">L{lvl}/7</span>
              </button>
            );
          })}
        </div>
        {picked.length > 0 && (
          <div className="text-xs text-stone-400 text-center">
            Selected: {picked.map((c) => <span key={c} className="capitalize mr-1 text-amber-300">{c}</span>)}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onConfirm([])}>Auto-pick</Button>
          <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-black" onClick={() => onConfirm(picked)} disabled={picked.length === 0 && max > 0}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}