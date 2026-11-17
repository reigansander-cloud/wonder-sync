// Armada expansion logic — self-contained (imports constants only, not rules.js,
// to avoid a circular dependency since rules.js imports this for move_ship).
import { ARMADA_REWARDS, NAVAL_VICTORY_POINTS, NAVAL_DEFEAT_POINTS, getWonder } from "./constants";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ARMADA_TRACKS = ["red", "yellow", "blue", "green"];

// Generate a randomized Armada board for one player. Each track has 7 levels
// (boat starts on level 1). `costs[L]` is the resource/coin cost to move to L.
export function generateArmadaBoard() {
  const board = {};
  for (const t of ARMADA_TRACKS) board[t] = { level: 1, wonder: false, costs: [null, null, null, null, null, null, null, null] };

  // Level 2: 1 wood / 1 stone / 1 clay / 1 ore randomly divided across 4 tracks.
  const raw2 = shuffle(["wood", "stone", "clay", "ore"]);
  ARMADA_TRACKS.forEach((t, i) => { board[t].costs[2] = { [raw2[i]]: 1 }; });

  // Level 3: papyrus / loom / glass across red/yellow/blue; green = 2 coins.
  const mfg3 = shuffle(["papyrus", "loom", "glass"]);
  ["red", "yellow", "blue"].forEach((t, i) => { board[t].costs[3] = { [mfg3[i]]: 1 }; });
  board.green.costs[3] = { coins: 2 };

  // Level 4: 4 raw pairs randomly divided across 4 tracks.
  const pairs4 = [{ wood: 1, clay: 1 }, { stone: 1, ore: 1 }, { clay: 1, stone: 1 }, { ore: 1, wood: 1 }];
  const pp4 = shuffle(pairs4);
  ARMADA_TRACKS.forEach((t, i) => { board[t].costs[4] = pp4[i]; });

  // Level 5: papyrus/loom/glass + 3 of (wood/stone/clay/ore) across red/yellow/blue; green = 3 coins.
  const mfg5 = shuffle(["papyrus", "loom", "glass"]);
  const raw5 = shuffle(["wood", "stone", "clay", "ore"]).slice(0, 3);
  ["red", "yellow", "blue"].forEach((t, i) => { board[t].costs[5] = { [mfg5[i]]: 1, [raw5[i]]: 1 }; });
  board.green.costs[5] = { coins: 3 };

  // Level 6: same 4 raw pairs as level 4, re-shuffled.
  const pp6 = shuffle(pairs4);
  ARMADA_TRACKS.forEach((t, i) => { board[t].costs[6] = pp6[i]; });

  // Level 7: glass+loom / glass+papyrus / papyrus+loom across red/yellow/blue; green = 4 coins.
  const pairs7 = [{ glass: 1, loom: 1 }, { glass: 1, papyrus: 1 }, { papyrus: 1, loom: 1 }];
  const pp7 = shuffle(pairs7);
  ["red", "yellow", "blue"].forEach((t, i) => { board[t].costs[7] = pp7[i]; });
  board.green.costs[7] = { coins: 4 };

  // Wonder badge: one random track lets you move its boat when you build a wonder tier.
  const wonderTrack = ARMADA_TRACKS[Math.floor(Math.random() * 4)];
  board[wonderTrack].wonder = true;
  return board;
}

// Does the player own an effect of the given kind (cards + built wonder stages)?
function armadaHasEffect(player, kind, allCardsById) {
  for (const pc of player.played_cards || []) {
    const full = allCardsById?.[pc.id] || pc;
    for (const e of full.effects || []) if (e.kind === kind) return true;
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of wonder.stages[i]?.effects || []) if (e.kind === kind) return true;
  }
  return false;
}

// Local notif helper (armada.js can't import rules.js — circular dependency).
function pushNotif(ctx, playerId, notif) {
  if (!ctx || !playerId || !notif) return;
  ctx.notifs = ctx.notifs || {};
  (ctx.notifs[playerId] = ctx.notifs[playerId] || []).push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), ...notif });
}

