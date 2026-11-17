import React, { useState } from "react";

// The banner always shows the bottom quarter of the artwork vertically, and
// optionally a narrower horizontal band chosen with the editor's vertical cut
// bars. The crop rectangle ({ x, y, w, h }, fractions) is displayed scaled to
// fill the banner with its natural aspect ratio (no distortion). No cost overlay
// — the image itself conveys each tier's cost.
const DEFAULT_CROP = { x: 0, y: 0.75, w: 1, h: 0.25 };

export default function WonderBanner({ wonder, built = 0, canBuild, onBuild, compact = false }) {
  const total = (wonder.stages || []).length;
  const imgUrl = wonder.image_url;
  const [nat, setNat] = useState({ w: 0, h: 0 });
  if (!imgUrl || !total) return null;

  const builtCount = Math.min(built, total);
  const nextIdx = builtCount;
  // Tier boundaries — manual drag bars (wonder.tier_cuts) or equal fractions.
  const cuts = Array.isArray(wonder.tier_cuts) && wonder.tier_cuts.length === Math.max(0, total - 1) ? wonder.tier_cuts : null;
  const bounds = [];
  for (let i = 0; i <= total; i++) bounds.push(i === 0 ? 0 : i === total ? 1 : cuts ? cuts[i - 1] : i / total);

  const crop = wonder.image_crop || DEFAULT_CROP;
  const cx = crop.x ?? 0;
  const cy = crop.y ?? 0.75;
  const cw = crop.w ?? 1;
  const ch = crop.h ?? 0.25;
  // Match the crop rectangle's aspect ratio so the artwork is never stretched.
  const aspect = nat.w && nat.h ? `${cw * nat.w} / ${ch * nat.h}` : `${cw} / ${ch}`;

  return (
    <div className="w-full">
      <div
        className="relative w-full rounded-lg overflow-hidden border-2 select-none"
        style={{ borderColor: wonder.color || "#d4a64a", aspectRatio: aspect }}
      >
        {/* The artwork, scaled so the crop rectangle fills the banner, then
            translated so that rectangle's top-left sits at the banner origin. */}
        <img
          src={imgUrl}
          alt={wonder.name}
          draggable={false}
          onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          className="absolute top-0 left-0 h-auto block pointer-events-none select-none"
          style={{ width: `${100 / cw}%`, transform: `translate(${-cx * 100}%, ${-cy * 100}%)` }}
        />
        {wonder.stages.map((st, i) => {
          const isBuilt = i < builtCount;
          const isNext = i === nextIdx;
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{
                left: `${bounds[i] * 100}%`,
                width: `${(bounds[i + 1] - bounds[i]) * 100}%`,
                background: isBuilt ? "transparent" : "linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.55))",
                boxShadow: i > 0 ? "inset 1px 0 0 rgba(255,255,255,0.15)" : "none",
              }}
            >
              {isNext && (
                <button
                  type="button"
                  disabled={!canBuild}
                  onClick={canBuild ? onBuild : undefined}
                  className={`absolute inset-0 transition ${canBuild ? "hover:bg-amber-400/20 cursor-pointer ring-2 ring-amber-400/70 ring-inset" : "cursor-not-allowed"}`}
                  title={canBuild ? `Build tier ${nextIdx + 1}` : "Can't afford next tier"}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}