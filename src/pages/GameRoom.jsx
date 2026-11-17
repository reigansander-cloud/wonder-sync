import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { ArrowLeft, Trophy, Bot } from "lucide-react";
import CardView from "@/components/game/CardView";
import TradeDialog from "@/components/game/TradeDialog";
import ExpansionPanel from "@/components/game/ExpansionPanel";
import ArmadaMoveDialog from "@/components/game/ArmadaMoveDialog";
import ArmadaFreeMoveDialog from "@/components/game/ArmadaFreeMoveDialog";
import MoveShipChooser from "@/components/game/MoveShipChooser";
import IslandVpChooser from "@/components/game/IslandVpChooser";
import AgeEndPopup from "@/components/game/AgeEndPopup";
import UnearthDialog from "@/components/game/UnearthDialog";
import MirrorDialog from "@/components/game/MirrorDialog";
import IslandPickDialog from "@/components/game/IslandPickDialog";
import CoinLogDialog from "@/components/game/CoinLogDialog";
import VPBreakdownDialog from "@/components/game/VPBreakdownDialog";
import DonateDialog from "@/components/game/DonateDialog";
import UrChoiceDialog from "@/components/game/UrChoiceDialog";
import RomeLeaderChoiceDialog from "@/components/game/RomeLeaderChoiceDialog";
import BuryDialog from "@/components/game/BuryDialog";
import DiscardFromCityDialog from "@/components/game/DiscardFromCityDialog";
import WonderTierChoiceDialog from "@/components/game/WonderTierChoiceDialog";
import EdificeCompleteDialog from "@/components/game/EdificeCompleteDialog";
import { MyBoard, NeighborPanel, InspectOverlay, HandCard, OtherPlayersButton } from "@/components/game/GameRoomParts";
import { generateArmadaBoard } from "@/lib/game/armada";
import { getWonder, setWonderRegistry, ARMADA_REWARDS } from "@/lib/game/constants";
import {
  generateDeck, canAffordWonderStage, scorePlayer, rotateHands,
  passDirectionForAge, nextAge, getProducibleResources, farNeighborsOf,
  aiChoose, aiChooseLeader, aiChooseLeaderDraft, aiRandomPrefs, recomputeStaticEffects, shuffle, applyEffect,
  computeLeaderReduction,
} from "@/lib/game/rules";
import { rollEdifices, edificeForAge, edificeList, setEdificeRegistry } from "@/lib/game/edifices";
import { beginAction, resolveDecision, aiResolveQueue, mergeNotifs } from "@/lib/game/queue";
import { finishRound, advanceFromEdificeGate } from "@/lib/game/roundEnd";

const STORAGE_KEY = "wonders_player_identity";

function dedupePacks(citiesExpansion, packs) {
  const out = []; const seen = new Set();
  if (citiesExpansion) { out.push("cities"); seen.add("cities"); }
  for (const p of packs || []) { const key = String(p).toLowerCase(); if (!seen.has(key)) { seen.add(key); out.push(p); } }
  return out;
}
function armadaActive(game) {
  if (!game) return false;
  if (game.armada_expansion) return true;
  return (game.packs || []).some((p) => String(p).toLowerCase() === "armada");
}

// The shared discard pile is edited atomically on the server so two players
// discarding at the same moment (or the host's AI moves) can't overwrite each
// other's cards.
async function editDiscard(gameId, { add = [], remove = [] } = {}) {
  add = (add || []).filter(Boolean);
  remove = (remove || []).filter(Boolean);
  if (!add.length && !remove.length) return;
  await base44.entities.Game.listEdit(gameId, ["discard"], { add, remove });
}

// Edifice donations mutate a copy of game.edifice_state. Instead of writing
// that whole object back (which would wipe out another player's donation made
// at the same moment), send only what changed, as atomic server edits.
async function persistEdificeDiff(gameId, before, after) {
  for (const [edId, st] of Object.entries(after || {})) {
    const old = (before || {})[edId] || {};
    const added = (st.holders || []).slice((old.holders || []).length);
    const delta = (st.remaining || 0) - (old.remaining || 0);
    if (added.length) await base44.entities.Game.listEdit(gameId, ["edifice_state", edId, "holders"], { add: added });
    if (delta) await base44.entities.Game.incr(gameId, ["edifice_state", edId, "remaining"], delta);
  }
}
const cloneJson = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

// Build the DB patch for a player's full game state.
function playerPatch(p) {
  return {
    coins: p.coins, shields: p.shields, played_cards: p.played_cards || [],
    hand: p.hand || [], leaders_hand: p.leaders_hand || [],
    science_symbols: p.science_symbols || [], chain_symbols_owned: p.chain_symbols_owned || [],
    wonder_stages_built: p.wonder_stages_built || 0, stages_built_this_age: p.stages_built_this_age || 0,
    wonder_choices: p.wonder_choices || [], free_card_used: p.free_card_used || {}, free_colors_used: p.free_colors_used || {},
    chosen_card_id: p.chosen_card_id || null, chosen_action: p.chosen_action || null, chosen_trades: p.chosen_trades || [],
    decision_queue: p.decision_queue || [], pending_outgoing: p.pending_outgoing || [], round_done: !!p.round_done,
    naval_shields: p.naval_shields || 0, diplomacy_ages: p.diplomacy_ages || [], naval_diplomacy_ages: p.naval_diplomacy_ages || [], trade_level: p.trade_level || 0, armada_board: p.armada_board || {},
    patronage_tokens: p.patronage_tokens || [], bonus_vp: p.bonus_vp || 0, edifice_reward_effects: p.edifice_reward_effects || [],
    trophies: p.trophies || [], defeats: p.defeats || [], penalties: p.penalties || 0,
    naval_trophies: p.naval_trophies || [], naval_defeats: p.naval_defeats || [],
    mirror_choices: p.mirror_choices || {}, move_ship_choices: p.move_ship_choices || [],
    island_choice: p.island_choice || null, unearth_choice: p.unearth_choice || null,
    bury_leader_id: p.bury_leader_id || null, wonder_discard_choice: p.wonder_discard_choice || null,
    wonder_choice: p.wonder_choice != null ? Number(p.wonder_choice) : null,
    rome_leader_choice: p.rome_leader_choice || null, ur_edifice_choice: p.ur_edifice_choice || null,
    edifice_donate: p.edifice_donate || null, armada_move: p.armada_move || null, armada_move_free: p.armada_move_free || null,
    island_vp_choices: p.island_vp_choices || [], boarding_side: p.boarding_side || null,
    edifice_ack: !!p.edifice_ack, ready: !!p.round_done,
    last_age_tokens: p.last_age_tokens || null,
    notifications: (p.notifications || []).slice(-50),
  };
}

