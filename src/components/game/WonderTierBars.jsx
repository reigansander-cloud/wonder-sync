import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MoveHorizontal, RotateCcw } from "lucide-react";

// Drag the vertical bars to manually divide the banner into tier portions,
// instead of the default equal fractions. The preview mirrors exactly what
// the in-game banner shows (bottom quarter, width-cropped, natural aspect).
// `tierCuts` is an array of length total-1 (ascending fractions 0..1); null
// means "use equal fractions".
const FIXED_Y = 0.75;
const FIXED_H = 0.25;
const DEFAULT_CROP = { x: 0, y: FIXED_Y, w: 1, h: FIXED_H };
const MIN_GAP = 0.04;

export default function WonderTierBars({ url, crop, tierCuts, total, onChange }) {
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null); // bar index being dragged
  const [nat, setNat] = useState({ w: 0, h: 0 });

  const cur = crop || DEFAULT_CROP;
  const cx = cur.x ?? 0;
  const cy = cur.y ?? FIXED_Y;
  const cw = cur.w ?? 1;
  const ch = cur.h ?? FIXED_H;
  const aspect = nat.w && nat.h ? `${cw * nat.w} / ${ch * nat.h}` : `${cw} / ${ch}`;

  const valid = Array.isArray(tierCuts) && tierCuts.length === total - 1;
  const cuts = valid ? [...tierCuts] : Array.from({ length: total - 1 }, (_, k) => (k + 1) / total);
  const cutsRef = useRef(cuts);
  cutsRef.current = cuts;

  useEffect(() => { setDrag(null); }, [url]);

  useEffect(() => {
    if (drag == null) return;
    const move = (e) => {
      const r = wrapRef.current.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const next = [...cutsRef.current];
      let v = p;
      v = Math.max((next[drag - 1] ?? 0) + MIN_GAP, v);
      v = Math.min((next[drag + 1] ?? 1) - MIN_GAP, v);
      next[drag] = v;
      onChange(next);
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag]);

  if (total < 2) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-400 flex items-center gap-1"><MoveHorizontal className="h-3 w-3" /> Drag the bars to position each tier</span>
        {valid && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}><RotateCcw className="h-3 w-3 mr-1" />Equal</Button>}
      </div>
      <div ref={wrapRef} className="relative w-full rounded-md overflow-hidden border border-white/10 select-none" style={{ aspectRatio: aspect }}>
        <img
          src={url}
          alt="wonder banner preview"
          draggable={false}
          onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          className="absolute top-0 left-0 h-auto block pointer-events-none select-none"
          style={{ width: `${100 / cw}%`, transform: `translate(${-cx * 100}%, ${-cy * 100}%)` }}
        />
        {cuts.map((c, i) => (
          <div
            key={i}
            onMouseDown={(e) => { e.preventDefault(); setDrag(i); }}
            className="absolute top-0 bottom-0 w-1.5 bg-cyan-400 cursor-ew-resize hover:bg-cyan-300"
            style={{ left: `${c * 100}%`, transform: "translateX(-50%)" }}
          />
        ))}
      </div>
      <p className="text-[10px] text-stone-500">Each bar marks a tier boundary — left of the first bar is tier 1, right of the last bar is the final tier.</p>
    </div>
  );
}