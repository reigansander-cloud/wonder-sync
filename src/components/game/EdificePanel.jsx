import React, { useState } from "react";
import { Landmark, X } from "lucide-react";
import EdificeGrid from "./EdificeGrid";

// A button that opens a popup showing the three age edifices with their cost,
// rewards, penalties, and remaining patronage tokens.
export default function EdificePanel({ game, players }) {
  const [open, setOpen] = useState(false);
  if (!game?.edifice_expansion) return null;

  return (
    <div className="relative flex-1 flex flex-col">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 min-h-[80px] rounded-xl border bg-white/5 border-white/10 hover:bg-white/[0.07] transition p-3 flex flex-col items-center justify-center gap-1 text-stone-200">
        <Landmark className="h-6 w-6 text-amber-400" />
        <span className="font-medium text-sm">Edifices</span>
        <span className="text-[10px] text-stone-400">3 ages</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto rounded-xl border border-white/10 bg-stone-900 shadow-xl p-4 space-y-3 max-w-4xl w-full max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-300 uppercase tracking-wide">Edifices</span>
                <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <EdificeGrid game={game} players={players} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}