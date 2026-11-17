import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Coins, ShieldAlert, Swords, Anchor, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DISPLAY_MAX = 7;
const STORAGE_MAX = 50;

// Main notification bar: shows opponent-driven events (trade income, cull,
// penalty, military defeat, boarding, unearth, edifice). Coin gains/spends
// are hidden here — they appear in the coin log (click your coin icon).
export default function NotificationsRow({ player }) {
  const [active, setActive] = useState(null);
  const all = (player?.notifications || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const visible = all.filter((n) => n.type !== "coin_gain" && n.type !== "coin_spend").slice(0, DISPLAY_MAX);

  useEffect(() => {
    if (!player?.id) return;
    if ((player.notifications || []).length <= STORAGE_MAX) return;
    const trimmed = (player.notifications || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, STORAGE_MAX);
    base44.entities.PlayerState.update(player.id, { notifications: trimmed }).catch(() => {});
  }, [player?.id, (player?.notifications || []).length]);

  const dismiss = (id) => {
    if (!player?.id) return;
    // Removed on the server in one step, so it can't wipe a notification
    // that arrived a moment ago.
    base44.entities.PlayerState.listEdit(player.id, ["notifications"], { remove: [id] }).catch(() => {});
  };

  if (!visible.length) return null;

  const badge = (n) => {
    switch (n.type) {
      case "trade":
        return { text: `+${n.amount}`, icon: <Coins size={13} />, cls: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" };
      case "cull": case "tax": {
        const neg = -(n.amount || 0);
        return { text: n.shortfall ? `${neg}/−${n.shortfall}` : `${neg}`, icon: <Coins size={13} />, cls: "bg-orange-500/20 border-orange-500/40 text-orange-300" };
      }
      case "penalty":
        return { text: `+${n.amount || 1}`, icon: <ShieldAlert size={13} />, cls: "bg-red-500/20 border-red-500/40 text-red-300" };
      case "defeat":
        return { text: "−1", icon: <Swords size={13} />, cls: "bg-red-500/20 border-red-500/40 text-red-300" };
      case "boarded":
        return { text: " boarded", icon: <Anchor size={13} />, cls: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" };
      case "unearth":
        return { text: "unearth", icon: <Coins size={13} />, cls: "bg-amber-500/20 border-amber-500/40 text-amber-300" };
      case "edifice_reward":
        return { text: "edifice", icon: <Coins size={13} />, cls: "bg-purple-500/20 border-purple-500/40 text-purple-300" };
      default:
        return { text: n.text || "•", icon: null, cls: "bg-white/5 border-white/10 text-stone-300" };
    }
  };

  const detail = (n) => {
    switch (n.type) {
      case "trade": return `Received ${n.amount} coins from ${n.fromName || "neighbor"} in trade.`;
      case "cull": return `Lost ${n.amount} coins to ${n.fromName || "an opponent"}'s cull${n.shortfall ? ` and took ${n.shortfall} penalty token(s) for the shortfall` : ""}.`;
      case "tax": return `Taxed by ${n.fromName || "opponent"}'s yellow Armada track: lost ${n.amount} coins${n.shortfall ? ` plus ${n.shortfall} penalty token(s)` : ""}.`;
      case "penalty": return `Took ${n.amount || 1} penalty token(s) from ${n.fromName || "an effect"}${n.cardName ? ` (${n.cardName})` : ""}.`;
      case "defeat": return `Defeated by ${n.fromName || "neighbor"} in military resolution (Age ${n.age || "?"}).`;
      case "boarded": return `Boarded (Age ${n.age || "?"}).`;
      case "unearth": return n.text || "Unearthed a card from the discard pile.";
      case "edifice_reward": return n.text || "Edifice completed — reward gained.";
      default: return n.text || "Notification";
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {visible.map((n) => {
          const b = badge(n);
          return (
            <button key={n.id} type="button" onClick={() => setActive(n)} className={cn("flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold max-w-[160px] transition hover:opacity-70", b.cls)} title={`${detail(n)} (click to view)`}>
              {b.icon}
              <span className="truncate">{b.text}</span>
            </button>
          );
        })}
      </div>
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="bg-stone-900 border border-white/20 rounded-xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-amber-300">Notification</h3>
              <Button size="icon" variant="ghost" onClick={() => { dismiss(active.id); setActive(null); }}><X className="h-5 w-5" /></Button>
            </div>
            <p className="text-sm text-stone-200">{detail(active)}</p>
            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => { dismiss(active.id); setActive(null); }}>Dismiss</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}