function armadaCull(target, amount, ctx, source, allCardsById) {
  if (!amount) return;
  if (source && source.id !== target.id && armadaHasEffect(target, "coin_loss_immunity", allCardsById)) {
    pushNotif(ctx, target.id, { type: "immunity", amount, fromId: source?.id, fromName: source?.player_name, text: `Protected from ${source?.player_name || "an opponent"}'s coin loss` });
    return;
  }
  const have = target.coins || 0;
  const lost = Math.min(have, amount);
  target.coins = have - lost;
  const shortfall = amount - lost;
  if (shortfall > 0) target.penalties = (target.penalties || 0) + shortfall;
  if (lost > 0 || shortfall > 0) {
    pushNotif(ctx, target.id, { type: "tax", amount: lost, shortfall, fromId: source?.id, fromName: source?.player_name, fromColor: source?.player_color, text: `Lost ${lost} coins to ${source?.player_name || "an opponent"}'s yellow Armada track${shortfall ? ` (+${shortfall} penalty)` : ""}` });
    if (lost > 0) pushNotif(ctx, target.id, { type: "coin_spend", amount: lost, cardName: "Armada tax", text: `Spent ${lost} coins — Armada tax` });
  }
}

// Apply a ship move for `player` on `move.color` (resources already paid via
// trades by the caller; coin costs deducted here). Grants track rewards.
// `islandPool` = { "1": [...], "2": [...], "3": [...] } of available island cards.
export function applyArmadaMove(player, move, allPlayers, allCardsById, islandPool, context = {}) {
  if (!move || !move.color || move.decline) return;
  const board = player.armada_board?.[move.color];
  if (!board) return;
  const next = (board.level || 1) + 1;
  if (next > 7) return;
  // A "free" move (discard-to-move action) skips the resource/coin cost entirely.
  if (!move.free) {
    const cost = board.costs?.[next] || {};
    if (cost.coins) {
      const have = player.coins || 0;
      const lost = Math.min(have, cost.coins);
      player.coins = have - lost;
      const shortfall = cost.coins - lost;
      if (lost > 0) pushNotif(context, player.id, { type: "coin_spend", amount: lost, cardName: "Ship move", text: `Spent ${lost} coins — Ship move` });
      if (shortfall > 0) {
        player.penalties = (player.penalties || 0) + shortfall;
        pushNotif(context, player.id, { type: "penalty", amount: shortfall, text: `Could not pay ${shortfall} coin(s) for ship move — took ${shortfall} penalty token(s)` });
      }
    }
  }
  board.level = next;
  applyTrackRewards(player, move.color, next, allPlayers, allCardsById, islandPool, context, move);
  if (armadaHasEffect(player, "ship_move_coin", allCardsById)) { player.coins = (player.coins || 0) + 1; pushNotif(context, player.id, { type: "coin_gain", amount: 1, cardName: "Ship move bonus", text: "Gained 1 coin — Ship move bonus" }); }
}

function applyIslandEffect(player, e, allPlayers, allCardsById, context) {
  switch (e.kind) {
    case "coins": { const amt = e.amount || 0; player.coins = (player.coins || 0) + amt; if (amt) pushNotif(context, player.id, { type: "coin_gain", amount: amt, cardName: "Island", text: `Gained ${amt} coins — Island` }); break; }
    case "shields": player.shields = (player.shields || 0) + (e.amount || 0); break;
    case "naval_shields": player.naval_shields = (player.naval_shields || 0) + (e.amount || 0); break;
    case "science": player.science_symbols = [...(player.science_symbols || []), e.symbol || "script"]; break;
    case "science_choice": player.science_symbols = [...(player.science_symbols || []), e.most ? "__most__" : e.spy ? "__spy__" : "__choice__"]; break;
    case "naval_victory": {
      const a = e.age || 0;
      player.naval_trophies = [...(player.naval_trophies || []), { age: String(a), points: NAVAL_VICTORY_POINTS[a] || 0 }];
      break;
    }
    default: break; // vp / resource / resource_choice handled by scorePlayer + getProducibleResources
  }
}

