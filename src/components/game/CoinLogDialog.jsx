import React from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowUp, ArrowDown, ArrowLeftRight, ShieldAlert } from "lucide-react";
import { CoinIcon } from "./Icons";

// Coin log popup: shows all coin gains, spends, and trade income for the
// current player. Opened by clicking the coin icon on the player's board.
export default function CoinLogDialog({ player, onClose }) {
  const all = (player?.notifications || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const coinNotifs = all.filter((n) => ["coin_gain", "coin_spend", "trade", "cull", "tax", "penalty"].includes(n.type));

  const row = (n, i) => {
    const isSpend = n.type === "coin_spend" || n.type === "cull" || n.type === "tax";
    const isTrade = n.type === "trade";
    const isPenalty = n.type === "penalty";
    const Icon = isPenalty ? ShieldAlert : isSpend ? ArrowDown : isTrade ? ArrowLeftRight : ArrowUp;
    const color = isPenalty ? "text-red-400" : isSpend ? "text-red-300" : "text-emerald-300";
    const sign = isPenalty ? "" : isSpend ? "−" : "+";
    const label = isTrade
      ? `Trade — from ${n.fromName || "neighbor"}`
      : isPenalty
        ? `Penalty${n.fromName ? ` — ${n.fromName}` : ""}`
        : n.cardName
          ? n.cardName
          : isSpend ? "Spent" : "Gained";
    return (
      <div key={n.id || i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
        <Icon className={`h-4 w-4 shrink-0 ${color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-200 truncate">{label}</p>
          {n.fromName && !isTrade && !isPenalty && <p className="text-[10px] text-stone-500">from {n.fromName}</p>}
        </div>
        <span className={`text-sm font-mono font-semibold ${color}`}>{sign}{n.amount}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/20 rounded-xl max-w-md w-full p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CoinIcon size={20} />
            <h3 className="font-semibold text-amber-300">Coin History</h3>
            <span className="text-sm text-stone-400">({player?.coins || 0} now)</span>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {coinNotifs.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">No coin transactions yet.</p>
          ) : (
            coinNotifs.map(row)
          )}
        </div>
        <div className="flex justify-end pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}