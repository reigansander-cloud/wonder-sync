import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Swords, Users, Sparkles, ArrowRight, Castle, Landmark } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  const startGame = async () => {
    if (starting) return;
    setStarting(true);
    setStartError("");
    try {
    // All expansions and packs default ON. Custom packs are fetched now so they
    // are included from the start (the armada pack is a manual toggle, no longer
    // auto-tied to the armada expansion).
    let customPacks = [];
    try {
      const all = await base44.entities.Card.list();
      const s = new Set();
      for (const c of all || []) if (c.pack && c.pack !== "purple" && c.pack !== "cities" && c.pack !== "island" && c.pack !== "armada") s.add(c.pack);
      customPacks = [...s];
    } catch (e) { /* ignore */ }
    const gameData = {
      status: "lobby",
      host_id: "local",
      host_name: "Host",
      max_players: 7,
      is_public: false,
      age: "leader",
      phase: "setup",
      pass_direction: "right",
      cities_expansion: true,
      edifice_expansion: true,
      armada_expansion: true,
      packs: ["armada", ...customPacks],
      deck: [],
      discard: [],
      wonders_available: [],
      history: [],
    };
    // Pick a code no unfinished game is using (the server checks and creates
    // in one step, so two hosts can't end up sharing a lobby).
    let code = null;
    for (let attempt = 0; attempt < 8 && !code; attempt++) {
      const len = attempt < 4 ? 3 : 4;
      const candidate = Array.from({ length: len }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
      const res = await base44.entities.Game.createUnique(
        { code: candidate, status: { $ne: "finished" } },
        { ...gameData, code: candidate },
      );
      if (res?.created) code = candidate;
    }
    if (!code) throw new Error("Couldn't find a free lobby code, try again.");
    navigate(`/lobby/${code}`);
    } catch (e) {
      console.error(e);
      setStartError(e?.message || "Couldn't start a game.");
      setStarting(false);
    }
  };

  const joinGame = () => {
    if (joinCode.trim()) navigate(`/lobby/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-stone-900 via-stone-950 to-black text-white">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #d4a64a 0, transparent 40%), radial-gradient(circle at 80% 70%, #7a3d8a 0, transparent 40%)" }} />
      <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm mb-6">
            <Sparkles className="h-4 w-4" /> Real-time multiplayer
          </div>
          <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tight bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
            7 Wonders
          </h1>
          <p className="mt-4 text-stone-300 text-lg max-w-xl mx-auto">Draft cards, build your wonder, and conquer the ancient world — together, in real time.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <Card className="bg-white/5 border-white/10 backdrop-blur hover:bg-white/10 transition cursor-pointer group" onClick={startGame}>
            <CardContent className="p-6 flex flex-col items-center text-center h-full">
              <div className="h-14 w-14 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Swords className="h-7 w-7 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold mb-1">{starting ? "Creating lobby…" : "Start New Game"}</h2>
              <p className="text-stone-400 text-sm flex-1">Create a private lobby and invite friends with a code.</p>
              {startError && <p className="text-red-400 text-xs mt-2">{startError}</p>}
              <ArrowRight className="h-5 w-5 mt-3 text-amber-400 group-hover:translate-x-1 transition" />
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="p-6 flex flex-col items-center text-center h-full">
              <div className="h-14 w-14 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                <Users className="h-7 w-7 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold mb-1">Join Lobby</h2>
              <p className="text-stone-400 text-sm mb-4">Enter an invite code to jump in.</p>
              <div className="flex gap-2 w-full mt-auto">
                <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="CODE" className="uppercase bg-white/5 border-white/10 text-white text-center font-mono" onKeyDown={(e) => e.key === "Enter" && joinGame()} />
                <Button onClick={joinGame} className="bg-amber-500 hover:bg-amber-600 text-black">Go</Button>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          <Link to="/cards" className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm text-stone-200">
            <Sparkles className="h-4 w-4 text-purple-400" /> Custom Cards
          </Link>
          <Link to="/wonders" className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm text-stone-200">
            <Castle className="h-4 w-4 text-amber-400" /> Custom Wonders
          </Link>
          <Link to="/edifices" className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm text-stone-200">
            <Landmark className="h-4 w-4 text-emerald-400" /> Custom Edifices
          </Link>
        </div>

      </div>
    </div>
  );
}