// Naval shields are cumulative per-track totals — the reward table encodes the
// total shields a ship grants at a given level (red L5 = 4 shields), not a
// delta. Recompute from the whole board every move so advancing never stacks.
// Also includes card-based, wonder-stage-based, and edifice-reward naval shields
// so they aren't wiped when a track move recomputes the board total.
export function recomputeNavalShields(player, allCardsById) {
  let total = 0;
  // Board-based (Armada tracks)
  for (const color of ARMADA_TRACKS) {
    const lvl = player.armada_board?.[color]?.level || 1;
    total += ARMADA_REWARDS[color]?.[lvl]?.navalShields || 0;
  }
  // Card-based
  for (const pc of player.played_cards || []) {
    const full = allCardsById?.[pc.id] || pc;
    for (const e of full.effects || []) {
      if (e.kind === "naval_shields") total += e.amount || 0;
    }
  }
  // Wonder-stage-based
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of wonder.stages[i]?.effects || []) {
      if (e.kind === "naval_shields") total += e.amount || 0;
    }
  }
  // Edifice reward naval shields (stored for re-computation)
  for (const e of player.edifice_reward_effects || []) {
    if (e.kind === "naval_shields") total += e.amount || 0;
  }
  player.naval_shields = total;
}

function applyTrackRewards(player, color, level, allPlayers, allCardsById, islandPool, context, move) {
  const r = ARMADA_REWARDS[color]?.[level];
  if (!r) return;
  if (r.navalShields || r.navalShields === 0) recomputeNavalShields(player, allCardsById);
  if (r.coins) { player.coins = (player.coins || 0) + r.coins; pushNotif(context, player.id, { type: "coin_gain", amount: r.coins, cardName: "Ship track", text: `Gained ${r.coins} coins — Ship track` }); }
  if (r.trade) player.trade_level = r.trade;
  if (r.cull) {
    for (const other of allPlayers) {
      if (other.id === player.id) continue;
      const amt = Math.max(0, r.cull - (other.trade_level || 0));
      if (amt > 0) armadaCull(other, amt, context, player, allCardsById);
    }
  }
  if (r.island) {
    grantIsland(player, r.island, islandPool, allPlayers, allCardsById, context, move);
  }
}

// Decision-generating effect kinds that require a player choice. Duplicated
// from rules.js (armada.js can't import it — circular dependency).
const ISLAND_DECISION_KINDS = new Set(["move_ship", "gain_island", "bury", "self_discard", "unearth", "mirror"]);
function makeIslandDecision(effect) {
  const e = { ...effect };
  switch (effect.kind) {
    case "move_ship": return { type: "move_ship", amount: effect.amount || 1, color: effect.color || "any", cardId: null, effect: e };
    case "gain_island": return { type: "gain_island", age: String(effect.age || "1"), cardId: null, effect: e };
    case "bury": return { type: "bury", cardId: null, effect: e };
    case "self_discard": return { type: "self_discard", mode: effect.mode || "card", color: effect.color || null, trophyAge: effect.trophyAge != null ? String(effect.trophyAge) : null, cardId: null, effect: e };
    case "unearth": return { type: "unearth", cardId: null, color: null, effect: e };
    case "mirror": return { type: "mirror", cardId: null, effect: e };
    default: return null;
  }
}

// Draw & play an island card of `age` from the pool. If `move.islandId` is set
// (a player's pick), use it; otherwise take a random one from the pool. When
// `context.queueIslandChoices` is set and no island was pre-chosen, queue an
// `island_pick` decision instead of auto-playing (the queue engine resolves it
// after the player picks).
export function grantIsland(player, age, islandPool, allPlayers, allCardsById, context = {}, move = null) {
  const pool = islandPool ? (islandPool[String(age)] || []) : [];
  let chosen = move?.islandId ? pool.find((i) => i.id === move.islandId) : null;
  if (!chosen && pool.length && context?.queueIslandChoices) {
    (context.decisions = context.decisions || []).push({ type: "island_pick", age: String(age), color: null });
    return;
  }
  if (!chosen && pool.length) chosen = pool[Math.floor(Math.random() * pool.length)];
  if (chosen) {
    const idx = pool.indexOf(chosen);
    if (idx >= 0) pool.splice(idx, 1);
    player.played_cards = [...(player.played_cards || []), { ...chosen, is_island: true }];
    for (const e of chosen.effects || []) {
      if (context?.queueDecisions && ISLAND_DECISION_KINDS.has(e.kind)) {
        const d = makeIslandDecision(e);
        if (d) (context.decisions = context.decisions || []).push(d);
      } else {
        applyIslandEffect(player, e, allPlayers, allCardsById, context);
      }
    }
  }
}

