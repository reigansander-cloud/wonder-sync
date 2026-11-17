import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Tag } from "lucide-react";
import { useChainSymbols } from "@/lib/game/useChainSymbols";

export default function ChainSymbols() {
  const { symbols, custom, add, remove } = useChainSymbols();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    const clean = name.trim();
    if (!clean) return;
    if (symbols.includes(clean)) { setErr("That chain symbol already exists."); return; }
    setErr("");
    await add(clean);
    setName("");
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link to="/" className="inline-flex items-center text-stone-400 hover:text-white text-sm mb-6"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link>
        <h1 className="text-4xl font-display font-bold mb-2">Chain Symbols</h1>
        <p className="text-stone-400 mb-8">Chain symbols let cards build for free if you already own one granting that symbol. "Mask" is included by default — add your own below.</p>

        <Card className="bg-white/5 border-white/10 mb-8">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">Add New Chain Symbol</h2>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sphinx" className="bg-white/5 border-white/10" onKeyDown={(e) => e.key === "Enter" && submit()} />
              <Button onClick={submit} className="bg-amber-500 hover:bg-amber-600 text-black"><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
          </CardContent>
        </Card>

        <div className="space-y-2">
          {symbols.map((s) => {
            const rec = custom.find((c) => c.name === s);
            return (
              <div key={s} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <Tag className="h-4 w-4 text-amber-400" />
                <span className="flex-1 font-medium">{s}</span>
                {rec ? (
                  <button onClick={() => remove(rec.id)} className="text-stone-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                ) : (
                  <span className="text-xs text-stone-500">default</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}