import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MoveHorizontal, RotateCcw } from "lucide-react";

// The banner always shows the bottom quarter of the artwork. Drag the two
// VERTICAL cut bars left/right to narrow the horizontal band shown. The crop is
// stored as { x, y: 0.75, w, h: 0.25 } (fractions). The lobby preview always
// shows the full, uncropped image.
const FIXED_Y = 0.75;
const FIXED_H = 0.25;
const DEFAULT_CROP = { x: 0, y: FIXED_Y, w: 1, h: FIXED_H };
const MIN_W = 0.1;

export default function WonderCropPicker({ url, crop, onChange }) {
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null); // "left" | "right"
  const cur = crop || DEFAULT_CROP;
  const xLeft = cur.x;
  const xRight = cur.x + cur.w;
  const ref = useRef({ xLeft, xRight });
  ref.current = { xLeft, xRight };

  useEffect(() => { setDrag(null); }, [url]);

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const r = wrapRef.current.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const { xLeft, xRight } = ref.current;
      let left = xLeft, right = xRight;
      if (drag === "left") left = Math.min(right - MIN_W, Math.max(0, p));
      else right = Math.max(left + MIN_W, Math.min(1, p));
      if (left <= 0.001 && right >= 0.999) onChange(null);
      else onChange({ x: left, y: FIXED_Y, w: right - left, h: FIXED_H });
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-400 flex items-center gap-1"><MoveHorizontal className="h-3 w-3" /> Drag the bars to crop the banner's width</span>
        {crop && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}><RotateCcw className="h-3 w-3 mr-1" />Reset</Button>}
      </div>
      <div ref={wrapRef} className="relative w-full rounded-md overflow-hidden border border-white/10 select-none">
        <img src={url} alt="wonder artwork" draggable={false} className="w-full h-auto block pointer-events-none" />
        {/* The banner only ever shows the bottom quarter — dim the top 3/4. */}
        <div className="absolute left-0 right-0 top-0 bg-black/60 pointer-events-none" style={{ height: `${FIXED_Y * 100}%` }} />
        {/* Dim the cropped-away left/right edges. */}
        {xLeft > 0.001 && <div className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none" style={{ width: `${xLeft * 100}%` }} />}
        {xRight < 0.999 && <div className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none" style={{ width: `${(1 - xRight) * 100}%` }} />}
        {/* Vertical cut bars. */}
        <div
          onMouseDown={(e) => { e.preventDefault(); setDrag("left"); }}
          className="absolute top-0 bottom-0 w-1.5 bg-amber-400 cursor-ew-resize"
          style={{ left: `${xLeft * 100}%`, transform: "translateX(-50%)" }}
        />
        <div
          onMouseDown={(e) => { e.preventDefault(); setDrag("right"); }}
          className="absolute top-0 bottom-0 w-1.5 bg-amber-400 cursor-ew-resize"
          style={{ left: `${xRight * 100}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <p className="text-[10px] text-stone-500">The banner shows the bottom quarter of the artwork, cropped to the width between the bars (no distortion). Lobby preview stays uncropped.</p>
    </div>
  );
}