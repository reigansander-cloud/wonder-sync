import React, { useState } from "react";
import { X } from "lucide-react";
import { TOKEN_ICONS, NAVAL_TOKEN_IMAGES } from "@/lib/game/constants";

const LABELS = {
  "1": "Age 1 Trophy", "2": "Age 2 Trophy", "3": "Age 3 Trophy",
  loss: "Defeat", penalty: "Penalty",
  nv0: "Naval Victory (Age 0)", nv1: "Naval Victory (Age 1)", nv2: "Naval Victory (Age 2)", nv3: "Naval Victory (Age 3)",
  nd1: "Naval Defeat (Age 1)", nd2: "Naval Defeat (Age 2)", nd3: "Naval Defeat (Age 3)",
};

// Military + naval token inventory: shows a trophy/loss/naval icon per type the
// player owns. Types with a count of 0 are hidden. Click any token (or the
// inventory) to open an enlarged modal showing the full collection.
export default function TokenInventory({ player, size = 18 }) {
  const [open, setOpen] = useState(false);
  const trophies = player?.trophies || [];
  const defeats = player?.defeats || [];
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const t of trophies) {
    const key = String(t.age);
    if (counts[key] !== undefined) counts[key] += 1;
  }
  const navalV = player?.naval_trophies || [];
  const navalD = player?.naval_defeats || [];
  const nvCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const t of navalV) { const k = String(t.age); if (nvCounts[k] !== undefined) nvCounts[k] += 1; }
  const ndCounts = { 1: 0, 2: 0, 3: 0 };
  for (const t of navalD) { const k = String(t.age); if (ndCounts[k] !== undefined) ndCounts[k] += 1; }
  const tokens = [
    { key: "1", icon: TOKEN_ICONS["1"], count: counts[1] },
    { key: "2", icon: TOKEN_ICONS["2"], count: counts[2] },
    { key: "3", icon: TOKEN_ICONS["3"], count: counts[3] },
    { key: "loss", icon: TOKEN_ICONS.loss, count: defeats.length },
    { key: "penalty", icon: TOKEN_ICONS.penalty, count: player?.penalties || 0 },
    { key: "nv0", icon: NAVAL_TOKEN_IMAGES.victory["0"], count: nvCounts[0] },
    { key: "nv1", icon: NAVAL_TOKEN_IMAGES.victory["1"], count: nvCounts[1] },
    { key: "nv2", icon: NAVAL_TOKEN_IMAGES.victory["2"], count: nvCounts[2] },
    { key: "nv3", icon: NAVAL_TOKEN_IMAGES.victory["3"], count: nvCounts[3] },
    { key: "nd1", icon: NAVAL_TOKEN_IMAGES.defeat["1"], count: ndCounts[1] },
    { key: "nd2", icon: NAVAL_TOKEN_IMAGES.defeat["2"], count: ndCounts[2] },
    { key: "nd3", icon: NAVAL_TOKEN_IMAGES.defeat["3"], count: ndCounts[3] },
  ].filter((t) => t.count > 0);
  if (tokens.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition" title="View token collection">
        {tokens.map((t) => (
          <div key={t.key} className="relative" style={{ width: size, height: size }}>
            <img src={t.icon} alt="" className="w-full h-full object-contain" />
            {t.count > 1 && (
              <span className="absolute -bottom-1.5 -right-1.5 bg-stone-900 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 leading-none border border-white/30">
                {t.count}
              </span>
            )}
          </div>
        ))}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(false)}>
          <div className="bg-stone-900 border border-white/20 rounded-xl p-5 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Token Collection</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {tokens.map((t) => (
                <div key={t.key} className="flex flex-col items-center gap-1 rounded-lg bg-white/5 border border-white/10 p-3">
                  <img src={t.icon} alt={LABELS[t.key] || ""} className="w-14 h-14 object-contain" />
                  <span className="text-[10px] text-stone-300 text-center leading-tight">{LABELS[t.key] || t.key}</span>
                  <span className="text-xs font-bold text-amber-300">×{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}