export default function GameRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [myId, setMyId] = useState(null);
  const [inspectId, setInspectId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [buildMode, setBuildMode] = useState(false);
  const [ageEndSeen, setAgeEndSeen] = useState(null);
  const [coinLogOpen, setCoinLogOpen] = useState(false);
  const [vpBreakdownOpen, setVpBreakdownOpen] = useState(false);
  const [islandVpOpen, setIslandVpOpen] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const [flashes, setFlashes] = useState({});
  const prevRef = useRef({});
  const resolveErrRef = useRef(false);
  const resolvingRef = useRef(false);
  const startingRef = useRef(false);
  const gameRef = useRef(null);
  const loadTimer = useRef(null);
  const actingRef = useRef(false); // a human move is being saved (stops double clicks)
  useEffect(() => { gameRef.current = game; }, [game]);

  useEffect(() => {
    base44.entities.Wonder.list("-created_date", 500).then((ws) => {
      const map = {};
      for (const w of ws || []) map[w.builtin_id || `c:${w.id}`] = w;
      setWonderRegistry(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    base44.entities.Edifice.list("-created_date", 500).then((list) => setEdificeRegistry(list || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const identity = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (identity[code]) setMyId(identity[code].id);
  }, [code]);

  useEffect(() => {
    let unsubG, unsubP;
    (async () => {
      const gs = await base44.entities.Game.filter({ code }, "-created_date", 1);
      if (!gs.length) { navigate("/"); return; }
      gameRef.current = gs[0];
      setGame(gs[0]);
      base44.entities.Card.list("-created_date", 5000).then(setAllCards);
      const gid = gs[0].id;
      unsubG = base44.entities.Game.subscribe(async (ev) => {
        if (ev.type === "resync" || (ev.data && ev.data.id === gid)) {
          try { setGame(await base44.entities.Game.get(gid)); } catch (e) { /* ignore */ }
          if (ev.type === "resync") loadPlayers();
        }
      });
      unsubP = base44.entities.PlayerState.subscribe((ev) => {
        // Every game's player updates share one channel; only reload for ours.
        if (ev.type !== "resync" && ev.type !== "delete" && ev.data?.game_id && ev.data.game_id !== gid) return;
        if (loadTimer.current) clearTimeout(loadTimer.current);
        loadTimer.current = setTimeout(() => loadPlayers(), 150);
      });
      loadPlayers();
    })();
    return () => { unsubG?.(); unsubP?.(); if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, [code]);

  // Reloads the players. If a load is already running, another one is queued
  // and the returned promise only settles once data fetched AFTER this call
  // is in. (Before, a caller could get an older, in-flight result back, and
  // the host would then replay AI moves or resolve a round on stale data.)
  const loadPlayersRef = useRef({ promise: null, pending: false });
  const loadPlayers = () => {
    const ref = loadPlayersRef.current;
    if (ref.promise) { ref.pending = true; return ref.promise; }
    ref.promise = (async () => {
      try {
        do {
          ref.pending = false;
          let gid = gameRef.current?.id;
          if (!gid) { const gs = await base44.entities.Game.filter({ code }, "-created_date", 1); gid = gs[0]?.id; }
          if (!gid) return;
          const ps = await base44.entities.PlayerState.filter({ game_id: gid });
          ps.sort((a, b) => a.seat - b.seat);
          setPlayers(ps);
        } while (ref.pending);
      } catch (e) { console.error("loadPlayers error:", e?.message || e); }
      finally { ref.promise = null; }
    })();
    return ref.promise;
  };

  // Host jobs (AI moves, resolving rounds) run one at a time. The effect below
  // re-runs on every update, so without this an AI could move twice.
  // Pull the latest game + players into the page, then let the host effect
  // run again (so it never acts on the state from before its own write).
  const refreshThenRelease = async (ref) => {
    try { await loadPlayers(); } catch (e) { /* ignore */ }
    try { const g = await base44.entities.Game.get(gameRef.current?.id); gameRef.current = g; setGame(g); } catch (e) { /* ignore */ }
    ref.current = false;
  };

  const runHostJob = (label, job) => {
    resolvingRef.current = true;
    (async () => {
      try { await job(); }
      catch (e) { console.error(label, e); resolveErrRef.current = true; setResolveError(e?.message || String(e)); }
      finally {
        try { await loadPlayers(); } catch (e) { /* ignore */ }
        try { const g = await base44.entities.Game.get(gameRef.current?.id); gameRef.current = g; setGame(g); } catch (e) { /* ignore */ }
        resolvingRef.current = false;
      }
    })();
  };

  const allCardsById = useMemo(() => {
    const map = {};
    for (const c of allCards) map[c.id] = c;
    for (const p of players) {
      for (const c of (p.played_cards || [])) if (c?.id) map[c.id] = map[c.id] || c;
      for (const c of (p.hand || [])) if (c?.id) map[c.id] = map[c.id] || c;
      for (const c of (p.leaders_hand || [])) if (c?.id) map[c.id] = map[c.id] || c;
    }
    return map;
  }, [allCards, players]);

  const me = players.find((p) => p.id === myId);
  const isHost = me?.is_host;
  const n = players.length;

  const neighbors = useMemo(() => {
    if (!me || !n) return { left: null, right: null };
    return {
      left: players.find((p) => p.seat === (me.seat + 1) % n),
      right: players.find((p) => p.seat === (me.seat - 1 + n) % n),
    };
  }, [me, players, n]);

  const farNeighbors = useMemo(() => (me && n ? farNeighborsOf(me, players) : []), [me, players, n]);
  const myScore = useMemo(() => (me ? scorePlayer(me, players, allCardsById) : null), [me, players, allCardsById]);

  // Flash player buttons when they play a card or commit a trade.
  useEffect(() => {
    const prev = prevRef.current;
    const nf = {};
    for (const p of players) {
      const pp = prev[p.id] || { played: 0, trades: 0 };
      const playedNow = (p.played_cards || []).length;
      const tradesNow = (p.chosen_trades || []).length;
      if (playedNow > pp.played) {
        const card = (p.played_cards || [])[playedNow - 1];
        const full = allCardsById[card?.id] || card;
        nf[p.id] = full?.color === "red" ? "red" : "green";
      } else if (tradesNow > pp.trades) {
        nf[p.id] = "yellow";
      }
    }
    const next = {};
    for (const p of players) next[p.id] = { played: (p.played_cards || []).length, trades: (p.chosen_trades || []).length };
    prevRef.current = next;
    if (Object.keys(nf).length) {
      setFlashes((f) => ({ ...f, ...nf }));
      const keys = Object.keys(nf);
      setTimeout(() => setFlashes((f) => { const c = { ...f }; for (const k of keys) delete c[k]; return c; }), 1500);
    }
  }, [players, allCardsById]);

  const canBuildWonder = !!me && !me.round_done && (game?.phase === "leader_select" || (game?.phase === "choosing" && game?.age !== "leader")) && (me.wonder_stages_built || 0) < (getWonder(me.wonder, me.wonder_side).stages.length) && canAffordWonderStage(me, neighbors.left, neighbors.right, allCardsById, farNeighbors);

  // ---------- Host orchestration ----------
  useEffect(() => {
    if (!game || !players.length || !myId) return;
    const me = players.find((p) => p.id === myId);
    if (!me || !me.is_host) return;
    if (busy || resolvingRef.current || startingRef.current) return;
    if (resolveErrRef.current) return;
    if (game.status !== "playing") return;
    if (!allCards || !allCards.length) return;

    if (game.phase === "setup" && game.age === "leader") {
      startingRef.current = true;
      startLeaderDraft().catch((e) => console.error("startLeaderDraft", e)).finally(() => refreshThenRelease(startingRef));
      return;
    }
    if (game.phase === "dealing") {
      startingRef.current = true;
      startAge(game.age).catch((e) => console.error("startAge", e)).finally(() => refreshThenRelease(startingRef));
      return;
    }
    if (game.phase === "edifice_gate") {
      // AI players acknowledge the edifice popup (resolving any penalty decision).
      const aiPending = players.filter((p) => p.is_ai && !p.edifice_ack);
      if (aiPending.length) {
        runHostJob("edifice_gate AI", async () => {
          for (const ai of aiPending) {
            const sim = JSON.parse(JSON.stringify(ai));
            aiResolveQueue(sim, game, players, allCardsById);
            sim.edifice_ack = true;
            sim.round_done = true;
            await base44.entities.PlayerState.update(ai.id, playerPatch(sim));
          }
        });
        return;
      }
      if (players.every((p) => p.edifice_ack)) {
        runHostJob("edifice_gate", async () => {
          const g = await base44.entities.Game.get(game.id);
          const ps = await base44.entities.PlayerState.filter({ game_id: game.id });
          ps.sort((a, b) => a.seat - b.seat);
          if (g.phase !== "edifice_gate" || !ps.every((p) => p.edifice_ack)) return; // already handled
          const res = advanceFromEdificeGate(g, ps, allCardsById);
          await base44.entities.PlayerState.bulkUpdate(res.players.map((p) => ({ id: p.id, ...playerPatch(p) })));
          await base44.entities.Game.update(game.id, { phase: res.game.phase, round: res.game.round, status: res.game.status || "playing", age: res.game.age });
        });
      }
      return;
    }
    if (game.phase === "choosing") {
      // Leader draft: AI picks, then rotate when all round_done.
      if (game.age === "leader") {
        const aiPending = players.filter((p) => p.is_ai && !p.round_done);
        if (aiPending.length) {
          runHostJob("leader draft AI", async () => {
            for (const ai of aiPending) {
              const choice = aiChooseLeaderDraft(ai, allCardsById);
              const sim = JSON.parse(JSON.stringify(ai));
              const res = beginAction(sim, choice.cardId, "pick", game, players, allCardsById);
              sim.decision_queue = res.decisions || [];
              sim.pending_outgoing = res.outgoing || [];
              sim.round_done = true;
              await base44.entities.PlayerState.update(ai.id, playerPatch(sim));
            }
          });
          return;
        }
        if (players.every((p) => p.round_done)) {
          runHostJob("draft resolve", resolveDraftRound);
        }
        return;
      }
      // Normal age: AI resolves its full queue.
      const aiPending = players.filter((p) => p.is_ai && !p.round_done);
      if (aiPending.length) {
        runHostJob("AI moves", async () => {
          const aiDiscards = [];
          const edBefore = cloneJson(game.edifice_state);
          for (const ai of aiPending) {
            const sim = JSON.parse(JSON.stringify(ai));
            if (!sim.chosen_card_id && (sim.hand || []).length > 0) {
              let choice;
              try { choice = aiChoose(sim, players, allCardsById, game); } catch (e) {
                const card = (sim.hand || [])[Math.floor(Math.random() * sim.hand.length)];
                choice = { cardId: card?.id || null, action: "discard" };
              }
              const res = beginAction(sim, choice.cardId, choice.action, game, players, allCardsById);
              sim.decision_queue = res.decisions || [];
              sim.pending_outgoing = [...(sim.pending_outgoing || []), ...(res.outgoing || [])];
              if (res.notifs) mergeNotifs(sim, res.notifs);
              if (res.discardedCard) aiDiscards.push(res.discardedCard);
              if (res.autoDiscardedCard) aiDiscards.push(res.autoDiscardedCard);
            }
            aiResolveQueue(sim, game, players, allCardsById);
            if (sim._autoDiscards?.length) aiDiscards.push(...sim._autoDiscards);
            await base44.entities.PlayerState.update(ai.id, playerPatch(sim));
            if (sim._leaderDeckDepleted) { await base44.entities.Game.update(game.id, { leader_deck: sim._leaderDeckDepleted }); game.leader_deck = sim._leaderDeckDepleted; }
          }
          // AI donations mutated game.edifice_state; save just the changes.
          await persistEdificeDiff(game.id, edBefore, game.edifice_state);
          await editDiscard(game.id, { add: aiDiscards });
        });
        return;
      }
      // Safety: if every player has an empty hand, the age must end — but only
      // force-done players who have NO pending decisions (a stuck/bug state).
      // Players with a legitimate pending decision (e.g. edifice_donate after
      // building a wonder on the last card) must be allowed to resolve it
      // before the round ends, or the edifice would complete without their
      // donation.
      if (players.every((p) => (p.hand || []).length === 0) && players.some((p) => !p.round_done)) {
        const stuck = players.filter((p) => !p.round_done && (p.decision_queue || []).length === 0);
        if (stuck.length) {
          runHostJob("unstick", async () => {
            await base44.entities.PlayerState.bulkUpdate(
              stuck.map((p) => ({ id: p.id, round_done: true, ready: true }))
            );
          });
        }
        return;
      }
      if (players.every((p) => p.round_done)) {
        // Safety: if all players have empty hands on round 0, the cards were
        // never dealt (stale state from leader_select advance). Re-deal
        // instead of resolving — resolving with empty hands would falsely
        // trigger age-end edifice completion.
        if ((game.round || 0) === 0 && players.every((p) => (p.hand || []).length === 0)) {
          startingRef.current = true;
          startAge(game.age, { redeal: true }).catch((e) => console.error("startAge", e)).finally(() => refreshThenRelease(startingRef));
          return;
        }
        runHostJob("resolveRound", resolveRound);
      }
      return;
    }
    if (game.phase === "leader_select") {
      const aiPending = players.filter((p) => p.is_ai && !p.round_done);
      if (aiPending.length) {
        runHostJob("leader select AI", async () => {
          for (const ai of aiPending) {
            const sim = JSON.parse(JSON.stringify(ai));
            if (!sim.chosen_card_id) {
              let choice;
              try { choice = aiChooseLeader(sim, players, allCardsById, game); } catch (e) {
                choice = { cardId: (sim.leaders_hand || [])[0]?.id || null, action: "discard" };
              }
              const res = beginAction(sim, choice.cardId, choice.action, game, players, allCardsById);
              sim.decision_queue = res.decisions || [];
              sim.pending_outgoing = [...(sim.pending_outgoing || []), ...(res.outgoing || [])];
              if (res.discardedCard) sim._discardedCard = res.discardedCard;
            }
            aiResolveQueue(sim, game, players, allCardsById);
            if (sim._discardedCard) await editDiscard(game.id, { add: [sim._discardedCard] });
            if (sim._leaderDeckDepleted) { await base44.entities.Game.update(game.id, { leader_deck: sim._leaderDeckDepleted }); game.leader_deck = sim._leaderDeckDepleted; }
            await base44.entities.PlayerState.update(ai.id, playerPatch(sim));
          }
        });
        return;
      }
      if (players.every((p) => p.round_done)) {
        runHostJob("leader_select advance", async () => {
          const cur = await base44.entities.Game.get(game.id);
          if (cur.phase !== "leader_select" || String(cur.age) !== String(game.age)) return; // already advanced
          {
            const nx = nextAge(game.age);
            if (!nx) {
              await base44.entities.Game.update(game.id, { phase: "scoring", status: "finished" });
            } else {
              // Clear round_done BEFORE advancing so a stale React state
              // (oversize broadcast) can't trigger a spurious resolveRound
              // with empty hands — which would complete edifices at "age end".
              await base44.entities.PlayerState.bulkUpdate(players.map((p) => ({
                id: p.id, round_done: false, ready: false, chosen_card_id: null, chosen_action: null, decision_queue: [],
              })));
              await base44.entities.Game.update(game.id, { age: nx, round: 0, phase: "dealing" });
            }
          }
        });
      }
      return;
    }
  }, [game, players, myId, allCards]);

  // Safety net: periodically re-check host duties.
  useEffect(() => {
    if (!isHost) return;
    const t = setInterval(() => {
      if (resolvingRef.current || startingRef.current) return;
      const g = gameRef.current;
      if (!g || g.status !== "playing") return;
      if (g.phase !== "choosing" && g.phase !== "leader_select" && g.phase !== "dealing" && g.phase !== "edifice_gate") return;
      loadPlayers();
    }, 4000);
    return () => clearInterval(t);
  }, [isHost]);

  // ---------- Host: start leader draft ----------
  const startLeaderDraft = async () => {
    setBusy(true);
    try {
      const cur = await base44.entities.Game.get(game.id);
      if (cur.phase !== "setup" || cur.age !== "leader") return; // already dealt
      gameRef.current = cur;
      const fresh = await base44.entities.PlayerState.filter({ game_id: game.id });
      fresh.sort((a, b) => a.seat - b.seat);
      const pc = fresh.length;
      const activePacks = dedupePacks(gameRef.current?.cities_expansion, gameRef.current?.packs);
      const deck = generateDeck(allCards, pc, "leader", activePacks);
      const perPlayer = Math.min(4, Math.floor(deck.length / pc));
      const dealtIds = new Set(deck.slice(0, pc * perPlayer).map((c) => c.id));
      const pcMatch = (c) => !c.player_counts?.length || c.player_counts.includes(pc);
      const activePackSet = new Set(activePacks);
      const leaderReserve = shuffle((allCards || []).filter((c) => c.age === "leader" && pcMatch(c) && (!c.pack || activePackSet.has(c.pack)) && !dealtIds.has(c.id)));
      if (perPlayer === 0) {
        await base44.entities.Game.update(game.id, { age: "leader", phase: "leader_select", round: 0 });
        return;
      }
      const armadaOn = armadaActive(gameRef.current);
      let armadaPatch = {};
      if (armadaOn) {
        const pool = { "1": [], "2": [], "3": [] };
        for (const c of allCards || []) if (c.pack === "island") { const a = String(c.age); if (pool[a]) pool[a].push(c); }
        armadaPatch.armada_islands = pool;
      }
      await base44.entities.PlayerState.bulkUpdate(fresh.map((p, i) => ({
        id: p.id, hand: deck.slice(i * perPlayer, i * perPlayer + perPlayer),
        chosen_card_id: null, chosen_action: null, ready: false, round_done: false, decision_queue: [], pending_outgoing: [],
        ai_prefs: p.is_ai ? aiRandomPrefs(!!gameRef.current?.cities_expansion, p.ai_difficulty) : (p.ai_prefs || []),
        leader_cost_reduction: computeLeaderReduction(p, fresh),
        ...(armadaOn ? { armada_board: generateArmadaBoard(), naval_shields: 0, naval_trophies: [], naval_defeats: [], trade_level: 0 } : {}),
      })));
      const edPatch = {};
      if (gameRef.current?.edifice_expansion && Object.keys(gameRef.current?.edifices || {}).length === 0) {
        try { setEdificeRegistry(await base44.entities.Edifice.list("-created_date", 500)); } catch (e) { /* ignore */ }
        const { edifices, edifice_state } = rollEdifices(pc);
        edPatch.edifices = edifices; edPatch.edifice_state = edifice_state;
      }
      await base44.entities.Game.update(game.id, {
        age: "leader", round: 0, phase: "choosing", pass_direction: "right",
        deck: deck.slice(pc * perPlayer), leader_deck: leaderReserve, discard: [], ...edPatch, ...armadaPatch,
      });
      await loadPlayers();
    } finally { setBusy(false); }
  };

  // ---------- Host: start a normal age (deal) ----------
  const startAge = async (age, { redeal = false } = {}) => {
    setBusy(true);
    try {
      const cur = await base44.entities.Game.get(game.id);
      const okPhase = redeal ? (cur.phase === "choosing" && (cur.round || 0) === 0) : cur.phase === "dealing";
      if (!okPhase || String(cur.age) !== String(age)) return; // already dealt
      gameRef.current = cur;
      const fresh = await base44.entities.PlayerState.filter({ game_id: game.id });
      fresh.sort((a, b) => a.seat - b.seat);
      if (redeal && fresh.some((p) => (p.hand || []).length > 0)) return; // hands are fine
      const pc = fresh.length;
      const activePacks = dedupePacks(gameRef.current?.cities_expansion, gameRef.current?.packs);
      const handSize = 7 + activePacks.length;
      const deck = generateDeck(allCards, pc, age, activePacks);
      if (deck.length < pc * handSize) {
        const nx = nextAge(age);
        if (!nx) { await base44.entities.Game.update(game.id, { phase: "scoring", status: "finished" }); return; }
        await base44.entities.Game.update(game.id, { age, phase: "leader_select", round: 0 });
        return;
      }
      await base44.entities.PlayerState.bulkUpdate(fresh.map((p, i) => ({
        id: p.id, hand: deck.slice(i * handSize, i * handSize + handSize),
        chosen_card_id: null, chosen_action: null, stages_built_this_age: 0, last_age_tokens: null,
        ready: false, round_done: false, decision_queue: [], pending_outgoing: [],
      })));
      await base44.entities.Game.update(game.id, {
        age, round: 0, phase: "choosing", pass_direction: passDirectionForAge(age),
        deck: deck.slice(pc * handSize), discard: gameRef.current?.discard || [], play_both_round: false,
      });
      // Ensure players state is fresh before releasing the starting guard,
      // otherwise the host effect re-runs with stale players (round_done=true,
      // empty hands) and immediately ends the age.
      await loadPlayers();
    } finally { setBusy(false); }
  };

  // ---------- Host: resolve a draft round (rotate or transition) ----------
  // Both resolvers re-read the game and players from the server first, so a
  // move that only just landed (e.g. an AI discard) isn't lost, and they do
  // nothing if another tab already resolved this round.
  const resolveDraftRound = async () => {
    {
      const g = await base44.entities.Game.get(game.id);
      if (g.phase !== "choosing" || g.age !== "leader" || (g.round || 0) !== (game.round || 0)) return;
      const fresh = await base44.entities.PlayerState.filter({ game_id: game.id });
      fresh.sort((a, b) => a.seat - b.seat);
      if (!fresh.every((p) => p.round_done)) return;
      for (const p of fresh) {
        const card = (p.hand || []).find((c) => c.id === p.chosen_card_id);
        if (card) p.leaders_hand = [...(p.leaders_hand || []), card];
        p.hand = (p.hand || []).filter((c) => c.id !== p.chosen_card_id);
        p.chosen_card_id = null; p.chosen_action = null; p.round_done = false; p.ready = false;
      }
      if (fresh.every((p) => (p.hand || []).length === 0) || (g.round || 0) >= 4) {
        await base44.entities.PlayerState.bulkUpdate(fresh.map((p) => ({ id: p.id, ...playerPatch(p) })));
        await base44.entities.Game.update(g.id, { round: 0, phase: "leader_select" });
      } else {
        const rotated = rotateHands(fresh, g.pass_direction);
        await base44.entities.PlayerState.bulkUpdate(rotated.map((p) => ({ id: p.id, ...playerPatch(p) })));
        await base44.entities.Game.update(g.id, { round: (g.round || 0) + 1 });
      }
    }
  };

  // ---------- Host: resolve a normal round (finishRound) ----------
  const resolveRound = async () => {
    {
      const g0 = await base44.entities.Game.get(game.id);
      if (g0.phase !== "choosing" || g0.age !== game.age || (g0.round || 0) !== (game.round || 0)) return;
      const ps = await base44.entities.PlayerState.filter({ game_id: game.id });
      ps.sort((a, b) => a.seat - b.seat);
      if (!ps.every((p) => p.round_done)) return;
      const g = { ...g0, _playerCount: ps.length };
      const res = finishRound(g, ps, allCardsById);
      // Merge round-end notifs (trade income, cull, military, edifice) into
      // each player's notifications BEFORE bulkUpdate so they persist in one
      // write — avoids a race where bulkUpdate overwrites with stale notifs.
      if (res.notifs) for (const p of res.players) {
        const inc = res.notifs[p.id] || [];
        if (inc.length) p.notifications = [...(p.notifications || []), ...inc].slice(-50);
      }
      await base44.entities.PlayerState.bulkUpdate(res.players.map((p) => ({ id: p.id, ...playerPatch(p) })));
      const gPatch = { phase: res.game.phase, round: res.game.round, discard: res.game.discard, play_both_round: res.game.play_both_round, edifice_state: res.game.edifice_state, status: res.game.status || "playing", age: res.game.age };
      if (res.game.phase === "edifice_gate") gPatch._wasAgeEnd = res.ageEnded;
      await base44.entities.Game.update(game.id, gPatch);
    }
  };

  // ---------- Human player: start an action ----------
  // Runs one human move at a time; a second click while the first is saving
  // is ignored (it used to apply the move twice, e.g. a card discarded twice).
  const act = async (fn) => {
    if (actingRef.current) return;
    actingRef.current = true;
    try { await fn(); }
    catch (e) { console.error("move failed", e); alert(`That move couldn't be saved: ${e?.message || e}. Please try again.`); loadPlayers(); }
    finally { actingRef.current = false; }
  };

  const chooseAction = (cardId, action) => act(async () => {
    if (!me || me.round_done) return;
    setBuildMode(false);
    if (action === "build" && !canBuildWonder) return;
    const g = { ...game, edifice_state: cloneJson(game.edifice_state) };
    const edBefore = cloneJson(game.edifice_state);
    const sim = JSON.parse(JSON.stringify(me));
    const res = beginAction(sim, cardId, action, g, players, allCardsById);
    await commitPlayerUpdate(sim, res, g, edBefore);
  });

  // Write a player's updated state (after beginAction or resolveDecision),
  // including any game.discard / island-pool mutations.
  // Shared-game changes are saved BEFORE the player's own state: once a
  // player is marked done the host may resolve the round, and it must already
  // see this player's discards/donations.
  const commitPlayerUpdate = async (sim, res, g = game, edBefore = null) => {
    sim.decision_queue = res.decisions || [];
    sim.pending_outgoing = [...(sim.pending_outgoing || []), ...(res.outgoing || [])];
    if (res.notifs) mergeNotifs(sim, res.notifs);
    sim.round_done = (sim.decision_queue || []).length === 0;
    await editDiscard(game.id, {
      add: [res.discardedCard, res.autoDiscardedCard],
      remove: [sim._unearthRemoveId],
    });
    if (edBefore) await persistEdificeDiff(game.id, edBefore, g.edifice_state);
    if (sim._leaderDeckDepleted) await base44.entities.Game.update(game.id, { leader_deck: sim._leaderDeckDepleted });
    await base44.entities.PlayerState.update(myId, playerPatch(sim));
    await loadPlayers();
  };

  // ---------- Human player: resolve the current decision ----------
  const onDecisionChoice = (choice) => act(async () => {
    if (!me || me.round_done) return;
    const decision = (me.decision_queue || [])[0];
    if (!decision) return;
    const g = { ...game, edifice_state: cloneJson(game.edifice_state) };
    const edBefore = cloneJson(game.edifice_state);
    const sim = JSON.parse(JSON.stringify(me));
    const res = resolveDecision(sim, decision, choice, g, players, allCardsById);
    sim.decision_queue = [...(sim.decision_queue || []).slice(1), ...(res.decisions || [])];
    sim.pending_outgoing = [...(sim.pending_outgoing || []), ...(res.outgoing || [])];
    if (res.notifs) mergeNotifs(sim, res.notifs);
    sim.round_done = (sim.decision_queue || []).length === 0;
    // Donations: only the change is sent, so two players donating at once both count.
    await persistEdificeDiff(game.id, edBefore, g.edifice_state);
    await editDiscard(game.id, { add: [res.autoDiscardedCard], remove: [sim._unearthRemoveId] });
    if (sim._islandPoolMutated && sim._islandPickedId) {
      await base44.entities.Game.listEdit(game.id, ["armada_islands", String(sim._islandPoolMutated)], { remove: [sim._islandPickedId] });
    }
    if (sim._leaderDeckDepleted) await base44.entities.Game.update(game.id, { leader_deck: sim._leaderDeckDepleted });
    await base44.entities.PlayerState.update(myId, playerPatch(sim));
    await loadPlayers();
  });

  // ---------- Human player: edifice gate acknowledge ----------
  const onEdificeAck = (discardChoice) => act(async () => {
    if (!me || me.edifice_ack) return;
    const sim = JSON.parse(JSON.stringify(me));
    // Apply the edifice penalty discard choice if any.
    const penDecision = (sim.decision_queue || []).find((d) => d.type === "edifice_penalty");
    if (penDecision && discardChoice) {
      sim.wonder_discard_choice = discardChoice;
      const eff = penDecision.effect;
      try {
        applyEffect(sim, eff, null, players, allCardsById, { age: penDecision.age });
        recomputeStaticEffects(sim, allCardsById);
      } catch (e) { /* ignore */ }
    }
    sim.decision_queue = [];
    sim.edifice_ack = true;
    sim.round_done = true;
    await base44.entities.PlayerState.update(myId, playerPatch(sim));
    await loadPlayers();
  });

  const cancelAction = () => act(async () => {
    if (!me) return;
    await base44.entities.PlayerState.update(myId, { chosen_card_id: null, chosen_action: null, decision_queue: [], round_done: false, ready: false });
    await loadPlayers();
  });

  const setBoardingSide = async (side) => {
    if (!me) return;
    await base44.entities.PlayerState.update(myId, { boarding_side: side });
    loadPlayers();
  };
  const setIslandVpChoices = async (choices) => {
    if (!me) return;
    await base44.entities.PlayerState.update(myId, { island_vp_choices: choices });
    loadPlayers();
  };

  if (!game || !me) return <div className="min-h-screen bg-stone-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-stone-700 border-t-amber-400 rounded-full animate-spin" /></div>;

  const ageLabel = game.age === "leader" ? "Leader Phase" : `Age ${game.age}`;
  const isLeaderDraft = game.phase === "choosing" && game.age === "leader";
  const isLeaderSelect = game.phase === "leader_select";
  const isNormalChoosing = game.phase === "choosing" && game.age !== "leader";
  const displayHand = isLeaderSelect ? (me.leaders_hand || []) : (me.hand || []);
  const inspectPlayer = inspectId ? players.find((p) => p.id === inspectId) : null;
  const currentDecision = (me.decision_queue || [])[0];

  if (game.status === "finished") {
    const scored = players.map((p) => ({ p, s: scorePlayer(p, players, allCardsById) })).sort((a, b) => b.s.total - a.s.total);
    const showAge3Popup = me?.last_age_tokens && String(me.last_age_tokens.age) === "3" && String(ageEndSeen) !== "3";
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 to-black text-white">
        {inspectPlayer && <InspectOverlay player={inspectPlayer} allPlayers={players} allCardsById={allCardsById} score={scorePlayer(inspectPlayer, players, allCardsById)} onClose={() => setInspectId(null)} isSelf={inspectPlayer.id === myId} age={game.age} game={game} armadaOn={armadaActive(game)} />}
        {showAge3Popup && <AgeEndPopup tokens={me.last_age_tokens} players={players} mySeat={me.seat} onDismiss={() => setAgeEndSeen("3")} />}
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <Trophy className="h-16 w-16 mx-auto text-amber-400 mb-4" />
            <h1 className="text-5xl font-display font-bold">Game Over</h1>
            <p className="text-stone-400 text-sm mt-2">Click a player to inspect their city</p>
          </div>
          <div className="space-y-3">
            {scored.map((entry, i) => (
              <UICard key={entry.p.id} onClick={() => setInspectId(entry.p.id)} className={`bg-white/5 border-white/10 cursor-pointer hover:bg-white/[0.08] transition ${i === 0 ? "ring-2 ring-amber-400" : ""}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="text-2xl font-bold w-8 text-amber-300">{i + 1}</div>
                  <div className="w-3 h-3 rounded-full" style={{ background: entry.p.player_color }} />
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2">{entry.p.player_name}{entry.p.is_ai && <Bot className="h-3.5 w-3.5 text-blue-400" />}{entry.p.id === myId && " (You)"}</div>
                    <div className="text-xs text-stone-400 flex gap-3 flex-wrap mt-1">
                      {Object.entries(entry.s.breakdown).map(([k, v]) => <span key={k}>{k}: {v}</span>)}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-amber-300">{entry.s.total}</div>
                </CardContent>
              </UICard>
            ))}
          </div>
          <div className="text-center mt-8"><Button onClick={() => navigate("/")} className="bg-amber-500 hover:bg-amber-600 text-black">Home</Button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white relative">
      {resolveError && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-red-900/95 border-b border-red-500 text-red-100 px-4 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm mb-0.5">Resolution error — round stalled</p>
            <p className="text-xs text-red-200 break-words font-mono">{resolveError}</p>
          </div>
          <Button size="sm" variant="outline" className="border-red-400 text-red-100 hover:bg-red-800 shrink-0" onClick={() => { setResolveError(null); resolveErrRef.current = false; }}>Dismiss & retry</Button>
        </div>
      )}
      {inspectPlayer && <InspectOverlay player={inspectPlayer} allPlayers={players} allCardsById={allCardsById} score={scorePlayer(inspectPlayer, players, allCardsById)} onClose={() => setInspectId(null)} isSelf={inspectPlayer.id === myId} age={game.age} game={game} armadaOn={armadaActive(game)} />}
      {me?.last_age_tokens && String(me.last_age_tokens.age) !== String(ageEndSeen) && (
        <AgeEndPopup tokens={me.last_age_tokens} players={players} mySeat={me.seat} onDismiss={() => setAgeEndSeen(me.last_age_tokens.age)} />
      )}

      <div className="sticky top-0 z-30 bg-stone-900/90 backdrop-blur border-b border-white/10 px-4 py-2 flex items-center gap-4">
        <button onClick={() => navigate("/")} className="text-stone-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-amber-300">{ageLabel}</span>
          {isLeaderDraft && <span className="text-stone-400 hidden md:inline">Draft pick {(game.round || 0) + 1}</span>}
          {isNormalChoosing && <span className="text-stone-400 hidden md:inline">Round {(game.round || 0) + 1}/6</span>}
          {isLeaderSelect && <span className="text-stone-400 hidden md:inline">Choose a leader</span>}
          {!isLeaderDraft && !isLeaderSelect && <span className="text-stone-400">Pass {game.pass_direction}</span>}
        </div>
        <div className="ml-auto hidden md:flex items-center gap-4">
          {players.map((p) => {
            const s = scorePlayer(p, players, allCardsById);
            const fl = flashes[p.id];
            const flCls = fl === "red" ? "ring-2 ring-red-500 bg-red-500/30" : fl === "yellow" ? "ring-2 ring-yellow-400 bg-yellow-400/25" : fl === "green" ? "ring-2 ring-emerald-400 bg-emerald-400/25" : "hover:bg-white/10";
            return (
              <button key={p.id} onClick={() => setInspectId(p.id)} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${flCls}`} title="Inspect">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.player_color }} />
                {p.is_ai && <Bot className="h-3 w-3 text-blue-400" />}
                <span className={`text-xs ${p.id === myId ? "font-bold text-white" : "text-stone-300"}`}>{p.player_name}</span>
                <span className="text-xs text-amber-300 font-mono">{s.total}</span>
                {p.round_done && <span className="text-[9px] text-emerald-400">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div className="grid gap-1.5 md:gap-4 grid-cols-3">
          <NeighborPanel player={neighbors.left} label="Left Neighbor" allCardsById={allCardsById} onInspect={() => setInspectId(neighbors.left?.id)} age={game.age} armadaOn={armadaActive(game)} />
          <div className="flex flex-col md:flex-row gap-1.5 md:gap-3">
            {(game.edifice_expansion || game.armada_expansion) && <div className="flex-1 min-w-0"><ExpansionPanel game={game} players={players} me={me} /></div>}
            {n > 3 && <div className="flex-1 min-w-0"><OtherPlayersButton players={players} myId={myId} neighbors={neighbors} onPick={(id) => setInspectId(id)} /></div>}
          </div>
          <NeighborPanel player={neighbors.right} label="Right Neighbor" allCardsById={allCardsById} onInspect={() => setInspectId(neighbors.right?.id)} age={game.age} armadaOn={armadaActive(game)} />
        </div>

        <MyBoard me={me} allPlayers={players} allCardsById={allCardsById} myScore={myScore} producible={getProducibleResources(me, allCardsById)} canBuildWonder={canBuildWonder} buildMode={buildMode} onStartBuild={() => setBuildMode(true)} age={game.age} game={game} armadaOn={armadaActive(game)} onSetBoardingSide={setBoardingSide} onOpenIslandVp={() => setIslandVpOpen(true)} onOpenCoinLog={() => setCoinLogOpen(true)} onOpenVpBreakdown={() => setVpBreakdownOpen(true)} />

        {/* Hand / leader selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-stone-300">
              {isLeaderDraft && "Draft a Leader (set aside for later)"}
              {isLeaderSelect && "Choose a Leader to Play"}
              {isNormalChoosing && "Your Hand"}
              {me.round_done && !currentDecision && <span className="text-xs text-emerald-400 ml-2">— waiting for others ({players.filter((p) => p.round_done).length}/{n})</span>}
            </h2>
            {me.round_done && !currentDecision && <Button size="sm" variant="outline" onClick={cancelAction}>Cancel</Button>}
          </div>

          {currentDecision ? (
            <DecisionPanel decision={currentDecision} me={me} game={game} players={players} allCardsById={allCardsById} neighbors={neighbors} farNeighbors={farNeighbors} onChoose={onDecisionChoice} onCancel={cancelAction} />
          ) : me.round_done ? (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-4">
              <p className="text-sm text-emerald-300">
                {isLeaderDraft && `You picked: ${displayHand.find((c) => c.id === me.chosen_card_id)?.name || "—"}`}
                {isLeaderSelect && `You will play: ${displayHand.find((c) => c.id === me.chosen_card_id)?.name || "—"}`}
                {isNormalChoosing && `You chose to ${me.chosen_action}: ${displayHand.find((c) => c.id === me.chosen_card_id)?.name || "—"}`}
              </p>
              {me.chosen_card_id && <CardView card={displayHand.find((c) => c.id === me.chosen_card_id)} size="md" />}
            </div>
          ) : displayHand.length === 0 ? (
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-stone-400 text-sm">No cards.</div>
          ) : (
            <div className="space-y-2">
              {buildMode && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-purple-600/20 border border-purple-500/40">
                  <span className="text-xs text-purple-200">Click a card below to build your next wonder stage — that card is removed from the game.</span>
                  <Button size="sm" variant="ghost" onClick={() => setBuildMode(false)}>Cancel</Button>
                </div>
              )}
              <div className="flex gap-3 overflow-x-auto pb-2">
                {displayHand.map((card) => (
                  <HandCard key={card.id} card={card} mode={buildMode ? "build" : isLeaderSelect ? "leader" : game.age === "leader" ? "pick" : "play"} me={me} neighbors={neighbors} allCardsById={allCardsById} farNeighbors={farNeighbors} game={game} onChoose={chooseAction} players={players} />
                ))}
              </div>
            </div>
          )}
        </div>

        {islandVpOpen && (
          <IslandVpChooser player={me} allCardsById={allCardsById} vpAmount={(() => {
            for (const c of (me.played_cards || [])) { const f = allCardsById[c.id] || c; for (const e of f.effects || []) if (e.kind === "vp_per_island") return e.amount || 0; }
            const w = getWonder(me.wonder, me.wonder_side);
            for (let i = 0; i < (me.wonder_stages_built || 0); i++) for (const e of (w.stages[i]?.effects || [])) if (e.kind === "vp_per_island") return e.amount || 0;
            return 0;
          })()} onConfirm={setIslandVpChoices} onClose={() => setIslandVpOpen(false)} />
        )}
        {coinLogOpen && <CoinLogDialog player={me} onClose={() => setCoinLogOpen(false)} />}
        {vpBreakdownOpen && <VPBreakdownDialog score={myScore} onClose={() => setVpBreakdownOpen(false)} />}
      </div>
    </div>
  );
}

// ---------- Decision panel: renders the right dialog for the current decision ----------
function DecisionPanel({ decision, me, game, players, allCardsById, neighbors, farNeighbors, onChoose, onCancel }) {
  const n = players.length;
  const left = players.find((p) => p.seat === (me.seat + 1) % n);
  const right = players.find((p) => p.seat === (me.seat - 1 + n) % n);

  switch (decision.type) {
    case "wonder_tier": {
      const wonder = getWonder(me.wonder, me.wonder_side);
      const stage = wonder.stages[me.wonder_stages_built || 0];
      return <WonderTierChoiceDialog wonder={wonder} stageIndex={me.wonder_stages_built || 0} stage={stage} onConfirm={onChoose} onCancel={onCancel} />;
    }
    case "trade": {
      const card = decision.action === "build"
        ? (() => { const w = getWonder(me.wonder, me.wonder_side); const st = w.stages[me.wonder_stages_built || 0]; return { name: `${w.name} — Stage ${(me.wonder_stages_built||0)+1}`, color: "brown", is_wonder: true, cost_coins: st?.cost_coins || 0, cost_resources: st?.cost || {}, chain_cost: null }; })()
        : (me.hand || []).find((c) => c.id === decision.cardId);
      if (!card) return null;
      return <TradeDialog card={card} player={me} leftNeighbor={left} rightNeighbor={right} allCardsById={allCardsById} farNeighbors={farNeighbors} onConfirm={onChoose} onCancel={onCancel} />;
    }
    case "armada_badge": {
      const next = (me.armada_board?.[decision.color]?.level || 1) + 1;
      const age = ARMADA_REWARDS.green?.[next]?.island;
      const pool = age ? ((game.armada_islands || {})[String(age)] || []) : [];
      const islands = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
      return <ArmadaMoveDialog player={me} color={decision.color} game={game} allCardsById={allCardsById} islands={islands} pools={decision.pools} leftNeighbor={left} rightNeighbor={right} farNeighbors={farNeighbors} onConfirm={onChoose} onCancel={() => onChoose({ decline: true })} />;
    }
    case "armada_card_move": {
      const next = (me.armada_board?.[decision.color]?.level || 1) + 1;
      const age = ARMADA_REWARDS.green?.[next]?.island;
      const pool = age ? ((game.armada_islands || {})[String(age)] || []) : [];
      const islands = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
      return <ArmadaMoveDialog player={me} color={decision.color} game={game} allCardsById={allCardsById} islands={islands} pools={decision.pools} leftNeighbor={left} rightNeighbor={right} farNeighbors={farNeighbors} onConfirm={onChoose} onCancel={() => onChoose({ decline: true })} />;
    }
    case "armada_free_build":
      return <ArmadaFreeMoveDialog player={me} onConfirm={onChoose} onCancel={() => onChoose({ color: null })} />;
    case "edifice_donate": {
      const ed = edificeList(game).find((x) => x.id === decision.edificeId) || edificeForAge(game, decision.age);
      return <DonateDialog edifice={ed} player={me} coinsAfter={me.coins} onConfirm={onChoose} onCancel={() => onChoose("decline")} />;
    }
    case "unearth":
      return <UnearthDialog discard={game?.discard || []} onConfirm={onChoose} onCancel={() => onChoose(null)} />;
    case "mirror":
      return <MirrorDialog player={me} allCardsById={allCardsById} onConfirm={onChoose} onCancel={() => onChoose(null)} />;
    case "move_ship":
      return <MoveShipChooser player={me} amount={decision.amount} onConfirm={onChoose} onCancel={onCancel} />;
    case "gain_island":
    case "island_pick": {
      const pool = (game?.armada_islands || {})[decision.age] || [];
      return <IslandPickDialog pool={pool} onConfirm={onChoose} onCancel={() => onChoose(null)} />;
    }
    case "bury":
      return <BuryDialog player={me} allCardsById={allCardsById} onConfirm={onChoose} onCancel={() => onChoose(null)} />;
    case "self_discard":
      return <DiscardFromCityDialog player={me} effect={decision} allCardsById={allCardsById} onConfirm={onChoose} onCancel={() => onChoose(null)} />;
    case "rome_leader":
      return <RomeLeaderChoiceDialog player={me} allPlayers={players} gameAge={Number(game.age) || 0} onConfirm={onChoose} onCancel={() => onChoose(null)} />;
    case "ur_edifice":
      return <UrChoiceDialog game={game} onConfirm={onChoose} onCancel={onCancel} />;
    case "edifice_complete": {
      const allPens = decision.edifice?.penaltyDecisions?.[me.id] || [];
      // Find the self_discard penalty (if any) so the discard choice is shown
      // even when other penalties (e.g. lose_coins) come first in the list.
      const pen = allPens.find((p) => p.effect.kind === "self_discard") || allPens[0];
      let eligible = [];
      let discardMode = "card";
      if (pen && pen.effect.kind === "self_discard") {
        discardMode = pen.effect.mode || "card";
        if (discardMode === "trophy") {
          const trophies = me.trophies || [];
          const filtered = (pen.effect.trophyAge != null && pen.effect.trophyAge !== "")
            ? trophies.filter((t) => String(t.age) === String(pen.effect.trophyAge))
            : trophies;
          eligible = filtered.map((t) => ({ id: String(trophies.indexOf(t)), label: `Age ${t.age} trophy (${t.points || 0} VP)` }));
        } else {
          eligible = (me.played_cards || [])
            .filter((c) => (allCardsById[c.id] || c).color === pen.effect.color)
            .map((c) => allCardsById[c.id] || c);
        }
      }
      return <EdificeCompleteDialog edifice={decision.edifice} summary={decision.edifice?.summary?.[me.id]} penaltyEffect={pen ? { ...pen, eligible, discardMode } : null} allCardsById={allCardsById} onConfirm={(c) => onChoose(c)} />;
    }
    default:
      return null;
  }
}