// Naval resolution: after military, compare naval shields collectively among
// the ACTIVE (non-diplomatic) players. A player with naval_diplomacy skips only
// the naval conflict; a player with regular diplomacy skips both land and naval.
// Lowest takes a defeat (−age VP); highest takes a victory (age VP); second place
// takes a victory one age behind. Tied first → all get second-place rewards, no
// second place. A player who would get both loss + victory only gets the loss.
export function resolveNaval(allPlayers, age, ctx, allCardsById) {
  const updated = allPlayers.map((p) => ({ ...p, naval_trophies: [...(p.naval_trophies || [])], naval_defeats: [...(p.naval_defeats || [])] }));
  const a = Number(age);
  if (!a) return updated;
  const active = updated.filter((p) => !skipsNaval(p, allCardsById, age));
  if (active.length < 2) return updated;
  const vals = active.map((p) => ({ p, s: p.naval_shields || 0 }));
  const maxV = Math.max(...vals.map((v) => v.s));
  const minV = Math.min(...vals.map((v) => v.s));
  const first = vals.filter((v) => v.s === maxV);
  const lastIds = new Set(vals.filter((v) => v.s === minV).map((v) => v.p.id));

  if (first.length >= 2) {
    const pts = NAVAL_VICTORY_POINTS[a - 1] || 0;
    for (const v of first) if (!lastIds.has(v.p.id)) v.p.naval_trophies.push({ age: String(a - 1), points: pts });
  } else {
    const pts = NAVAL_VICTORY_POINTS[a] || 0;
    if (!lastIds.has(first[0].p.id)) first[0].p.naval_trophies.push({ age: String(a), points: pts });
    const secondVals = vals.filter((v) => v.s < maxV).map((v) => v.s);
    if (secondVals.length) {
      const sv = Math.max(...secondVals);
      const spts = NAVAL_VICTORY_POINTS[a - 1] || 0;
      for (const v of vals) if (v.s === sv && !lastIds.has(v.p.id)) v.p.naval_trophies.push({ age: String(a - 1), points: spts });
    }
  }
  const dpts = NAVAL_DEFEAT_POINTS[a] || 0;
  // The weakest player(s) always take a naval defeat token (−age VP) when there
  // is any difference in naval shields. A full tie (min === max) boards no one.
  if (minV < maxV) {
    for (const v of vals) if (v.s === minV) { v.p.naval_defeats.push({ age: String(a), points: dpts }); pushNotif(ctx, v.p.id, { type: "boarded", age: String(a), text: `Naval defeat in Age ${a}: ${dpts} VP` }); }
  }
  return updated;
}

// Does the player skip the naval conflict for this age? Regular diplomacy (a
// diplomacy card of this age) skips both land and naval; naval_diplomacy (a
// card of this age) skips only naval.
function skipsNaval(player, allCardsById, age) {
  const a = String(age);
  if ((player.diplomacy_ages || []).includes(a) || (player.naval_diplomacy_ages || []).includes(a)) return true;
  return (player.played_cards || []).some((pc) => {
    const c = allCardsById?.[pc.id] || pc;
    if (String(c.age) !== a) return false;
    return (c.effects || []).some((e) => e.kind === "diplomacy" || e.kind === "naval_diplomacy");
  });
}

// Cost of moving to `level` on `color` track, as a pseudo-card for canAfford.
export function armadaMoveCostCard(board, color, level) {
  const cost = board?.[color]?.costs?.[level] || {};
  const cost_resources = {};
  for (const k of Object.keys(cost)) if (k !== "coins") cost_resources[k] = cost[k];
  return { color, is_wonder: false, is_ship: true, cost_coins: cost.coins || 0, cost_resources, chain_cost: null };
}