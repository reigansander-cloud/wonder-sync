import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CardView from "@/components/game/CardView";

// Mirror: when a "mirror" card is played, the player chooses a card already in
// their city; the mirror card copies that card's effects.
export default function MirrorDialog({ player, allCardsById, onConfirm, onCancel }) {
  const [sel, setSel] = useState(null);
  const played = (player.played_cards || [])
    .map((c) => allCardsById[c.id] || c)
    .filter(Boolean);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="bg-stone-900 border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mirror — choose a card to copy</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-stone-400">
          Select a card in your city. This card copies that card&rsquo;s effects.
        </p>
        {played.length === 0 ? (
          <p className="text-sm text-stone-500 italic">No cards in your city to copy.</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-[50vh] overflow-y-auto p-1">
            {played.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSel(c.id)}
                className={`rounded-lg border-2 p-1 transition ${sel === c.id ? "border-amber-400 bg-amber-400/10" : "border-transparent hover:border-white/20"}`}
              >
                <CardView card={c} size="sm" selected={sel === c.id} />
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button disabled={!sel} className="bg-amber-500 hover:bg-amber-600 text-black" onClick={() => onConfirm(sel)}>
            Copy Effects
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}