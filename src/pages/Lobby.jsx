import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, Crown, Shuffle } from "lucide-react";
import { WONDERS, PLAYER_COLORS, setWonderRegistry } from "@/lib/game/constants";
import { Bot } from "lucide-react";
import WonderPreview from "@/components/game/WonderPreview";

const STORAGE_KEY = "wonders_player_identity";

const GREEK_NAMES = ["Achilles","Agamemnon","Alexander","Andromeda","Antigone","Apollo","Ares","Artemis","Athena","Atalanta","Bellerophon","Calypso","Cassandra","Chiron","Demeter","Dionysus","Electra","Eros","Europa","Hades","Hector","Helen","Helios","Hera","Heracles","Hermes","Icarus","Jason","Leander","Medea","Medusa","Midas","Minos","Narcissus","Odysseus","Oedipus","Orion","Orpheus","Pandora","Paris","Patroclus","Penelope","Persephone","Perseus","Phaedra","Phoenix","Pylades","Pyrrha","Sappho","Selene","Theseus","Zeno","Zeus"];
const randomGreekName = () => GREEK_NAMES[Math.floor(Math.random() * GREEK_NAMES.length)];

// Creates a PlayerState in the lowest free seat. The server only creates it if
// that seat is still free, so two people joining at the same moment can't end
// up in the same seat (or both become host).
async function claimSeat(gameId, maxPlayers, makeData) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const cur = await base44.entities.PlayerState.filter({ game_id: gameId });
    if (cur.length >= maxPlayers) return { full: true, players: cur };
    const taken = new Set(cur.map((p) => p.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    const res = await base44.entities.PlayerState.createUnique({ game_id: gameId, seat }, makeData(seat, cur));
    if (res?.created) return { me: res.record, players: [...cur, res.record] };
  }
  throw new Error("Couldn't get a seat, try again.");
}

