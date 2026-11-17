import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { VPIcon } from "./Icons";

// VP breakdown popup: shows each scoring category and its contribution to
// the player's total victory points. Opened by clicking the VP total.
export default function VPBreakdownDialog({ score, onClose }) {
  const entries = Object.entries(score?.breakdown || {}).filter(([, v]) => v !== 0);
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const total = score?.total ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-stone-900 border border-white/20 rounded-xl max-w-md w-full p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VPIcon size={20} />
            <h3 className="font-semibold text-amber-300">Victory Point Breakdown</h3>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">No victory points yet.</p>
          ) : (
            entries.map(([label, val]) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-sm text-stone-300">{label}</span>
                <span className={`text-sm font-mono font-semibold ${val >= 0 ? "text-emerald-300" : "text-red-300"}`}>{val >= 0 ? "+" : ""}{val}</span>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="font-semibold text-stone-200">Total</span>
          <span className="text-lg font-bold text-amber-300 font-mono">{total}</span>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}