import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Pencil, X } from "lucide-react";
import EffectEditor, { describeEffect } from "@/components/game/EffectEditor";

const AGE_LABEL = { "1": "Age I", "2": "Age II", "3": "Age III" };
const emptyForm = { name: "", age: "1", cost: 4, icon_url: "", reward_effects: [], penalty_effects: [] };

export default function Edifices() {
  const [edifices, setEdifices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    base44.entities.Edifice.list("-created_date", 200).then(setEdifices).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startNew = () => { setForm(emptyForm); setEditing("new"); };
  const startEdit = (e) => {
    setForm({ name: e.name, age: String(e.age), cost: e.cost, icon_url: e.icon_url || "", reward_effects: e.reward_effects || [], penalty_effects: e.penalty_effects || [] });
    setEditing(e.id);
  };
  const cancel = () => setEditing(null);

  const onIconUpload = async (file) => {
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, icon_url: file_url }));
    } catch (e) { /* ignore */ }
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      age: String(form.age),
      cost: Number(form.cost) || 0,
      icon_url: form.icon_url || "",
      reward_effects: form.reward_effects || [],
      penalty_effects: form.penalty_effects || [],
    };
    if (editing === "new") await base44.entities.Edifice.create(payload);
    else await base44.entities.Edifice.update(editing, payload);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this edifice?")) return;
    await base44.entities.Edifice.delete(id);
    load();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/" className="inline-flex items-center text-stone-400 hover:text-white text-sm mb-6"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-display font-bold">Custom Edifices</h1>
            <p className="text-stone-400">These custom edifices form the per-age pool used when the Edifice expansion is on.</p>
          </div>
          <Button onClick={startNew} className="bg-emerald-500 hover:bg-emerald-600 text-black"><Plus className="h-4 w-4 mr-1" /> New Edifice</Button>
        </div>

        {editing !== null && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editing === "new" ? "New Edifice" : "Edit Edifice"}</h3>
              <button onClick={cancel} className="text-stone-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-400 block mb-1">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-xs text-stone-400 block mb-1">Age</label>
                <Select value={form.age} onValueChange={(v) => setForm({ ...form, age: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Age I</SelectItem>
                    <SelectItem value="2">Age II</SelectItem>
                    <SelectItem value="3">Age III</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-stone-400 block mb-1">Donate Cost (coins)</label>
                <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Custom Icon (optional — shown in the edifice tab instead of abilities)</label>
              <div className="flex items-center gap-2">
                {form.icon_url && <img src={form.icon_url} alt="icon" className="h-12 w-12 rounded object-contain bg-white/5 border border-white/10" />}
                <input type="file" accept="image/*" onChange={(e) => onIconUpload(e.target.files?.[0])} className="text-xs text-stone-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-white/10 file:text-stone-200" />
                {form.icon_url && <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, icon_url: "" })}>Remove</Button>}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-400 block">Reward Effects (per patronage token)</label>
              <EffectEditor effects={form.reward_effects} onChange={(effs) => setForm({ ...form, reward_effects: effs })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-400 block">Penalty Effects (non-patrons, applied once)</label>
              <EffectEditor effects={form.penalty_effects} onChange={(effs) => setForm({ ...form, penalty_effects: effs })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel}>Cancel</Button>
              <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-black">{editing === "new" ? "Create" : "Save"}</Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : edifices.length === 0 && editing === null ? (
          <div className="text-center py-20">
            <p className="text-stone-400 mb-4">No custom edifices yet. The Edifice expansion pulls only from custom edifices you create here — add one to enable it.</p>
            <Button onClick={startNew} className="bg-emerald-500 hover:bg-emerald-600 text-black"><Plus className="h-4 w-4 mr-1" /> Create Edifice</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {edifices.map((e) => (
              <div key={e.id} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 group">
                <div className="flex items-center gap-2">
                  {e.icon_url && <img src={e.icon_url} alt="" className="h-6 w-6 rounded object-contain" />}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{AGE_LABEL[String(e.age)]}</span>
                  <span className="font-semibold flex-1">{e.name}</span>
                  <button onClick={() => startEdit(e)} className="opacity-0 group-hover:opacity-100 text-stone-500 hover:text-amber-300"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(e.id)} className="opacity-0 group-hover:opacity-100 text-stone-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="text-xs text-stone-400 space-y-0.5">
                  <div>Donate: <span className="text-amber-300">{e.cost}🪙</span></div>
                  {(e.reward_effects || []).length ? (
                    <div className="text-emerald-300">Reward: {(e.reward_effects || []).map(describeEffect).join("; ")}</div>
                  ) : (
                    <div>Reward: <span className="text-emerald-300">+{e.rewards_vp} VP{e.rewards_coins ? `, +${e.rewards_coins}🪙` : ""}</span> per token</div>
                  )}
                  {(e.penalty_effects || []).length ? (
                    <div className="text-red-300">Penalty: {(e.penalty_effects || []).map(describeEffect).join("; ")}</div>
                  ) : (
                    <div>Penalty: <span className="text-red-300">{e.penalties_vp} VP</span> if no token</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}