import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Save, Upload, Settings2 } from "lucide-react";
import EffectEditor, { describeEffect } from "@/components/game/EffectEditor";
import CardView from "@/components/game/CardView";
import { ResourceIcon } from "@/components/game/Icons";
import { CARD_COLORS, RESOURCE_ORDER, AGES } from "@/lib/game/constants";
import { useChainSymbols } from "@/lib/game/useChainSymbols";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DeckRulesDialog from "@/components/game/DeckRulesDialog";
import ChainSymbolsManager from "@/components/game/ChainSymbolsManager";

const emptyCost = { wood: 0, stone: 0, clay: 0, ore: 0, glass: 0, papyrus: 0, loom: 0 };

export default function CardEditor() {
  const { symbols: chainSymbols, custom, add, remove } = useChainSymbols();
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState({
    name: "", image_url: "", age: "1", color: "brown",
    cost_coins: 0, cost_resources: { ...emptyCost }, chain_cost: "", chain_symbols: [],
    description: "", player_counts: [3, 4, 5, 6, 7], effects: [],
    pack: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const fileRef = useRef(null);
  const [knownPacks, setKnownPacks] = useState([]);
  const [keepTemplate, setKeepTemplate] = useState(() => localStorage.getItem("wonders_keep_template") === "1");

  useEffect(() => {
    base44.entities.Card.list("-created_date", 5000).then((all) => {
      const s = new Set();
      for (const c of all || []) if (c.pack && c.pack !== "purple" && c.pack !== "cities" && c.pack !== "island" && c.pack !== "armada") s.add(c.pack);
      setKnownPacks([...s]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (id) {
      base44.entities.Card.get(id).then((c) => {
        setCard({ ...card, ...c, pack: c.pack || "", cost_resources: { ...emptyCost, ...(c.cost_resources || {}) } });
      });
    } else {
      const tpl = localStorage.getItem("wonders_card_template");
      if (tpl) {
        try {
          const t = JSON.parse(tpl);
          setCard({
            ...card,
            player_counts: t.player_counts || card.player_counts,
            pack: t.pack || "",
            age: t.age || card.age,
            effects: t.effects || card.effects,
            color: t.color || card.color,
            image_url: "",
            cost_resources: { ...emptyCost },
            id: undefined, created_date: undefined, updated_date: undefined, created_by_id: undefined,
          });
        } catch {}
      }
    }
  }, [id]);

  const set = (patch) => setCard({ ...card, ...patch });

  const uploadImage = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set({ image_url: file_url });
    } finally {
      setUploading(false);
    }
  };

  const toggleCount = (n) => {
    const counts = card.player_counts.includes(n) ? card.player_counts.filter((x) => x !== n) : [...card.player_counts, n].sort();
    set({ player_counts: counts });
  };

  const setCostRes = (r, v) => set({ cost_resources: { ...card.cost_resources, [r]: v } });

  const toggleChain = (sym) => {
    set({ chain_symbols: card.chain_symbols.includes(sym) ? card.chain_symbols.filter((x) => x !== sym) : [...card.chain_symbols, sym] });
  };

  const save = async () => {
    if (!card.name.trim()) return alert("Card needs a name.");
    setSaving(true);
    try {
      const { id: _cardId, created_date, updated_date, created_by_id, ...rest } = card;
      const payload = {
        ...rest,
        cost_coins: Number(card.cost_coins) || 0,
        cost_resources: card.cost_resources,
        pack: card.pack || "",
      };
      if (id) await base44.entities.Card.update(id, payload);
      else await base44.entities.Card.create(payload);
      if (keepTemplate) {
        localStorage.setItem("wonders_card_template", JSON.stringify({
          player_counts: card.player_counts,
          pack: card.pack || "",
          age: card.age,
          effects: card.effects,
          color: card.color,
        }));
      } else {
        localStorage.removeItem("wonders_card_template");
      }
      navigate("/cards");
    } catch (e) {
      alert("Could not save card: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const colorHex = CARD_COLORS.find((c) => c.key === card.color)?.hex;

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link to="/cards" className="inline-flex items-center text-stone-400 hover:text-white text-sm mb-6"><ArrowLeft className="h-4 w-4 mr-1" /> Library</Link>
        <h1 className="text-4xl font-display font-bold mb-8">{id ? "Edit Card" : "Create Card"}</h1>

        <div className="grid lg:grid-cols-[1fr_500px] gap-8">
          <div className="space-y-6">
            {/* Basics */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Basics</h2>
                  <div className="flex items-center gap-2">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0])} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading…" : "Upload Art"}
                    </Button>
                    {card.image_url && <span className="text-xs text-green-400">✓</span>}
                  </div>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={card.name} onChange={(e) => set({ name: e.target.value })} className="bg-white/5 border-white/10" placeholder="e.g. Lumber Yard" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Age</Label>
                    <Select value={card.age} onValueChange={(v) => set({ age: v })}>
                      <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>{AGES.map((a) => <SelectItem key={a} value={a}>{a === "leader" ? "Leader" : `Age ${a}`}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Color</Label>
                    <Select value={card.color} onValueChange={(v) => set({ color: v, ...((v === "black" || v === "purple") && !card.pack ? { pack: v === "black" ? "cities" : "purple" } : {}) })}>
                      <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>{CARD_COLORS.map((c) => <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description (shown on hover)</Label>
                  <Textarea value={card.description} onChange={(e) => set({ description: e.target.value })} className="bg-white/5 border-white/10" rows={2} placeholder="Flavor / rules text" />
                </div>
              </CardContent>
            </Card>

            {/* Cost */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-semibold text-lg">Cost</h2>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-stone-400 h-7 flex items-center">Coins</span>
                    <input type="number" min={-1} value={card.cost_coins} onChange={(e) => set({ cost_coins: e.target.value })} className="w-12 h-8 text-center bg-white/5 border border-white/10 rounded text-sm" />
                    <span className="text-[9px] text-stone-500 text-center leading-tight">−1 = A<br/>(age cost)</span>
                  </div>
                  {RESOURCE_ORDER.map((r) => (
                    <div key={r} className="flex flex-col items-center gap-1">
                      <ResourceIcon resource={r} size={28} />
                      <input type="number" min={0} max={4} value={card.cost_resources[r] || 0} onChange={(e) => setCostRes(r, parseInt(e.target.value) || 0)} className="w-12 h-8 text-center bg-white/5 border border-white/10 rounded text-sm" />
                    </div>
                  ))}
                </div>
                <div>
                  <Label>Chain Cost (optional — free if you own this chain symbol)</Label>
                  <Select value={card.chain_cost || "none"} onValueChange={(v) => set({ chain_cost: v === "none" ? "" : v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {chainSymbols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Chain symbols granted */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Chain Symbols Granted</h2>
                  <Dialog open={chainOpen} onOpenChange={setChainOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="bg-white/5 border-white/10"><Settings2 className="h-3.5 w-3.5 mr-1" /> Manage</Button>
                    </DialogTrigger>
                    <DialogContent className="bg-stone-900 border-white/10 text-white max-w-md">
                      <DialogHeader><DialogTitle>Manage Chain Symbols</DialogTitle></DialogHeader>
                      <ChainSymbolsManager symbols={chainSymbols} custom={custom} add={add} remove={remove} />
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chainSymbols.map((s) => (
                    <button key={s} type="button" onClick={() => toggleChain(s)} className={`px-2.5 py-1 rounded-full text-xs border ${card.chain_symbols.includes(s) ? "bg-amber-500 text-black border-amber-400" : "bg-white/5 border-white/10 text-stone-300"}`}>{s}</button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Deck rules */}
            <DeckRulesDialog
              value={{ player_counts: card.player_counts, pack: card.pack }}
              onChange={(v) => set(v)}
              packs={knownPacks}
              className="w-full h-12"
              hideSummary
            />

            {/* Effects */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-5 space-y-3">
                <h2 className="font-semibold text-lg">Effects</h2>
                <EffectEditor effects={card.effects} onChange={(effects) => set({ effects })} chainSymbols={chainSymbols} />
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:sticky lg:top-8 h-fit space-y-4">
            <h2 className="font-semibold text-lg text-stone-300">Preview</h2>
            <div className="flex justify-center overflow-x-auto pb-2">
              <div style={{ filter: `drop-shadow(0 0 20px ${colorHex}40)` }} className="shrink-0">
                <CardView card={card} size="lg" />
              </div>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-stone-300 uppercase">Effects Summary</p>
              {(card.effects || []).length === 0 ? <p className="text-xs text-stone-500 italic">No effects</p> :
                card.effects.map((e, i) => <p key={i} className="text-xs text-stone-300">• {describeEffect(e)}</p>)}
            </div>
            <div className="flex items-stretch gap-3">
              <Button onClick={save} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black text-lg py-6"><Save className="h-5 w-5 mr-2" /> {saving ? "Saving…" : "Save Card"}</Button>
              <label className="flex flex-col items-center justify-center gap-1 cursor-pointer select-none px-3 rounded-lg bg-white/5 border border-white/10">
                <Switch checked={keepTemplate} onCheckedChange={(v) => { setKeepTemplate(v); localStorage.setItem("wonders_keep_template", v ? "1" : "0"); }} />
                <span className="text-[10px] text-stone-400 whitespace-nowrap">Keep template</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}