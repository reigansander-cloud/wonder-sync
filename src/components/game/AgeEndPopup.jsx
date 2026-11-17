import React, { useState, useEffect } from "react";
import { TOKEN_ICONS, NAVAL_TOKEN_IMAGES } from "@/lib/game/constants";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";

// End-of-age popup. Military resolution is shown in columns: left neighbor on
// the left, right neighbor on the right, and any additional opponents in
// between (in cyclic order going left). Naval resolution spans the full width.
// Edifice resolution (end-of-age completion only) is shown below naval.
export default function AgeEndPopup({ tokens, players, mySeat, onDismiss }) {
  const [canContinue, setCanContinue] = useState(false);
  // Prevent accidental instant-dismiss (especially Age 3, which was getting cut
  // off by the game-over screen). The Continue button enables after a short delay.
  useEffect(() => {
    const t = setTimeout(() => setCanContinue(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!tokens) return null;
  const n = players.length;
  const nameOf = (seat) => players.find((p) => p.seat === seat)?.player_name || "?";
  const colorOf = (seat) => players.find((p) => p.seat === seat)?.player_color || "#888";
  const mil = tokens.military || [];
  const naval = tokens.naval || [];
  const edifice = tokens.edifice || null;
  if (!mil.length && !naval.length && !edifice) return null;

  const byVs = {};
  for (const m of mil) (byVs[m.vs] = byVs[m.vs] || []).push(m);
  const leftSeat = (mySeat + 1) % n;
  const rightSeat = (mySeat - 1 + n) % n;
  const vsSeats = Object.keys(byVs).map(Number);
  const middle = vsSeats
    .filter((s) => s !== leftSeat && s !== rightSeat)
    .sort((a, b) => ((a - mySeat + n) % n) - ((b - mySeat + n) % n));
  const orderedSeats = [leftSeat, ...middle, rightSeat].filter((s) => byVs[s]);

  const navV = naval.filter((x) => x.type === "victory");
  const navD = naval.filter((x) => x.type === "defeat");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/20 rounded-xl p-6 max-w-2xl w-full text-white space-y-5 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-display font-bold text-center">Age {tokens.age} Resolution</h3>

        {orderedSeats.length > 0 && (
          <div>
            <p className="text-xs text-amber-300 uppercase mb-2">Military</p>
            <div className="flex gap-3 items-stretch">
              {orderedSeats.map((seat) => {
                const items = byVs[seat] || [];
                const won = items.find((t) => t.type === "trophy");
                const lost = items.find((t) => t.type === "defeat");
                return (
                  <div key={seat} className="flex-1 min-w-0 rounded-lg bg-white/5 border border-white/10 p-2.5 flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: colorOf(seat) }} />
                      <span className="text-xs font-medium truncate">{nameOf(seat)}</span>
                    </div>
                    {won && <img src={TOKEN_ICONS[won.age]} alt="" className="w-8 h-8" title="Victory" />}
                    {lost && <img src={TOKEN_ICONS.loss} alt="" className="w-8 h-8" title="Defeat" />}
                    {!won && !lost && <span className="text-[10px] text-stone-500">No conflict</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(navV.length > 0 || navD.length > 0) && (
          <div>
            <p className="text-xs text-cyan-300 uppercase mb-2">Naval</p>
            <div className="flex flex-wrap gap-3">
              {navV.map((t, i) => <div key={"nv" + i} className="flex items-center gap-2 bg-white/5 rounded px-2.5 py-1.5"><img src={NAVAL_TOKEN_IMAGES.victory[t.age]} alt="" className="w-8 h-8" /><span className="text-xs text-stone-300">Victory</span></div>)}
              {navD.map((t, i) => <div key={"nd" + i} className="flex items-center gap-2 bg-white/5 rounded px-2.5 py-1.5"><img src={NAVAL_TOKEN_IMAGES.defeat[t.age]} alt="" className="w-8 h-8" /><span className="text-xs text-stone-300">Defeat</span></div>)}
            </div>
          </div>
        )}

        {edifice && (
          <div>
            <p className="text-xs text-purple-300 uppercase mb-2">Edifice Resolution</p>
            <div className="flex items-center gap-3 rounded-lg bg-purple-500/10 border border-purple-500/30 p-3">
              {edifice.icon_url && (
                <div className="w-16 h-16 shrink-0">
                  <Image src={edifice.icon_url} fittingType="fit" className="w-full h-full object-contain rounded" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-purple-200">{edifice.name}</p>
                {edifice.rewards && edifice.rewards.length > 0 && (
                  <p className="text-xs text-emerald-300 mt-0.5">Gained: {edifice.rewards.join(", ")}</p>
                )}
                {edifice.penalties && edifice.penalties.length > 0 && (
                  <p className="text-xs text-red-300 mt-0.5">Lost: {edifice.penalties.join(", ")}</p>
                )}
                {(!edifice.rewards || edifice.rewards.length === 0) && (!edifice.penalties || edifice.penalties.length === 0) && (
                  <p className="text-xs text-stone-400 mt-0.5">Completed at end of Age {edifice.age}.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <Button onClick={onDismiss} disabled={!canContinue} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium">
          {canContinue ? "Continue" : "…"}
        </Button>
      </div>
    </div>
  );
}