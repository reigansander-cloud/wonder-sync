import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";

const COUNTS = [3, 4, 5, 6, 7];

export default function DeckRulesDialog({ value, onChange, packs = [], className = "", hideSummary = false }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(value.pack ? "pack" : "counts");
  const player_counts = value.player_counts || [];
  const pack = value.pack || "";

  // If a pack is assigned externally (e.g. loading an existing card), reflect it.
  useEffect(() => { if (value.pack) setMode("pack"); }, [value.pack]);

  const apply = (patch) => onChange({ ...value, ...patch });
  const switchMode = (m) => { setMode(m); if (m === "counts") apply({ pack: "" }); };
  const toggleCount = (n) => {
    const next = player_counts.includes(n) ? player_counts.filter((x) => x !== n) : [...player_counts, n].sort();
    apply({ player_counts: next });
  };

  const suggestions = ["purple", "cities", "island", ...packs.filter((p) => p !== "purple" && p !== "cities" && p !== "island")];

  return (
    <div>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className={`bg-white/5 border-white/10 ${className} justify-start`}>
        <Settings2 className="h-4 w-4 mr-2 shrink-0" />
        <span className="font-medium">Deck Rules</span>
        <span className="ml-2 text-xs text-stone-400 font-normal truncate">
          {mode === "pack"
            ? `Pack "${pack || "(unnamed)"}" · Counts: ${player_counts.length ? player_counts.join(", ") : "all"}`
            : `Counts: ${player_counts.length ? player_counts.join(", ") : "all"}`}
        </span>
      </Button>
      {!hideSummary && (
        <p className="text-xs text-stone-400 mt-2">
          {mode === "pack"
            ? `Pack “${pack || "(unnamed)"}” — one card per player shuffled in when this pack is on, +1 card each. Valid for ${player_counts.length ? player_counts.join(", ") : "all"} players.`
            : `Included at player counts: ${player_counts.length ? player_counts.join(", ") : "all"}`}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-stone-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Deck Rules</DialogTitle>
            <DialogDescription className="text-stone-400">Choose how this card enters the deck for each game.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => switchMode("counts")} className={mode === "counts" ? "bg-amber-500 text-black" : "bg-white/5 border border-white/10 text-stone-300"}>Player Counts</Button>
            <Button type="button" size="sm" onClick={() => switchMode("pack")} className={mode === "pack" ? "bg-amber-500 text-black" : "bg-white/5 border border-white/10 text-stone-300"}>Pack</Button>
          </div>

          {mode === "pack" && (
            <div className="space-y-2">
              <Label>Pack name</Label>
              <Input list="pack-suggestions" value={pack} onChange={(e) => apply({ pack: e.target.value })} placeholder="e.g. cities, purple, or a new pack" className="bg-white/5 border-white/10" />
              <datalist id="pack-suggestions">
                {suggestions.map((p) => <option key={p} value={p} />)}
              </datalist>
              <p className="text-xs text-stone-400">A pack is an expansion: when toggled on for a game, one card per player is shuffled in and players are dealt an extra card. <span className="text-amber-300">purple</span> is always on (Age III, exactly 5 guild cards, no extra draw) and <span className="text-amber-300">cities</span> is the Cities expansion. <span className="text-amber-300">island</span> cards are drawn from the Armada green track (never dealt into hands).</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Valid player counts</Label>
            <div className="flex gap-2">
              {COUNTS.map((n) => (
                <button key={n} type="button" onClick={() => toggleCount(n)} className={`w-10 h-10 rounded-lg border-2 font-semibold ${player_counts.includes(n) ? "bg-amber-500 text-black border-amber-400" : "bg-white/5 border-white/10"}`}>{n}</button>
              ))}
            </div>
            <p className="text-xs text-stone-400">Card only enters games with these player counts. Leave all unchecked to include for every count.</p>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)} className="bg-amber-500 hover:bg-amber-600 text-black">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}