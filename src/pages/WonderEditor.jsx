import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import WonderSideEditor from "@/components/game/WonderSideEditor";

const emptySide = () => ({ start_resource: "", stages: [] });

export default function WonderEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [wonder, setWonder] = useState({ name: "", color: "#d4a64a", day: emptySide(), night: emptySide() });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    base44.entities.Wonder.get(id).then((w) => setWonder({
      name: w.name || "",
      color: w.color || "#d4a64a",
      day: w.day || emptySide(),
      night: w.night || emptySide(),
    })).catch(() => {});
  }, [id]);

  const save = async () => {
    if (!wonder.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: wonder.name.trim(), color: wonder.color, day: wonder.day, night: wonder.night };
      if (id) await base44.entities.Wonder.update(id, payload);
      else await base44.entities.Wonder.create(payload);
      navigate("/wonders");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/wonders" className="inline-flex items-center text-stone-400 hover:text-white text-sm mb-6"><ArrowLeft className="h-4 w-4 mr-1" /> Wonders</Link>
        <h1 className="text-3xl font-display font-bold mb-6">{id ? "Edit Wonder" : "New Wonder"}</h1>

        <Card className="bg-white/5 border-white/10 mb-6">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm w-20">Name</Label>
              <Input value={wonder.name} onChange={(e) => setWonder({ ...wonder, name: e.target.value })} className="bg-white/5 border-white/10 flex-1" placeholder="e.g. Rome" />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm w-20">Color</Label>
              <input type="color" value={wonder.color} onChange={(e) => setWonder({ ...wonder, color: e.target.value })} className="h-9 w-12 rounded bg-transparent border border-white/10" />
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <WonderSideEditor label="Day Side" side={wonder.day} onChange={(s) => setWonder({ ...wonder, day: s })} />
          <WonderSideEditor label="Night Side" side={wonder.night} onChange={(s) => setWonder({ ...wonder, night: s })} />
        </div>

        <div className="mt-6">
          <Button onClick={save} disabled={saving || !wonder.name.trim()} className="bg-amber-500 hover:bg-amber-600 text-black"><Save className="h-4 w-4 mr-1" /> {id ? "Save" : "Create"} Wonder</Button>
        </div>
      </div>
    </div>
  );
}