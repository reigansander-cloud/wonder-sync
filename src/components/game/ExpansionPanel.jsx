import React, { useState } from "react";
import { Anchor, X } from "lucide-react";
import EdificePanel from "./EdificePanel";
import ShipyardPanel from "./ShipyardPanel";
import EdificeGrid from "./EdificeGrid";

// Unified Expansion button. Shows a single "Expansion" button (with tabs) when
// both Edifice and Armada are on; otherwise the individual panel. The shipyard
// shown is the current player's own board.
export default function ExpansionPanel({ game, players, me }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("shipyard");
  const edifice = !!game?.edifice_expansion;
  const armada = !!game?.armada_expansion;
  if (!edifice && !armada) return null;

  if (edifice && !armada) return <EdificePanel game={game} players={players} />;
  if (armada && !edifice) return <ShipyardButton game={game} me={me} />;

  return (
    <div className="relative flex-1 flex flex-col">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 min-h-[56px] md:min-h-[80px] rounded-xl border bg-white/5 border-white/10 hover:bg-white/[0.07] transition p-1.5 md:p-3 flex flex-col items-center justify-center gap-0.5 md:gap-1 text-stone-200">
        <Anchor className="h-5 w-5 md:h-6 md:w-6 text-cyan-400" />
        <span className="font-medium text-[11px] md:text-sm">Expansion</span>
        <span className="text-[9px] md:text-[10px] text-stone-400">Edifice · Armada</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto rounded-xl border border-white/10 bg-stone-900 shadow-xl p-4 space-y-3 max-w-4xl w-full max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setTab("shipyard")} className={`px-3 py-1.5 rounded text-sm ${tab === "shipyard" ? "bg-cyan-600 text-white" : "bg-white/5 text-stone-300"}`}>Shipyard</button>
                  <button onClick={() => setTab("edifice")} className={`px-3 py-1.5 rounded text-sm ${tab === "edifice" ? "bg-amber-500 text-black" : "bg-white/5 text-stone-300"}`}>Edifices</button>
                </div>
                <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              {tab === "shipyard" ? <ShipyardPanel player={me} /> : <EdificeGrid game={game} players={players} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ShipyardButton({ game, me }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-1 flex flex-col">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 min-h-[56px] md:min-h-[80px] rounded-xl border bg-white/5 border-white/10 hover:bg-white/[0.07] transition p-1.5 md:p-3 flex flex-col items-center justify-center gap-0.5 md:gap-1 text-stone-200">
        <Anchor className="h-5 w-5 md:h-6 md:w-6 text-cyan-400" />
        <span className="font-medium text-[11px] md:text-sm">Shipyard</span>
        <span className="text-[9px] md:text-[10px] text-stone-400">Armada</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto rounded-xl border border-white/10 bg-stone-900 shadow-xl p-4 space-y-3 max-w-3xl w-full max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-cyan-300 uppercase tracking-wide">Your Shipyard</span>
                <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <ShipyardPanel player={me} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}