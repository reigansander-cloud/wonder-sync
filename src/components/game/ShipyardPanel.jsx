import React from "react";
import { ARMADA_REWARDS, NAVAL_SHIELD_IMAGE, ARMADA_TRACK_COLORS, RESOURCE_ICONS } from "@/lib/game/constants";
import { CoinIcon, VPIcon } from "./Icons";

const TRACK_HEX = { red: "#b83232", yellow: "#d9b920", blue: "#2e5fa3", green: "#3d8b3d" };

function RewardBadge({ color, level }) {
  const r = ARMADA_REWARDS[color]?.[level];
  if (!r) return <span className="text-[8px] text-stone-600">—</span>;
  const bits = [];
  if (r.navalShields) bits.push(<span key="ns" className="flex items-center gap-0.5"><img src={NAVAL_SHIELD_IMAGE} alt="" className="w-3 h-3" />{r.navalShields}</span>);
  if (r.coins) bits.push(<span key="c" className="flex items-center gap-0.5"><CoinIcon size={11} />{r.coins}</span>);
  if (r.trade) bits.push(<span key="t" className="text-cyan-300 text-[8px]">TL{r.trade}</span>);
  if (r.cull) bits.push(<span key="cu" className="text-red-300 text-[8px]">-{r.cull}</span>);
  if (r.vp) bits.push(<span key="v" className="flex items-center gap-0.5"><VPIcon size={11} />{r.vp}</span>);
  if (r.island) bits.push(<span key="i" className="text-emerald-300 text-[8px]">Island</span>);
  return <span className="flex flex-col items-center gap-0.5 text-stone-200">{bits}</span>;
}

function CostBits({ cost }) {
  if (!cost) return <span className="text-stone-700">→</span>;
  const items = [];
  for (const [k, v] of Object.entries(cost)) {
    if (k === "coins") items.push(<span key={k} className="flex items-center gap-0.5"><CoinIcon size={10} />{v}</span>);
    else for (let n = 0; n < v; n++) items.push(<img key={k + n} src={RESOURCE_ICONS[k]} alt={k} className="w-3 h-3" />);
  }
  return <span className="flex items-center gap-0.5">{items}</span>;
}

// Display-only Armada shipyard board. Each of the 4 tracks is a horizontal row
// of 7 level cells (1→7 left to right) with the cost to advance between them,
// the per-level reward, and the boat marker on the current level.
export default function ShipyardPanel({ player, compact = false, onlyColor = null }) {
  const board = player?.armada_board || {};
  const tracks = onlyColor ? ARMADA_TRACK_COLORS.filter((c) => c === onlyColor) : ARMADA_TRACK_COLORS;
  return (
    <div className="space-y-2.5">
      {tracks.map((color) => {
        const tr = board[color] || { level: 1, costs: [], wonder: false };
        return (
          <div key={color} className="rounded-lg border p-2" style={{ borderColor: `${TRACK_HEX[color]}60`, background: `${TRACK_HEX[color]}10` }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TRACK_HEX[color] }}>{color} Track</span>
              {tr.wonder && <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-500/40">★ Wonder Badge</span>}
            </div>
            <div className="flex items-stretch gap-0.5">
              {[1, 2, 3, 4, 5, 6, 7].map((lvl) => {
                const isBoat = tr.level === lvl;
                const passed = tr.level > lvl;
                const costToNext = tr.costs?.[lvl + 1];
                return (
                  <React.Fragment key={lvl}>
                    <div
                      className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 px-0.5 min-h-[44px] ${
                        isBoat
                          ? "bg-white/25 ring-2 ring-white/60"
                          : passed
                            ? "bg-white/10"
                            : "bg-white/5"
                      }`}
                      style={isBoat ? { boxShadow: `0 0 8px ${TRACK_HEX[color]}` } : undefined}
                    >
                      <RewardBadge color={color} level={lvl} />
                      <span className="text-[11px] leading-none">{isBoat ? "⛵" : passed ? "✓" : ""}</span>
                    </div>
                    {lvl < 7 && (
                      <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                        <CostBits cost={costToNext} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
      {!compact && (
        <p className="text-[10px] text-stone-500 text-center pt-1">Build a card of a track's color (or build a wonder tier for the badge track) to advance that ship.</p>
      )}
    </div>
  );
}