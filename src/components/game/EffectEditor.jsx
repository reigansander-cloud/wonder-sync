import React from "react";
import { EFFECT_TYPES, PER_METRICS, EFFECT_TARGETS, RESOURCE_ORDER, SCIENCE_SYMBOLS, TRIGGER_OPTIONS, SET_ITEM_OPTIONS, VP_COMPARE_METRICS, VP_NONE_METRICS } from "@/lib/game/constants";
import { ResourceIcon } from "./Icons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export default function EffectEditor({ effects = [], onChange, chainSymbols = ["Mask"] }) {
  const update = (i, patch) => {
    const next = effects.map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    onChange(next);
  };
  const add = () => onChange([...effects, { kind: "vp", amount: 1, target: "self" }]);
  const remove = (i) => onChange(effects.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {effects.map((eff, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Select value={eff.kind} onValueChange={(v) => update(i, v === "science" && !eff.symbol ? { kind: v, symbol: "script" } : { kind: v })}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EFFECT_TYPES.map((t) => <SelectItem key={t.key} value={t.key} title={effectBlurb(t.key)} className="whitespace-normal">{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>

          {["coins", "vp", "shields"].includes(eff.kind) && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Amount</Label>
              <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            </div>
          )}

          {["coins", "vp"].includes(eff.kind) && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Per (optional)</Label>
              <Select value={eff.perMetric || "none"} onValueChange={(v) => update(i, { perMetric: v === "none" ? null : v })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Flat amount —</SelectItem>
                  {PER_METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(eff.kind === "coins" || (eff.kind === "vp" && eff.perMetric)) && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Target</Label>
              <Select value={eff.target || "self"} onValueChange={(v) => update(i, { target: v })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EFFECT_TARGETS.map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "science" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Symbol</Label>
              <Select value={eff.symbol || "script"} onValueChange={(v) => update(i, { symbol: v })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCIENCE_SYMBOLS.map((s) => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "science_choice" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Mode</Label>
              <Select value={eff.most ? "most" : eff.spy ? "spy" : "any"} onValueChange={(v) => update(i, { most: v === "most", spy: v === "spy" })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any (optimal)</SelectItem>
                  <SelectItem value="most">Most (your majority type)</SelectItem>
                  <SelectItem value="spy">Spy (copy a neighbor's)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "resource" && (
            <ResourcePicker label="Resource" value={eff.resources?.[0]} onChange={(r) => update(i, { resources: [r] })} />
          )}

          {eff.kind === "resource_choice" && (
            <MultiResourcePicker value={eff.resources || []} onChange={(arr) => update(i, { resources: arr })} />
          )}

          {(eff.kind === "resource" || eff.kind === "resource_choice") && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={!!eff.personal} onChange={(e) => update(i, { personal: e.target.checked })} />
              Personal — not tradeable by opponents, hidden from neighbors
            </label>
          )}

          {eff.kind === "free_build_color" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Color</Label>
              <Select value={eff.color || "blue"} onValueChange={(v) => update(i, { color: v })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["brown","gray","green","blue","yellow","red","purple","leader","black"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "trade_discount" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Side</Label>
                <Select value={eff.side || "both"} onValueChange={(v) => update(i, { side: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both neighbors</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <MultiResourcePicker
                label="Discounted resources"
                value={eff.resources || []}
                onChange={(arr) => update(i, { resources: arr })}
              />
              <p className="text-[11px] text-muted-foreground">Leave empty to discount all resources.</p>
            </div>
          )}

          {eff.kind === "chain" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Chain</Label>
              <Select value={eff.chainSymbol || chainSymbols[0]} onValueChange={(v) => update(i, { chainSymbol: v })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {chainSymbols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "cull" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Culls</Label>
                <Input type="number" value={eff.culls ?? 0} onChange={(e) => update(i, { culls: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
                <span className="text-[11px] text-muted-foreground">−1 = current age</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Per (optional)</Label>
                <Select value={eff.perMetric || "none"} onValueChange={(v) => update(i, { perMetric: v === "none" ? null : v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Flat amount —</SelectItem>
                    {PER_METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {eff.kind === "chain_bonus" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Coins</Label>
              <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            </div>
          )}

          {eff.kind === "trigger" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Trigger</Label>
                <Select value={eff.triggerType || "color"} onValueChange={(v) => update(i, { triggerType: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {eff.triggerType === "color" && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Color</Label>
                  <Select value={eff.triggerColor || "blue"} onValueChange={(v) => update(i, { triggerColor: v })}>
                    <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["brown","gray","green","blue","yellow","red","purple","leader","black"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Coins gained</Label>
                <Input type="number" value={eff.coins || 0} onChange={(e) => update(i, { coins: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Culls</Label>
                <Input type="number" value={eff.culls || 0} onChange={(e) => update(i, { culls: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
              </div>
            </div>
          )}

          {eff.kind === "set_vp" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">VP per set</Label>
                <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
              </div>
              <Label className="text-xs">Set items (a set = 1 of each)</Label>
              <div className="flex flex-wrap gap-1">
                {SET_ITEM_OPTIONS.map((opt) => {
                  const selected = (eff.set || []).includes(opt.key);
                  return (
                    <button type="button" key={opt.key} onClick={() => update(i, { set: selected ? (eff.set || []).filter((x) => x !== opt.key) : [...(eff.set || []), opt.key] })}
                      className={`px-2 py-1 rounded border text-xs ${selected ? "border-amber-400 bg-amber-400/20" : "border-border"}`}>
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {eff.kind === "cost_reduction" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Applies to</Label>
                <Select value={eff.appliesTo || "card"} onValueChange={(v) => update(i, { appliesTo: v, color: v === "card" ? (eff.color || "brown") : (v === "ship" ? "any" : undefined) })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card (by color)</SelectItem>
                    <SelectItem value="wonder">Wonder tier</SelectItem>
                    <SelectItem value="ship">Ship move (Armada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(eff.appliesTo || "card") === "card" && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Color</Label>
                  <Select value={eff.color || "brown"} onValueChange={(v) => update(i, { color: v })}>
                    <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["brown","gray","green","blue","yellow","red","purple","leader","black"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {eff.appliesTo === "ship" && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Track</Label>
                  <Select value={eff.color || "any"} onValueChange={(v) => update(i, { color: v })}>
                    <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any track</SelectItem>
                      {["red","yellow","blue","green"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={!!eff.free} onChange={(e) => update(i, { free: e.target.checked })} />
                Free — make all costs of the selected target free (no resources, no coins) instead of −1 resource
              </label>
              <p className="text-[11px] text-muted-foreground">{eff.free ? "The selected target costs nothing to build/move." : "Reduces 1 resource per effect on the selected target only (coin costs unaffected)."}</p>
            </div>
          )}

          {eff.kind === "coin_gain_bonus" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Bonus</Label>
              <Input type="number" value={eff.amount || 1} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            </div>
          )}

          {eff.kind === "loss_redirect" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — applies to all military losses.</p>
          )}

          {eff.kind === "vp_if_ge" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">VP amount</Label>
                <Input type="number" value={eff.amount || 5} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Metric</Label>
                <Select value={eff.metric || "coins"} onValueChange={(v) => update(i, { metric: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VP_COMPARE_METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {eff.kind === "vp_if_none" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">VP amount</Label>
                <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">None of</Label>
                <Select value={eff.metric || "losses"} onValueChange={(v) => update(i, { metric: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VP_NONE_METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {eff.kind === "vp_if_one" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">VP amount</Label>
                <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Exactly one of</Label>
                <Select value={eff.metric || "losses"} onValueChange={(v) => update(i, { metric: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VP_NONE_METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {eff.kind === "vp_if_wonder_complete" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">VP amount</Label>
              <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            </div>
          )}

          {eff.kind === "trophy_pairs_vp" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — VP per pair of identical trophies (by age).</p>
          )}

          {eff.kind === "supply_trade" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — once per card, cover 1 resource from the supply for 1 coin.</p>
          )}

          {eff.kind === "trade_bonus" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — gain 1 coin per neighbor traded with, once per turn.</p>
          )}

          {eff.kind === "trophy_on_enter" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Trophy age</Label>
              <Select value={eff.age || "current"} onValueChange={(v) => update(i, { age: v })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current age</SelectItem>
                  <SelectItem value="1">Age I</SelectItem>
                  <SelectItem value="2">Age II</SelectItem>
                  <SelectItem value="3">Age III</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "neighbors_penalty" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — both neighbors gain a penalty token.</p>
          )}

          {eff.kind === "neighbors_coins" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Coins</Label>
                <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Target</Label>
                <Select value={eff.target || "neighbors"} onValueChange={(v) => update(i, { target: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neighbors">Both neighbors</SelectItem>
                    <SelectItem value="all">All opponents</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {eff.kind === "diplomacy" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — skip military this age (the card's age); neighbors resolve among themselves.</p>
          )}

          {eff.kind === "boarding" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — also resolve military vs players 2 seats away. Ignores diplomacy; no effect in 3-player games.</p>
          )}

          {eff.kind === "overwhelm" && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={!!eff.naval} onChange={(e) => update(i, { naval: e.target.checked })} />
                Naval combat — compare naval shields after naval resolution
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Margin (X)</Label>
                <Input type="number" value={eff.margin ?? eff.amount ?? 0} onChange={(e) => update(i, { margin: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
                <span className="text-[11px] text-muted-foreground">shields more</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={!!eff.per} onChange={(e) => update(i, { per: e.target.checked })} />
                PER — gain the reward for each shield of difference (not a flat amount)
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Reward</Label>
                <Select value={eff.reward || "coins"} onValueChange={(v) => update(i, { reward: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coins">X coins to winner</SelectItem>
                    <SelectItem value="trophy">{eff.naval ? "Naval victory token" : "Current age trophy"} to winner</SelectItem>
                    <SelectItem value="penalties">X penalty tokens to loser</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(eff.reward || "coins") !== "trophy" && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Reward X</Label>
                  <Input type="number" value={eff.rewardValue ?? eff.amount ?? 0} onChange={(e) => update(i, { rewardValue: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Drawback</Label>
                <Select value={eff.drawback || "none"} onValueChange={(v) => update(i, { drawback: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="discard_card">Loser discards a card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {eff.drawback === "discard_card" && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Card color</Label>
                  <Select value={eff.drawbackColor || "brown"} onValueChange={(v) => update(i, { drawbackColor: v })}>
                    <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["brown","gray","green","blue","yellow","red","purple","leader","black"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {eff.kind === "foreign_trade" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — once per turn, 1 missing resource can be bought from a player 2 seats away for 1 coin (auto-applied).</p>
          )}

          {eff.kind === "scam" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Side</Label>
                <Select value={eff.side || "both"} onValueChange={(v) => update(i, { side: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both neighbors</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={!!eff.startingOnly} onChange={(e) => update(i, { startingOnly: e.target.checked })} />
                Starting only — discount only the neighbor's starting resource
              </label>
            </div>
          )}

          {eff.kind === "warehouse" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — produces 1 of any resource you already produce (dynamic; updates as your production changes).</p>
          )}

          {eff.kind === "black_market" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — produces 1 of any resource you don't already produce (dynamic; updates as your production changes).</p>
          )}

          {eff.kind === "free_cards_per_age" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Applies to</Label>
              <Select value={eff.scope || "black"} onValueChange={(v) => update(i, { scope: v })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="black">Black cards</SelectItem>
                  <SelectItem value="first">First card each age</SelectItem>
                  <SelectItem value="last">Last card each age</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "play_both" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — after the age's final draft, you get an extra round to play your last (normally discarded) card.</p>
          )}

          {eff.kind === "bury" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — when played, remove an in-play leader from the game and gain VP equal to twice its coin cost (A-cost leaders give 6 VP).</p>
          )}

          {eff.kind === "naval_shields" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Naval shields</Label>
              <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            </div>
          )}
          {eff.kind === "naval_victory" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Age</Label>
              <Select value={String(eff.age ?? "0")} onValueChange={(v) => update(i, { age: v })}>
                <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Age 0 (1 VP)</SelectItem>
                  <SelectItem value="1">Age 1 (3 VP)</SelectItem>
                  <SelectItem value="2">Age 2 (5 VP)</SelectItem>
                  <SelectItem value="3">Age 3 (7 VP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {eff.kind === "move_ship" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Color</Label>
                <Select value={eff.color || "any"} onValueChange={(v) => update(i, { color: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any (you choose)</SelectItem>
                    {["red", "yellow", "blue", "green"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(!eff.color || eff.color === "any") && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Ships to move</Label>
                  <Input type="number" min={1} max={4} value={eff.amount || 1} onChange={(e) => update(i, { amount: Math.min(4, Math.max(1, parseInt(e.target.value) || 1)) })} className="w-20 h-8" />
                  <span className="text-[11px] text-muted-foreground">different colors (max 4)</span>
                </div>
              )}
            </div>
          )}
          {eff.kind === "ship_move_coin" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — gain 1 coin each time one of your ships moves.</p>
          )}
          {eff.kind === "pirates" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — when played, every other player is culled equal to their current trade level.</p>
          )}

          {eff.kind === "cleanse" && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={!!eff.giveCoins} onChange={(e) => update(i, { giveCoins: e.target.checked })} />
                Gain coins per loss removed
              </label>
              {eff.giveCoins && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Coins per loss</Label>
                  <Input type="number" value={eff.coinsPerLoss || 0} onChange={(e) => update(i, { coinsPerLoss: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">When played: remove all your military loss tokens (not naval).{eff.giveCoins ? ` Gain ${eff.coinsPerLoss || 0} coins per loss removed.` : ""}</p>
            </div>
          )}

          {eff.kind === "gain_island" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Island age</Label>
              <Select value={String(eff.age || "1")} onValueChange={(v) => update(i, { age: v })}>
                <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Age 1</SelectItem>
                  <SelectItem value="2">Age 2</SelectItem>
                  <SelectItem value="3">Age 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "naval_diplomacy" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — skip the naval conflict of this age (the card's age); land military still resolves.</p>
          )}

          {eff.kind === "coin_loss_immunity" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — opponents' effects cannot make you lose coins. Your own self-costs still apply.</p>
          )}

          {eff.kind === "free_ship_on_build" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — after building a wonder stage (and moving the badge track), move any one ship for free.</p>
          )}

          {eff.kind === "vp_per_island" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">VP per chosen island</Label>
              <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            </div>
          )}

          {eff.kind === "unearth" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — when played, you also play any card from the discard pile for free.</p>
          )}

          {eff.kind === "mirror" && (
            <p className="text-[11px] text-muted-foreground">No configuration needed — when played, choose a card in your city to copy its effects.</p>
          )}

          {eff.kind === "edifice_patronage_choice" && (
            <p className="text-[11px] text-muted-foreground">Wonder stage (Ur day side). Player chooses any of the 3 edifices to gain a duplicate patronage token for.</p>
          )}

          {eff.kind === "edifice_patronage_age" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Edifice age</Label>
              <Select value={String(eff.age || "1")} onValueChange={(v) => update(i, { age: v })}>
                <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Age 1</SelectItem>
                  <SelectItem value="2">Age 2</SelectItem>
                  <SelectItem value="3">Age 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {eff.kind === "self_discard" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Discard a</Label>
                <Select value={eff.mode || "card"} onValueChange={(v) => update(i, { mode: v })}>
                  <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Played card (by color)</SelectItem>
                    <SelectItem value="trophy">Trophy (by age)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {eff.mode === "trophy" ? (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Trophy age (optional)</Label>
                  <Select value={eff.trophyAge || "any"} onValueChange={(v) => update(i, { trophyAge: v === "any" ? "" : v })}>
                    <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any age</SelectItem>
                      <SelectItem value="1">Age I</SelectItem>
                      <SelectItem value="2">Age II</SelectItem>
                      <SelectItem value="3">Age III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Card color</Label>
                  <Select value={eff.color || "brown"} onValueChange={(v) => update(i, { color: v })}>
                    <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["brown","gray","green","blue","yellow","red","purple","leader","black"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">If you can't discard, take a penalty token (2/3/5 by current age).</p>
            </div>
          )}

          {eff.kind === "lose_coins" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Coins lost</Label>
              <Input type="number" value={eff.amount || 0} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            </div>
          )}

          {eff.kind === "armada_cost_reduction" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Discounts</Label>
              <Input type="number" value={eff.amount || 1} onChange={(e) => update(i, { amount: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
              <span className="text-[11px] text-muted-foreground">resource(s) off one Armada ship move</span>
            </div>
          )}

          {eff.kind === "free_first_per_color" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Color</Label>
              <Select value={eff.color || "brown"} onValueChange={(v) => update(i, { color: v })}>
                <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["brown","gray","green","blue","yellow","red","purple","leader","black"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground italic">{describeEffect(eff)}</p>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" /> Add Effect</Button>
    </div>
  );
}

function ResourcePicker({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        {RESOURCE_ORDER.map((r) => (
          <button type="button" key={r} onClick={() => onChange(r)} className={`p-1 rounded border-2 ${value === r ? "border-amber-400 bg-amber-100" : "border-transparent"}`}>
            <ResourceIcon resource={r} size={22} />
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiResourcePicker({ value, onChange, label = "Choose from" }) {
  const toggle = (r) => {
    if (value.includes(r)) onChange(value.filter((x) => x !== r));
    else onChange([...value, r]);
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1 flex-wrap">
        {RESOURCE_ORDER.map((r) => (
          <button type="button" key={r} onClick={() => toggle(r)} className={`p-1 rounded border-2 ${value.includes(r) ? "border-amber-400 bg-amber-100" : "border-transparent"}`}>
            <ResourceIcon resource={r} size={22} />
          </button>
        ))}
      </div>
    </div>
  );
}

// Short blurbs shown when hovering an effect type in the dropdown.
export function effectBlurb(kind) {
  return describeEffect({ kind });
}

export function describeEffect(eff) {
  if (!eff || typeof eff !== "object" || !eff.kind) return "[invalid effect]";
  const metricName = (m) => PER_METRICS.find((x) => x.key === m)?.name || m;
  const targetName = (t) => EFFECT_TARGETS.find((x) => x.key === t)?.name || "self";
  switch (eff.kind) {
    case "coins": {
      const t = eff.target || "self";
      const tName = t === "all" ? "every opponent" : (EFFECT_TARGETS.find((x) => x.key === t)?.name || "self").toLowerCase();
      return eff.perMetric
        ? `Gain ${eff.amount} coins per ${metricName(eff.perMetric)} (${t === "all" ? "every opponent" : tName}).`
        : (t === "self" ? `Gain ${eff.amount} coins.` : `Grant ${eff.amount} coins to ${tName}.`);
    }
    case "vp": return eff.perMetric ? `Gain ${eff.amount} VP per ${metricName(eff.perMetric)} (${targetName(eff.target)}).` : `Gain ${eff.amount} VP.`;
    case "shields": return `Gain ${eff.amount} military shields.`;
    case "science": return `Gain a ${eff.symbol} science symbol.`;
    case "science_choice": return eff.most ? `Gain a science symbol of the type you have the most of.` : eff.spy ? `Gain a copy of a science symbol a neighbor has (optimal).` : `Gain any science symbol (auto-assigned optimally).`;
    case "resource": return `Produce 1 ${eff.resources?.[0]} each turn${eff.personal ? " (personal — not tradeable, hidden from neighbors)." : "."}`;
    case "resource_choice": return `Produce 1 of: ${(eff.resources || []).join(", ")} each turn${eff.personal ? " (personal — not tradeable, hidden from neighbors)." : "."}`;
    case "free_build_color": return `Free construction of a ${eff.color} card once per age.`;
    case "trade_discount": {
      const res = eff.resources && eff.resources.length ? eff.resources.join(", ") : "all resources";
      return `Trade ${eff.side || "both"} neighbor ${res} for 1 coin.`;
    }
    case "chain": return `Grants the ${eff.chainSymbol} chain symbol.`;
    case "cull": return eff.perMetric ? `When played: every other player loses ${eff.culls === -1 ? "the current age's" : (eff.culls || 0)} coins per ${metricName(eff.perMetric)} you have (penalties for shortfalls).` : `When played: every other player loses ${eff.culls === -1 ? "coins equal to the current age" : (eff.culls || 0) + " coins"} (penalties for any shortfall).`;
    case "chain_bonus": return `Gain ${eff.amount || 0} coins whenever you play a card for free via chain.`;
    case "trigger": {
      const trig = TRIGGER_OPTIONS.find((t) => t.key === eff.triggerType)?.name || eff.triggerType;
      const colorPart = eff.triggerType === "color" ? ` (${eff.triggerColor})` : "";
      return `Whenever you ${trig}${colorPart}: gain ${eff.coins || 0} coins and every other player loses ${eff.culls || 0} coins.`;
    }
    case "set_vp": return `Gain ${eff.amount || 0} VP per complete set of ${(eff.set || []).length} items.`;
    case "cost_reduction": {
      const t = eff.appliesTo || "card";
      const freeTxt = eff.free ? "free (no resources, no coins)" : "1 fewer resource";
      if (t === "wonder") return `Wonder tiers cost ${freeTxt}${eff.free ? "" : " (no coin discount)."}.`;
      if (t === "ship") return eff.color && eff.color !== "any" ? `${eff.color} ship moves cost ${freeTxt}.` : `All ship moves cost ${freeTxt}.`;
      return `${eff.color || "—"} cards cost ${freeTxt}${eff.free ? "" : " (no coin discount)."}.`;
    }
    case "coin_gain_bonus": return `Gain +${eff.amount || 1} coin on every coin gain (except trade/self).`;
    case "loss_redirect": return `When a neighbor's military win would give you a loss, they take the loss instead.`;
    case "vp_if_ge": return `Gain ${eff.amount || 5} VP if your ${eff.metric || "metric"} is ≥ both neighbors.`;
    case "vp_if_none": return `Gain ${eff.amount || 0} VP if you have no ${eff.metric || "metric"}.`;
    case "trophy_pairs_vp": return `Gain VP per pair of identical trophies (each pair worth that trophy's value).`;
    case "supply_trade": return `Once per card, cover 1 resource from the supply for 1 coin.`;
    case "trade_bonus": return `Gain 1 coin per neighbor you trade with, once per turn.`;
    case "trophy_on_enter": return `When played: gain a ${eff.age === "current" ? "current-age" : (eff.age || "current")} trophy.`;
    case "neighbors_penalty": return `When played: both neighbors gain a penalty token.`;
    case "neighbors_coins": return `When played: ${eff.target === "all" ? "all opponents" : "both neighbors"} gain ${eff.amount || 0} coins.`;
    case "diplomacy": return `Diplomacy: skip military resolution this age; neighbors resolve among themselves.`;
    case "boarding": return `Also resolve military vs ONE player 2 seats away of your choice (ignores diplomacy, no effect in 3p).`;
    case "overwhelm": {
      const margin = eff.margin ?? eff.amount ?? 0;
      const rewardValue = eff.rewardValue ?? eff.amount ?? 0;
      const reward = eff.reward || "coins";
      const perTxt = eff.per ? " per shield of difference" : "";
      const drawbackTxt = eff.drawback === "discard_card" ? ` Loser discards a ${eff.drawbackColor || "—"} card (penalty if they can't).` : "";
      if (eff.naval) {
        const rTxt = reward === "coins" ? `${rewardValue}${perTxt} coins` : reward === "trophy" ? `a naval victory token${perTxt}` : `${rewardValue}${perTxt} penalty tokens`;
        return `After naval resolution: for each enemy with ≥${margin} fewer naval shields, gain ${rTxt}.${drawbackTxt}`;
      }
      if (reward === "coins") return `Win a military conflict by ≥${margin} shields: gain ${rewardValue}${perTxt} coins.${drawbackTxt}`;
      if (reward === "trophy") return `Win a military conflict by ≥${margin} shields: gain ${perTxt ? "a trophy per shield of difference" : "a current-age trophy"}.${drawbackTxt}`;
      return `Win a military conflict by ≥${margin} shields: the loser takes ${rewardValue}${perTxt} penalty tokens.${drawbackTxt}`;
    }
    case "foreign_trade": return `Once per turn, buy 1 resource from a player 2 seats away for 1 coin (auto when a neighbor can't supply it).`;
    case "edifice_patronage_choice": return `Gain a duplicate patronage token for any edifice (from out of play).`;
    case "edifice_patronage_age": return `Gain a duplicate patronage token for the Age ${eff.age || "?"} edifice (from out of play).`;
    case "scam": return `First resource traded from the ${eff.side || "both"} neighbor each turn costs 1 less${eff.startingOnly ? " (neighbor's starting resource only)" : ""}; can stack with trade discounts for a free trade.`;
    case "warehouse": return `Produce 1 of any resource you already produce (dynamic choice resource).`;
    case "black_market": return `Produce 1 of any resource you don't already produce (dynamic choice resource).`;
    case "free_cards_per_age": return `Once per age, play a ${eff.scope === "first" ? "first" : eff.scope === "last" ? "last" : "black"} card for free when you can't afford it (or instead of trading).`;
    case "play_both": return `After the age's final draft, get an extra round to play your last (normally discarded) card.`;
    case "bury": return `Remove an in-play leader from the game and gain VP equal to twice its coin cost (A-cost leaders give 6 VP).`;
    case "naval_shields": return `Gain ${eff.amount || 0} naval shields.`;
    case "naval_victory": return `Gain a naval victory token (Age ${eff.age ?? 0}, ${({ 0: 1, 1: 3, 2: 5, 3: 7 })[eff.age ?? 0] || 1} VP).`;
    case "move_ship": {
      if (eff.color && eff.color !== "any") return `Move your ${eff.color} ship up one level for free.`;
      const n = eff.amount || 1;
      return `Move up to ${n} ship${n > 1 ? "s of different colors" : ""} up one level each for free (you choose).`;
    }
    case "ship_move_coin": return `Gain 1 coin each time one of your ships moves.`;
    case "pirates": return `When played: every other player is culled equal to their current trade level.`;
    case "vp_if_one": return `Gain ${eff.amount || 0} VP if you have exactly one ${eff.metric || "metric"}.`;
    case "vp_if_wonder_complete": return `Gain ${eff.amount || 0} VP if you have built all tiers of your wonder.`;
    case "rome_draw_leaders": return `Draw ${eff.amount || 4} leaders from out of play into your hand.`;
    case "rome_play_leader": return `Play a leader from your hand for free (no coin cost).`;
    case "self_discard": return eff.mode === "trophy"
      ? `Discard one of your trophies${eff.trophyAge ? ` (Age ${eff.trophyAge})` : ""} when this is resolved; penalty if you can't.`
      : `Discard one of your ${eff.color || "—"} cards when this is resolved; penalty if you can't.`;
    case "lose_coins": return `Lose ${eff.amount || 0} coins (penalty tokens for any shortfall).`;
    case "armada_cost_reduction": return `Reduce ${eff.amount || 1} resource from the cost of one Armada ship move.`;
    case "free_first_per_color": return `Once per age, play your first ${eff.color || "—"} card for free (no cost, no trade).`;
    case "cleanse": return `When played: remove all your military loss tokens (not naval).${eff.giveCoins ? ` Gain ${eff.coinsPerLoss || 0} coins per loss removed.` : ""}`;
    case "gain_island": return `When played: draw & play an Age ${eff.age || "?"} island card (like the green Armada track reward).`;
    case "naval_diplomacy": return `Naval diplomacy: skip the naval conflict this age (the card's age).`;
    case "coin_loss_immunity": return `Opponents cannot make you lose coins (your own self-costs still apply).`;
    case "free_ship_on_build": return `After building a wonder stage (and moving the badge track), move any one ship for free.`;
    case "vp_per_island": return `Gain ${eff.amount || 0} VP per chosen island card (you pick which of your islands count).`;
    case "unearth": return `When played: also play any card from the discard pile for free (no cost, no trade).`;
    case "mirror": return `When played: choose a card in your city; this card copies that card's effects.`;
    case "double_purple": return `Your highest-scoring purple (guild) card scores twice.`;
    default: return "";
  }
}