export default function Lobby() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [myId, setMyId] = useState(null);
  const [joined, setJoined] = useState(false);
  const [selectedWonder, setSelectedWonder] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [customWonders, setCustomWonders] = useState([]);
  const [customPacks, setCustomPacks] = useState([]);
  const myIdRef = useRef(null);
  const actionRef = useRef(false); // stops double clicks from joining/starting twice
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  // Coming back to (or refreshing) a lobby you already joined: you're still in.
  useEffect(() => {
    if (!joined && myId && players.some((p) => p.id === myId)) setJoined(true);
  }, [players, myId, joined]);

  useEffect(() => {
    let unsubG, unsubP;
    (async () => {
      const list = await base44.entities.Game.filter({ code }, "-created_date", 1);
      if (!list.length) { setError("Lobby not found."); return; }
      const g = list[0];
      setGame(g);
      base44.entities.Wonder.list("-created_date", 500).then((ws) => {
        setCustomWonders(ws || []);
        const map = {};
        for (const w of ws || []) map[w.builtin_id || `c:${w.id}`] = w;
        setWonderRegistry(map);
      }).catch(() => {});
      base44.entities.Card.list().then((all) => {
        const s = new Set();
        const seen = new Set();
        for (const c of all || []) {
          if (!c.pack || c.pack === "purple" || c.pack === "cities" || c.pack === "island") continue;
          const key = String(c.pack).toLowerCase();
          if (!seen.has(key)) { seen.add(key); s.add(c.pack); }
        }
        setCustomPacks([...s]);
      }).catch(() => {});

      const identity = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (identity[code]) {
        setName(identity[code].name || "");
        setMyId(identity[code].id);
        myIdRef.current = identity[code].id;
      }

      unsubG = base44.entities.Game.subscribe(async (ev) => {
        if (ev.type === "resync" || ev.data?.id === g.id) { try { setGame(await base44.entities.Game.get(g.id)); } catch (e) { /* ignore */ } }
      });
      unsubP = base44.entities.PlayerState.subscribe((ev) => {
        // Only this lobby's players (every game's updates share one channel).
        if (ev.type === "resync" || ev.type === "delete" || ev.data?.game_id === g.id) loadPlayers(g.id);
      });
      loadPlayers(g.id);
    })();
    return () => { unsubG?.(); unsubP?.(); };
  }, [code]);

  useEffect(() => {
    if (game && game.status === "playing") navigate(`/game/${code}`);
  }, [game, code, navigate]);

  const loadPlayers = async (gid) => {
    const ps = await base44.entities.PlayerState.filter({ game_id: gid });
    ps.sort((a, b) => a.seat - b.seat);
    setPlayers(ps);
    if (myIdRef.current) {
      const me = ps.find((p) => p.id === myIdRef.current);
      if (me && me.wonder) setSelectedWonder(me.wonder);
    }
  };

  const join = async (overrideName) => {
    if (!game || actionRef.current) return;
    actionRef.current = true;
    try {
    const playerName = (overrideName || name).trim() || randomGreekName();
    const fresh = await base44.entities.PlayerState.filter({ game_id: game.id });
    let existing = fresh.find((p) => !p.is_ai && (p.player_name || "").toLowerCase() === playerName.toLowerCase());
    let me;
    if (existing) {
      me = existing;
    } else {
      const res = await claimSeat(game.id, game.max_players || 7, (seat, cur) => ({
        game_id: game.id,
        player_name: playerName,
        player_color: PLAYER_COLORS[seat % PLAYER_COLORS.length],
        seat,
        is_host: seat === 0 && !cur.some((p) => p.is_host),
        coins: 6,
        played_cards: [],
        science_symbols: [],
        trophies: [],
        defeats: [],
        hand: [],
        ready: false,
        connected: true,
      }));
      if (res.full) { setError("Lobby is full."); return; }
      me = res.me;
      if (me.is_host) {
        await base44.entities.Game.update(game.id, { host_id: me.id, host_name: me.player_name });
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"), [code]: { id: me.id, name: me.player_name } }));
    setMyId(me.id);
    myIdRef.current = me.id;
    setJoined(true);
    loadPlayers(game.id);
    } catch (e) {
      setError(e?.message || "Couldn't join.");
    } finally {
      actionRef.current = false;
    }
  };

  const chooseWonder = async (wid) => {
    if (!myId) return;
    setSelectedWonder(wid);
    await base44.entities.PlayerState.update(myId, { wonder: wid, wonder_side: "A" });
    loadPlayers(game.id);
  };

  const chooseRandomWonder = async () => {
    if (!myId || !allWonders.length) return;
    const w = allWonders[Math.floor(Math.random() * allWonders.length)];
    const hasNight = w.id.startsWith("c:")
      ? !!customWonders.find((x) => `c:${x.id}` === w.id)?.night
      : !!WONDERS.find((x) => x.id === w.id)?.night;
    const side = hasNight && Math.random() < 0.5 ? "B" : "A";
    setSelectedWonder(w.id);
    await base44.entities.PlayerState.update(myId, { wonder: w.id, wonder_side: side });
    loadPlayers(game.id);
  };

  const setAIDifficulty = async (playerId, difficulty) => {
    if (!game) return;
    await base44.entities.PlayerState.update(playerId, {
      ai_difficulty: difficulty,
      coins: difficulty === "easy" ? 3 : 6,
    });
    loadPlayers(game.id);
  };

  const chooseSide = async (side) => {
    if (!myId) return;
    await base44.entities.PlayerState.update(myId, { wonder_side: side });
    loadPlayers(game.id);
  };

  const toggleCities = async (v) => { if (!game) return; await base44.entities.Game.update(game.id, { cities_expansion: v }); };
  const toggleEdifice = async (v) => { if (!game) return; await base44.entities.Game.update(game.id, { edifice_expansion: v }); };
  const toggleArmada = async (v) => { if (!game) return; await base44.entities.Game.update(game.id, { armada_expansion: v }); };
  const togglePack = async (p, v) => {
    if (!game) return;
    const cur = (game.packs || []).filter((x) => String(x).toLowerCase() !== String(p).toLowerCase());
    if (v) cur.push(p);
    await base44.entities.Game.update(game.id, { packs: cur });
  };

  const addAI = async () => {
    const res = await claimSeat(game.id, game.max_players || 7, (seat, cur) => {
    const usedWonders = cur.map((p) => p.wonder).filter(Boolean);
    const wonder = allWonders.find((w) => !usedWonders.includes(w.id)) || allWonders[seat % allWonders.length];
    const usedNames = new Set(cur.map((p) => p.player_name));
    let aiName = randomGreekName();
    let attempts = 0;
    while (usedNames.has(aiName) && attempts < 20) { aiName = randomGreekName(); attempts++; }
    return {
      game_id: game.id,
      player_name: aiName,
      player_color: PLAYER_COLORS[seat % PLAYER_COLORS.length],
      seat,
      is_host: false,
      is_ai: true,
      ai_difficulty: "normal",
      wonder: wonder.id,
      wonder_side: "A",
      coins: 6,
      played_cards: [],
      science_symbols: [],
      leaders_hand: [],
      trophies: [],
      defeats: [],
      hand: [],
      ready: false,
      connected: true,
    };
    });
    if (res.full) return null;
    const ps = [...res.players]; ps.sort((a, b) => a.seat - b.seat); setPlayers(ps);
    return res.me;
  };

  const startGame = async () => {
    if (actionRef.current) return;
    const ready = players.filter((p) => p.wonder);
    if (ready.length < 1) return alert("Choose a wonder first.");
    actionRef.current = true;
    try {
    // Anyone who joined but never picked a wonder gets a free one (otherwise
    // they'd silently share the first wonder with someone else).
    {
      const ps = await base44.entities.PlayerState.filter({ game_id: game.id });
      const used = new Set(ps.map((p) => p.wonder).filter(Boolean));
      for (const p of ps.filter((x) => !x.wonder)) {
        const free = allWonders.filter((w) => !used.has(w.id));
        const pick = (free.length ? free : allWonders)[Math.floor(Math.random() * (free.length || allWonders.length))];
        used.add(pick.id);
        await base44.entities.PlayerState.update(p.id, { wonder: pick.id, wonder_side: "A" });
      }
    }
    // Auto-fill empty slots with AI up to 3 players.
    while (true) {
      let ps = await base44.entities.PlayerState.filter({ game_id: game.id });
      ps.sort((a, b) => a.seat - b.seat);
      if (ps.filter((p) => p.wonder).length >= 3 || ps.length >= (game.max_players || 7)) break;
      const added = await addAI();
      if (!added) break;
    }
    await base44.entities.Game.update(game.id, { status: "playing", phase: "setup", age: "leader" });
    } finally {
      actionRef.current = false;
    }
  };

  const leave = () => {
    // Forget only this lobby (other games you're in keep your seat).
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    delete ids[code];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    navigate("/");
  };

  const copyCode = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (error) return <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center"><div className="text-center"><p className="text-xl mb-4">{error}</p><Button onClick={() => navigate("/")}>Home</Button></div></div>;
  if (!game) return <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center"><div className="w-8 h-8 border-4 border-stone-700 border-t-amber-400 rounded-full animate-spin" /></div>;

  const me = players.find((p) => p.id === myId);
  const isHost = me?.is_host;
  const allWonders = [
    ...WONDERS.map((w) => ({ id: w.id, name: w.name, custom: false })).filter((w) => (w.id === "ur" ? !!game.edifice_expansion : true)),
    ...(customWonders || []).filter((w) => !w.builtin_id).map((w) => ({ id: `c:${w.id}`, name: w.name, custom: true })),
  ];
  const wonderName = (id) => allWonders.find((w) => w.id === id)?.name;
  const selectedHasNight = (() => {
    if (!selectedWonder) return false;
    if (selectedWonder.startsWith("c:")) return !!customWonders.find((x) => `c:${x.id}` === selectedWonder)?.night;
    return !!WONDERS.find((x) => x.id === selectedWonder)?.night;
  })();

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <button onClick={leave} className="text-stone-400 hover:text-white text-sm mb-6">← Leave</button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-display font-bold">Lobby</h1>
            <p className="text-stone-400">Waiting for players…</p>
          </div>
          <button onClick={copyCode} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            <span className="font-mono text-lg tracking-wider">{code}</span>
          </button>
        </div>

        {!joined ? (
          <Card className="bg-white/5 border-white/10 max-w-md">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm text-stone-300 mb-1 block">Your name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter a name (or leave blank for a random one)" className="bg-white/5 border-white/10" onKeyDown={(e) => e.key === "Enter" && join()} />
              </div>
              <Button onClick={() => join()} className="w-full bg-amber-500 hover:bg-amber-600 text-black">Join Lobby</Button>
              <div className="flex gap-2">
                <Button onClick={() => { setName("Odysseus"); join("Odysseus"); }} variant="outline" size="sm" className="flex-1 border-white/20 text-white hover:bg-white/10">Join as Odysseus</Button>
                <Button onClick={() => { setName("Penelope"); join("Penelope"); }} variant="outline" size="sm" className="flex-1 border-white/20 text-white hover:bg-white/10">Join as Penelope</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-6">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-5">
                    <h2 className="font-semibold mb-3">Players ({players.length}/{game.max_players})</h2>
                    <div className="space-y-2">
                      {players.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                          <div className="w-3 h-3 rounded-full" style={{ background: p.player_color }} />
                          <span className="flex-1">{p.player_name}</span>
                          {p.is_ai && (
                            <button
                              onClick={() => setAIDifficulty(p.id, p.ai_difficulty === "easy" ? "normal" : "easy")}
                              className={`text-[10px] px-1.5 py-0.5 rounded border transition ${p.ai_difficulty === "easy" ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "bg-white/5 border-white/10 text-stone-400 hover:text-stone-200"}`}
                              title="Toggle AI difficulty"
                            >
                              {p.ai_difficulty === "easy" ? "Easy" : "Normal"}
                            </button>
                          )}
                          {p.is_ai && <Bot className="h-3.5 w-3.5 text-blue-400" />}
                          {p.is_host && <Crown className="h-4 w-4 text-amber-400" />}
                          {p.wonder && <span className="text-xs text-stone-400">{wonderName(p.wonder)?.split(" (")[0]}</span>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold">Choose Your Wonder</h2>
                      <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={chooseRandomWonder}>
                        <Shuffle className="h-3.5 w-3.5 mr-1" /> Random
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                      {allWonders.map((w) => (
                        <button key={w.id} onClick={() => chooseWonder(w.id)} className={`text-left px-3 py-2 rounded-lg border-2 transition ${selectedWonder === w.id ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                          <span className="font-medium">{w.name}</span>
                          {w.custom && <span className="text-[10px] text-purple-300 ml-2">custom</span>}
                        </button>
                      ))}
                    </div>
                    {me && selectedWonder && selectedHasNight && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                        <span className="text-xs text-stone-400">Side:</span>
                        <button onClick={() => chooseSide("A")} className={`px-2 py-1 rounded text-xs border ${me.wonder_side !== "B" ? "bg-amber-500 text-black border-amber-400" : "bg-white/5 border-white/10 text-stone-300"}`}>Day</button>
                        <button onClick={() => chooseSide("B")} className={`px-2 py-1 rounded text-xs border ${me.wonder_side === "B" ? "bg-amber-500 text-black border-amber-400" : "bg-white/5 border-white/10 text-stone-300"}`}>Night</button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-5">
                  {me && selectedWonder ? (
                    <WonderPreview wonder={selectedWonder} side={me.wonder_side || "A"} />
                  ) : (
                    <p className="text-stone-400 text-sm text-center py-8">Select a wonder to preview it.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {isHost && (
              <Card className="bg-white/5 border-white/10 mb-8">
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-3">Game Options</h2>
                  <div className="flex items-center gap-2 mb-3">
                    <Switch checked={!!game.cities_expansion} onCheckedChange={toggleCities} />
                    <label className="text-sm text-stone-300 cursor-pointer select-none">Cities Expansion</label>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Switch checked={!!game.edifice_expansion} onCheckedChange={toggleEdifice} />
                    <label className="text-sm text-stone-300 cursor-pointer select-none">Edifice Expansion <span className="text-[10px] text-purple-300">(enables Ur wonder)</span></label>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Switch checked={!!game.armada_expansion} onCheckedChange={toggleArmada} />
                    <label className="text-sm text-stone-300 cursor-pointer select-none">Armada Expansion <span className="text-[10px] text-cyan-300">(ships, naval resolution)</span></label>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-stone-400">Packs</p>
                    {customPacks.map((p) => (
                      <div key={p} className="flex items-center gap-2">
                        <Switch checked={(game.packs || []).includes(p)} onCheckedChange={(v) => togglePack(p, v)} />
                        <label className="text-sm text-stone-300 cursor-pointer select-none">{p}</label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {isHost && (
              <div className="text-center space-y-3">
                <Button onClick={startGame} disabled={players.filter((p) => p.wonder).length < 1} className="bg-emerald-500 hover:bg-emerald-600 text-black text-lg px-8 py-6">
                  Start Game ({players.filter((p) => p.wonder).length} ready)
                </Button>
                {players.filter((p) => p.wonder).length < 3 && <p className="text-xs text-stone-400 mt-2">Empty slots will be filled with AI.</p>}
                <div>
                  <Button onClick={addAI} disabled={players.length >= (game.max_players || 7)} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    <Bot className="h-4 w-4 mr-2" /> Add AI Player
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}