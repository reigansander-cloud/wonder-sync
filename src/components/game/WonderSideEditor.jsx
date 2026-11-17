import React, { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Layers, Upload, X } from "lucide-react";
import { ResourceIcon, CoinIcon } from "./Icons";
import EffectEditor from "./EffectEditor";
import WonderCropPicker from "./WonderCropPicker";
import WonderTierBars from "./WonderTierBars";
import { RESOURCE_ORDER } from "@/lib/game/constants";
import { base44 } from "@/api/base44Client";

const emptyCost = { wood: 0, stone: 0, clay: 0, ore: 0, glass: 0, papyrus: 0, loom: 0 };

export default function WonderSideEditor({ label, side, onChange }) {
  const stages = side.stages || [];
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const setStart = (r) => onChange({ ...side, start_resource: r });
  const setStage = (i, st) => onChange({ ...side, stages: stages.map((s, idx) => (idx === i ? st : s)) });
  const addStage = () => { if (stages.length >= 4) return; onChange({ ...side, tier_cuts: null, stages: [...stages, { cost: { ...emptyCost }, effects: [] }] }); };
  const removeStage = (i) => onChange({ ...side, tier_cuts: null, stages: stages.filter((_, idx) => idx !== i) });
  const upload = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange({ ...side, image_url: file_url });
    } finally { setUploading(false); }
  };
  const clearArt = () => onChange({ ...side, image_url: "", image_crop: null, tier_cuts: null });

  return (
    <div className="rounded-lg border border-white/10 p-4 space-y-4 bg-white/5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? "Uploading…" : "Upload Art"}</Button>
          {side.image_url && <Button type="button" variant="ghost" size="sm" onClick={clearArt}><X className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>
      {side.image_url && (
        <WonderCropPicker url={side.image_url} crop={side.image_crop} onChange={(c) => onChange({ ...side, image_crop: c })} />
      )}
      {side.image_url && (side.stages || []).length >= 2 && (
        <WonderTierBars url={side.image_url} crop={side.image_crop} tierCuts={side.tier_cuts} total={(side.stages || []).length} onChange={(c) => onChange({ ...side, tier_cuts: c })} />
      )}
      <div className="flex items-center gap-2">
        <Label className="text-sm whitespace-nowrap">Starting resource</Label>
        <select value={side.start_resource || ""} onChange={(e) => setStart(e.target.value)} className="flex-1 h-9 rounded-md bg-white/5 border border-white/10 px-2 text-sm capitalize">
          <option value="">None</option>
          {RESOURCE_ORDER.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
        </select>
      </div>
      <div className="space-y-3">
        {stages.map((st, i) => (
          <TierEditor key={i} index={i} stage={st} onChange={(s) => setStage(i, s)} onRemove={() => removeStage(i)} />
        ))}
        {stages.length < 4 && (
          <Button size="sm" variant="outline" onClick={addStage} className="border-white/20 text-white hover:bg-white/10"><Plus className="h-4 w-4 mr-1" /> Add Tier</Button>
        )}
      </div>
    </div>
  );
}

function TierEditor({ index, stage, onChange, onRemove }) {
  const multi = Array.isArray(stage.choices) && stage.choices.length > 0;
  const setMulti = (on) => {
    if (on) onChange({ ...stage, choices: [stage.effects || []], effects: undefined });
    else onChange({ ...stage, choices: undefined, effects: (stage.choices || [])[0] || [] });
  };
  const setOption = (oi, effs) => onChange({ ...stage, choices: (stage.choices || []).map((o, idx) => (idx === oi ? effs : o)) });
  const addOption = () => onChange({ ...stage, choices: [...(stage.choices || []), []] });
  const removeOption = (oi) => onChange({ ...stage, choices: (stage.choices || []).filter((_, idx) => idx !== oi) });

  return (
    <div className="rounded-md border border-white/10 p-3 space-y-2 bg-stone-950/40">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Tier {index + 1}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-stone-400 cursor-pointer">
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
            <Layers className="h-3 w-3" /> Multi-choice
          </label>
          <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-red-400" /></Button>
        </div>
      </div>
      <div>
        <Label className="text-xs">Cost (click +1, right-click -1)</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {RESOURCE_ORDER.map((r) => (
            <button key={r} type="button"
              onClick={() => onChange({ ...stage, cost: { ...stage.cost, [r]: (stage.cost[r] || 0) + 1 } })}
              onContextMenu={(e) => { e.preventDefault(); onChange({ ...stage, cost: { ...stage.cost, [r]: Math.max(0, (stage.cost[r] || 0) - 1) } }); }}
              className={`flex items-center gap-1 px-2 py-1 rounded border text-xs ${(stage.cost[r] || 0) > 0 ? "bg-amber-500/20 border-amber-500/50" : "bg-white/5 border-white/10"}`}>
              <ResourceIcon resource={r} size={16} />
              <span>{stage.cost[r] || 0}</span>
            </button>
          ))}
          <button type="button"
            onClick={() => onChange({ ...stage, cost_coins: (stage.cost_coins || 0) + 1 })}
            onContextMenu={(e) => { e.preventDefault(); onChange({ ...stage, cost_coins: Math.max(0, (stage.cost_coins || 0) - 1) }); }}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-xs ${(stage.cost_coins || 0) > 0 ? "bg-amber-500/20 border-amber-500/50" : "bg-white/5 border-white/10"}`}>
            <CoinIcon size={16} />
            <span>{stage.cost_coins || 0}</span>
          </button>
        </div>
      </div>
      {multi ? (
        <div className="space-y-3">
          {(stage.choices || []).map((opt, oi) => (
            <div key={oi} className="rounded-md border border-amber-500/30 p-2 space-y-2 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-300">Option {oi + 1}</span>
                <div className="flex gap-1">
                  {(stage.choices || []).length > 1 && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeOption(oi)}><Trash2 className="h-3 w-3 text-red-400" /></Button>}
                </div>
              </div>
              <EffectEditor effects={opt || []} onChange={(effects) => setOption(oi, effects)} />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addOption} className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
          <p className="text-[11px] text-stone-500">When built, the player picks one option. The chosen effects are applied and scored.</p>
        </div>
      ) : (
        <div>
          <Label className="text-xs">Effects</Label>
          <div className="mt-1"><EffectEditor effects={stage.effects || []} onChange={(effects) => onChange({ ...stage, effects })} /></div>
        </div>
      )}
    </div>
  );
}