import React from "react";
import { X } from "lucide-react";
import { ARMADA_REWARDS, ARMADA_TRACK_COLORS } from "@/lib/game/constants";

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
  if (r.island) parts.push(`draw & play an Age ${r.island} island`);
  return parts.join(", ");
}

// Pick a track to advance for free (discard-to-move action). Only non-maxed
// tracks are offered; the move itself costs nothing.
export default function ArmadaFreeMoveDialog({ player, onConfirm, onCancel }) {
  const board = player?.armada_board || {};
  const avail = ARMADA_TRACK_COLORS.filter((c) => (board[c]?.level || 1) < 7);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/20 rounded-xl p-5 max-w-md w-full text-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">⚓ Move Ship (free)</h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-stone-300">Discard this card to advance any one ship up a level for free — no cost, rewards still apply.</p>
        <div className="space-y-2">
          {avail.map((color) => {
            const tr = board[color];
            const next = (tr?.level || 1) + 1;
            return (
              <button key={color} type="button" onClick={() => onConfirm({ color })}
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-white/10 transition"
                style={{ borderColor: `${TRACK_HEX[color]}80`, background: `${TRACK_HEX[color]}10` }}>
                <span className="text-sm font-bold uppercase w-16" style={{ color: TRACK_HEX[color] }}>{color}</span>
                <span className="text-xs text-stone-400">L{tr?.level || 1} → {next}</span>
                <span className="text-xs text-amber-200 ml-auto text-right">{rewardText(color, next)}</span>
              </button>
            );
          })}
          {avail.length === 0 && <p className="text-xs text-stone-500">All ships are already at the top level.</p>}
        </div>
        <button type="button" onClick={onCancel} className="w-full px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm">Cancel</button>
      </div>
    </div>
  );
}