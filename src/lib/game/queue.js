// Decision-queue resolution engine for 7 Wonders.
//
// New model: each player resolves their chosen card IMMEDIATELY on their own
// client. Self-effects apply at once; follow-up decisions (unearth, armada
// move, edifice donate, mirror, etc.) go into a per-player FIFO decision_queue
// and are resolved one at a time — each may push more decisions. Effects that
// target OTHER players (coins, cull, penalties, trade payments) are collected
// into pending_outgoing and applied by the host at round end. When a player's
// queue is empty they are round_done.

import {
  applyEffect, applyCardEffects, grantCoins, spendCoins, applyCull, applyTrade,
  canAfford, canAffordWonderStage, canFreeCard, canFreeFirstPerColor, isCostFree,
  hasEffect, hasDuplicateName, effectiveCoinCost, leaderCoinCost, stageEffects,
  stageNeedsChoice, recomputeStaticEffects, countMetric, countEffects,
  resolveTargets, matchTrigger, pushNotif, nextAge, farNeighborsOf,
  autoMoveShipChoices, getIslands, resolvedEffectsFor, applyEdificeEffect,
  poolsAfterCommit,
} from "./rules";
import { applyArmadaMove, armadaMoveCostCard, grantIsland, ARMADA_TRACKS } from "./armada";
import { edificeForAge, edificeList, applyDonate, grantDuplicateToken, completeEdifice } from "./edifices";
import { ARMADA_TRACK_COLORS, ARMADA_REWARDS, getWonder } from "./constants";

const emptyRes = () => ({ wood: 0, stone: 0, clay: 0, ore: 0, glass: 0, papyrus: 0, loom: 0 });

// Handle edifice_patronage_age effects on a card/stage — applyEffect no-ops
// this kind, so we scan the effects and grant the duplicate token directly.
function handleEdificePatronageAge(player, effects, game, allPlayers, allCardsById, ctx) {
  for (const e of effects || []) {
    if (e.kind === "edifice_patronage_age") {
      const ed = edificeForAge(game, String(e.age || "1"));
      if (ed) grantDuplicateToken(player, ed, game, ctx, (pl, eff, m) => applyEdificeEffect(pl, eff, allPlayers, allCardsById, ctx, m));
    }
  }
}

function freshCtx(game, player) {
  return {
    age: game?.age, round: game?.round || 0,
    islandPool: game?.armada_islands || {}, leaderDeck: game?.leader_deck ? [...game.leader_deck] : null,
    deferOutgoing: true, queueDecisions: true, queueIslandChoices: true,
    notifs: {}, _leaderDeckRef: game?._leaderDeckRef || null,
  };
}

// Find a player's neighbor by seat offset.
function neighborBySeat(player, allPlayers, offset) {
  const n = allPlayers.length;
  return allPlayers.find((p) => p.seat === (player.seat + offset + n) % n) || null;
}

// ---------- When-played effects (cull / trigger / chain_bonus) ----------
// Self coin gains apply immediately; outgoing culls are collected.
function handleWhenPlayed(player, card, chained, allPlayers, allCardsById, ctx, outgoing) {
  // Detect whether this play granted a trophy (trophy_on_enter effect on the
  // card itself, or on a card copied via mirror). The trophy is already applied
  // by applyCardEffects before this scan, so we infer it from the effects.
  let gainedTrophy = (card.effects || []).some((e) => e.kind === "trophy_on_enter");
  if (!gainedTrophy && player.mirror_choices?.[card.id]) {
    const mirroredId = player.mirror_choices[card.id];
    const mirrored = (player.played_cards || []).find((c) => c.id === mirroredId) || allCardsById?.[mirroredId];
    if (mirrored && (mirrored.effects || []).some((e) => e.kind === "trophy_on_enter")) gainedTrophy = true;
  }
  const ev = { colors: [card.color], builtStage: false, discarded: false, chained: !!chained, gainedTrophy, playedCardId: card.id };
  // "cull" (when-played) on this card → outgoing.
  for (const e of (card.effects || [])) {
    if (e.kind === "cull") {
      let culls = e.culls ?? 0;
      if (e.perMetric) culls = (e.culls || 0) * countMetric(player, e.perMetric, "self", allPlayers, allCardsById);
      if (culls === -1) culls = Number(ctx.age) || 0;
      if (culls > 0) for (const other of allPlayers) if (other.id !== player.id) outgoing.push({ playerId: player.id, playerName: player.player_name, playerColor: player.player_color, seat: player.seat, kind: "cull", targetSeat: other.seat, amount: culls, cardName: card.name });
    }
  }
  // Persistent "trigger" effects on any played card matching this event.
  for (const pc of player.played_cards || []) {
    const full = allCardsById[pc.id] || pc;
    for (const e of (full.effects || [])) {
      if (e.kind === "trigger" && matchTrigger(e, ev)) {
        grantCoins(player, e.coins || 0, allCardsById, { ctx, cardName: full?.name });
        let culls = e.culls ?? 0;
        if (culls === -1) culls = Number(ctx.age) || 0;
        if (culls > 0) for (const other of allPlayers) if (other.id !== player.id) outgoing.push({ playerId: player.id, playerName: player.player_name, playerColor: player.player_color, seat: player.seat, kind: "cull", targetSeat: other.seat, amount: culls, cardName: full?.name });
      }
    }
  }
  // chain_bonus: self coins when chain-played.
  if (chained) {
    for (const pc of player.played_cards || []) {
      const full = allCardsById[pc.id] || pc;
      for (const e of (full.effects || [])) if (e.kind === "chain_bonus") grantCoins(player, e.amount || 0, allCardsById, { ctx, cardName: "Chain bonus" });
    }
  }
}

// Apply a trade plan, deferring neighbor payments into `outgoing`.
function applyTradeDeferred(player, tradePlan, allPlayers, allCardsById, ctx, outgoing) {
  if (!tradePlan || !tradePlan.length) return;
  const tradedSides = new Set();
  for (const t of tradePlan) {
    spendCoins(player, t.cost || 0, ctx, "Trade");
    let neighbor = null;
    if (t.side === "left") { neighbor = neighborBySeat(player, allPlayers, 1); tradedSides.add("left"); }
    else if (t.side === "right") { neighbor = neighborBySeat(player, allPlayers, -1); tradedSides.add("right"); }
    else if (t.side === "far") { neighbor = allPlayers.find((q) => q.seat === t.seat); tradedSides.add("far"); }
    if (neighbor && (t.cost || 0) > 0) {
      outgoing.push({ playerId: player.id, playerName: player.player_name, playerColor: player.player_color, seat: player.seat, kind: "trade_payment", targetSeat: neighbor.seat, amount: t.cost || 0 });
    }
  }
  const bonus = countEffects(player, "trade_bonus", allCardsById);
  if (bonus > 0 && tradedSides.size > 0) grantCoins(player, tradedSides.size * bonus, allCardsById, { ctx, cardName: "Trade bonus" });
}

// Auto-discard the last card when a non-Play-Both player picks from a 2-card
// hand. This eliminates the 1-card age cutoff that was skipping the age-end
// popup and leader-select phase.
function autoDiscardLastCard(player, game, allCardsById) {
  if (game?.age !== "leader" && (player.hand || []).length === 1 && !hasEffect(player, "play_both", allCardsById)) {
    const card = player.hand[0];
    player.hand = [];
    return card;
  }
  return null;
}

// ---------- Commit a played card to the city (self effects + costs) ----------
function commitPlayCard(player, card, action, allPlayers, allCardsById, game, ctx) {
  const outgoing = [];
  const decisions = [];
  ctx.outgoing = outgoing;
  ctx.decisions = decisions;
  const freeChain = card.chain_cost && (player.played_cards || []).some((pc) => {
    const c = allCardsById[pc.id] || pc;
    return (c.chain_symbols || []).includes(card.chain_cost);
  });
  const costFree = isCostFree(player, card, allCardsById);
  const freeColor = action === "play_free_color";
  const freeCard = action === "play_free";
  const isFree = freeChain || costFree || freeCard || freeColor;

  // Apply self effects (outgoing deferred, decisions queued). Mirror is
  // special: resolvedEffectsFor strips the mirror effect before applyEffect
  // sees it, so we detect it here and queue a mirror decision manually, applying
  // only the card's own non-mirror effects now. The copied effects apply when the
  // mirror decision resolves.
  const hasMirror = (card.effects || []).some((e) => e.kind === "mirror");
  const mirrorChosen = player.mirror_choices?.[card.id];
  if (hasMirror && !mirrorChosen) {
    for (const e of (card.effects || [])) {
      if (e.kind === "mirror") { decisions.push({ type: "mirror", cardId: card.id, effect: e }); continue; }
      try { applyEffect(player, e, card, allPlayers, allCardsById, ctx); } catch (err) { /* ignore */ }
    }
  } else {
    try { applyCardEffects(player, card, allPlayers, allCardsById, ctx); } catch (e) { console.error("commitPlayCard effects", e); }
  }
  handleEdificePatronageAge(player, card.effects, game, allPlayers, allCardsById, ctx);
  player.played_cards = [...(player.played_cards || []), card];
  player.hand = (player.hand || []).filter((c) => c.id !== card.id);

  // Spend coins / trade. Leaders handle their own coin cost separately
  // (via leaderCoinCost in the play_leader action) which applies Rome's
  // wonder passive discount — so skip the generic deduction for leaders.
  if (!isFree && action !== "play_leader") {
    const trades = player.chosen_trades || [];
    if (trades.length) applyTradeDeferred(player, trades, allPlayers, allCardsById, ctx, outgoing);
    spendCoins(player, effectiveCoinCost(card), ctx, card.name);
  }
  // Free-card markers.
  if (freeCard) player.free_card_used = { ...(player.free_card_used || {}), [game.age]: true };
  if (freeColor) player.free_colors_used = { ...(player.free_colors_used || {}), [`${game.age}:${card.color}`]: true };

  handleWhenPlayed(player, card, freeChain, allPlayers, allCardsById, ctx, outgoing);
  try { recomputeStaticEffects(player, allCardsById); } catch (e) { console.error("recompute", e); }

  const autoDiscardedCard = autoDiscardLastCard(player, game, allCardsById);

  // Armada: playing a colored card may allow a paid ship move on the matching
  // track. Queue a decision so the player can move (with trade) or decline.
  // Pools reflect resources remaining after the card's own cost this turn.
  const armadaOn = !!(game?.armada_expansion || (game?.packs || []).some((p) => String(p).toLowerCase() === "armada"));
  if (armadaOn && ARMADA_TRACK_COLORS.includes(card.color)) {
    const trackLevel = player.armada_board?.[card.color]?.level || 1;
    if (trackLevel < 7) {
      const left = neighborBySeat(player, allPlayers, 1);
      const right = neighborBySeat(player, allPlayers, -1);
      const far = farNeighborsOf(player, allPlayers);
      const trades = isFree ? [] : (player.chosen_trades || []);
      const pools = poolsAfterCommit(player, card, action, trades, game, allCardsById, left, right, far);
      decisions.push({ type: "armada_card_move", color: card.color, pools });
    }
  }

  return { decisions, outgoing, autoDiscardedCard };
}

// ---------- Commit a wonder stage build ----------
function commitBuild(player, cardId, allPlayers, allCardsById, game, ctx) {
  const outgoing = [];
  const decisions = [];
  ctx.outgoing = outgoing;
  ctx.decisions = decisions;
  const wonder = getWonder(player.wonder, player.wonder_side);
  const stageIdx = player.wonder_stages_built || 0;
  const stage = wonder.stages[stageIdx];
  if (!stage) return { decisions, outgoing };
  const chosenEffects = stageEffects(stage, player.wonder_choice);
  const pseudoCard = { name: `${wonder.name} — Stage ${stageIdx + 1}`, color: "brown", is_wonder: true, cost_coins: stage.cost_coins || 0, cost_resources: stage.cost || {}, chain_cost: null };
  const costFree = isCostFree(player, pseudoCard, allCardsById);

  // Apply stage self effects (outgoing deferred, decisions queued).
  for (const e of chosenEffects) {
    try { applyEffect(player, e, pseudoCard, allPlayers, allCardsById, ctx); } catch (err) { console.error("build effect", err); }
  }
  handleEdificePatronageAge(player, chosenEffects, game, allPlayers, allCardsById, ctx);
  // Spend resources/coins + trade.
  if (!costFree) {
    const trades = player.chosen_trades || [];
    if (trades.length) applyTradeDeferred(player, trades, allPlayers, allCardsById, ctx, outgoing);
    spendCoins(player, Math.max(0, stage.cost_coins || 0), ctx, `${wonder.name} — Stage ${stageIdx + 1}`);
  }
  // Calculate remaining resource pools for the badge ship move BEFORE
  // incrementing wonder_stages_built (poolsAfterCommit uses it to find the
  // stage cost). Resources spent on the wonder tier are subtracted so they
  // can't be reused for the badge move this turn.
  const armadaOn = !!(game?.armada_expansion || (game?.packs || []).some((p) => String(p).toLowerCase() === "armada"));
  let badgePools = null;
  if (armadaOn && !costFree) {
    const trades = player.chosen_trades || [];
    const left = neighborBySeat(player, allPlayers, 1);
    const right = neighborBySeat(player, allPlayers, -1);
    const far = farNeighborsOf(player, allPlayers);
    badgePools = poolsAfterCommit(player, null, "build", trades, game, allCardsById, left, right, far);
  }
  // Record the chosen option.
  player.wonder_choices = [...(player.wonder_choices || [])];
  while (player.wonder_choices.length <= stageIdx) player.wonder_choices.push(0);
  if (player.wonder_choice != null) player.wonder_choices[stageIdx] = Number(player.wonder_choice);
  player.wonder_stages_built = stageIdx + 1;
  player.stages_built_this_age = (player.stages_built_this_age || 0) + 1;
  // Remove the sacrificed hand card (from hand or leaders_hand during leader_select).
  player.hand = (player.hand || []).filter((c) => c.id !== cardId);
  player.leaders_hand = (player.leaders_hand || []).filter((c) => c.id !== cardId);

  // Post-build decisions (in order): badge ship move, free ship, edifice donate,
  // then effect decisions (unearth/rome/ur) already in `decisions` from applyEffect.
  const pre = [];
  if (armadaOn) {
    const badgeColor = ARMADA_TRACK_COLORS.find((c) => player.armada_board?.[c]?.wonder && (player.armada_board?.[c]?.level || 1) < 7);
    if (badgeColor) pre.push({ type: "armada_badge", color: badgeColor, pools: badgePools });
    if (hasEffect(player, "free_ship_on_build", allCardsById)) {
      const avail = ARMADA_TRACK_COLORS.filter((c) => (player.armada_board?.[c]?.level || 1) < 7);
      if (avail.length) pre.push({ type: "armada_free_build" });
    }
  }
  if (game?.edifice_expansion && (player.stages_built_this_age || 0) === 1) {
    const donateAge = game.phase === "leader_select" ? String(nextAge(game.age)) : (game.age === "leader" ? "1" : String(game.age));
    const ed = edificeForAge(game, donateAge);
    const st = game.edifice_state?.[ed?.id];
    if (ed && st && !st.completed) pre.push({ type: "edifice_donate", edificeId: ed.id, age: donateAge });
  }
  try { recomputeStaticEffects(player, allCardsById); } catch (e) { console.error("recompute", e); }
  const autoDiscardedCard = autoDiscardLastCard(player, game, allCardsById);
  return { decisions: [...pre, ...decisions], outgoing, autoDiscardedCard };
}

// ---------- Begin a player's chosen action ----------
// Mutates `player` (self effects, costs, card moved). Returns:
//   { decisions: [...], outgoing: [...], discardedCard?: card, notifs: {...} }
// `discardedCard` is set for discard actions so the caller can add it to game.discard.
export function beginAction(player, cardId, action, game, allPlayers, allCardsById) {
  const ctx = freshCtx(game, player);
  const res = _beginActionImpl(player, cardId, action, game, allPlayers, allCardsById, ctx);
  if (res.notifs === undefined) res.notifs = ctx.notifs || {};
  return res;
}

function _beginActionImpl(player, cardId, action, game, allPlayers, allCardsById, ctx) {
  const hand = player.hand || [];
  const leaders = player.leaders_hand || [];

  if (action === "pick") {
    player.chosen_card_id = cardId;
    player.chosen_action = "pick";
    return { decisions: [], outgoing: [] };
  }

  if (action === "discard") {
    const card = hand.find((c) => c.id === cardId) || leaders.find((c) => c.id === cardId);
    if (!card) return { decisions: [], outgoing: [] };
    grantCoins(player, 3, allCardsById, { ctx, cardName: "Discard" });
    player.hand = (player.hand || []).filter((c) => c.id !== cardId);
    player.leaders_hand = (player.leaders_hand || []).filter((c) => c.id !== cardId);
    player.chosen_card_id = cardId;
    player.chosen_action = "discard";
    const autoDiscardedCard = autoDiscardLastCard(player, game, allCardsById);
    return { decisions: [], outgoing: [], discardedCard: card, autoDiscardedCard };
  }

  if (action === "discard_armada") {
    const card = hand.find((c) => c.id === cardId) || leaders.find((c) => c.id === cardId);
    if (!card) return { decisions: [], outgoing: [] };
    player.hand = hand.filter((c) => c.id !== cardId);
    player.leaders_hand = (player.leaders_hand || []).filter((c) => c.id !== cardId);
    player.chosen_card_id = cardId;
    player.chosen_action = "discard_armada";
    const autoDiscardedCard = autoDiscardLastCard(player, game, allCardsById);
    const avail = ARMADA_TRACK_COLORS.filter((c) => (player.armada_board?.[c]?.level || 1) < 7);
    if (avail.length === 0) return { decisions: [], outgoing: [], discardedCard: card, autoDiscardedCard };
    if (avail.length === 1) {
      try { applyArmadaMove(player, { color: avail[0], free: true }, allPlayers, allCardsById, game?.armada_islands || {}, ctx); } catch (e) { /* ignore */ }
      return { decisions: ctx.decisions || [], outgoing: [], discardedCard: card, autoDiscardedCard };
    }
    return { decisions: [{ type: "move_ship", amount: 1 }], outgoing: [], discardedCard: card, autoDiscardedCard };
  }

  if (action === "play_leader") {
    const card = leaders.find((c) => c.id === cardId);
    if (!card) return { decisions: [], outgoing: [] };
    if (hasDuplicateName(player, card, allCardsById)) return { decisions: [], outgoing: [] };
    const freeChain = card.chain_cost && (player.played_cards || []).some((pc) => (allCardsById[pc.id] || pc).chain_symbols?.includes(card.chain_cost));
    const costFree = isCostFree(player, card, allCardsById);
    const cost = leaderCoinCost(player, card, allPlayers, Number(nextAge(game.age)));
    if (!freeChain && !costFree && cost > (player.coins || 0)) return { decisions: [], outgoing: [] };
    player.chosen_card_id = cardId;
    player.chosen_action = "play_leader";
    const res = commitPlayCard(player, card, "play_leader", allPlayers, allCardsById, game, ctx);
    // Leaders come from leaders_hand, not hand — commitPlayCard removed from hand; fix.
    player.leaders_hand = (player.leaders_hand || []).filter((c) => c.id !== cardId);
    if (!freeChain && !costFree) spendCoins(player, cost, ctx, card.name);
    return res;
  }

  if (action === "build") {
    const card = hand.find((c) => c.id === cardId) || leaders.find((c) => c.id === cardId) || hand[0];
    if (!card) return { decisions: [], outgoing: [] };
    player.chosen_card_id = cardId;
    player.chosen_action = "build";
    player.chosen_trades = [];
    const wonder = getWonder(player.wonder, player.wonder_side);
    const stage = wonder.stages[player.wonder_stages_built || 0];
    if (!stage) return { decisions: [], outgoing: [] };
    if (stageNeedsChoice(stage) && player.wonder_choice == null) {
      return { decisions: [{ type: "wonder_tier", cardId }], outgoing: [] };
    }
    return continueBuild(player, cardId, allPlayers, allCardsById, game, ctx);
  }

  // action === "play" / "play_free" / "play_free_color"
  const card = hand.find((c) => c.id === cardId);
  if (!card) return { decisions: [], outgoing: [] };
  if (hasDuplicateName(player, card, allCardsById)) return { decisions: [], outgoing: [] };
  player.chosen_card_id = cardId;
  player.chosen_action = action;
  player.chosen_trades = [];

  const freeChain = card.chain_cost && (player.played_cards || []).some((pc) => (allCardsById[pc.id] || pc).chain_symbols?.includes(card.chain_cost));
  const costFree = isCostFree(player, card, allCardsById);
  const freeAvail = canFreeCard(player, card, game, allCardsById);
  const freeColorAvail = canFreeFirstPerColor(player, card, game, allCardsById);
  const isFree = freeChain || costFree || (action === "play_free" && freeAvail) || (action === "play_free_color" && freeColorAvail);

  if (isFree) {
    return commitPlayCard(player, card, action, allPlayers, allCardsById, game, ctx);
  }
  // Need to afford (possibly with trade).
  const left = neighborBySeat(player, allPlayers, 1);
  const right = neighborBySeat(player, allPlayers, -1);
  const far = farNeighborsOf(player, allPlayers);
  const aff = canAfford(player, card, left, right, allCardsById, far);
  if (!aff.ok) {
    // Unaffordable — shouldn't happen (UI gates), but fall back to discard.
    return _beginActionImpl(player, cardId, "discard", game, allPlayers, allCardsById, ctx);
  }
  if (aff.tradePairs && aff.tradePairs.length > 0) {
    return { decisions: [{ type: "trade", cardId, action: "play" }], outgoing: [] };
  }
  return commitPlayCard(player, card, action, allPlayers, allCardsById, game, ctx);
}

// Continue a build after the wonder-tier choice / trade is resolved.
export function continueBuild(player, cardId, allPlayers, allCardsById, game, ctx) {
  const wonder = getWonder(player.wonder, player.wonder_side);
  const stage = wonder.stages[player.wonder_stages_built || 0];
  if (!stage) return { decisions: [], outgoing: [] };
  const pseudoCard = { name: `${wonder.name} — Stage ${(player.wonder_stages_built || 0) + 1}`, color: "brown", is_wonder: true, cost_coins: stage.cost_coins || 0, cost_resources: stage.cost || {}, chain_cost: null };
  const costFree = isCostFree(player, pseudoCard, allCardsById);
  if (!costFree) {
    const left = neighborBySeat(player, allPlayers, 1);
    const right = neighborBySeat(player, allPlayers, -1);
    const far = farNeighborsOf(player, allPlayers);
    const aff = canAfford(player, pseudoCard, left, right, allCardsById, far);
    if (aff.ok && aff.tradePairs && aff.tradePairs.length > 0 && !(player.chosen_trades || []).length) {
      return { decisions: [{ type: "trade", cardId, action: "build" }], outgoing: [] };
    }
  }
  return commitBuild(player, cardId, allPlayers, allCardsById, game, ctx || freshCtx(game, player));
}

// ---------- Resolve a single queued decision ----------
// `choice` is the player's answer (shape depends on decision.type).
// Mutates `player`. Returns { decisions: [...new...], outgoing: [...], notifs: {...} }.
export function resolveDecision(player, decision, choice, game, allPlayers, allCardsById) {
  const ctx = freshCtx(game, player);
  const res = _resolveDecisionImpl(player, decision, choice, game, allPlayers, allCardsById, ctx);
  if (res.notifs === undefined) res.notifs = ctx.notifs || {};
  return res;
}

function _resolveDecisionImpl(player, decision, choice, game, allPlayers, allCardsById, ctx) {
  const outgoing = [];
  ctx.outgoing = outgoing;
  const newDecisions = [];
  ctx.decisions = newDecisions;

  switch (decision.type) {
    case "wonder_tier": {
      player.wonder_choice = choice != null ? Number(choice) : 0;
      return continueBuild(player, decision.cardId, allPlayers, allCardsById, game, ctx);
    }
    case "trade": {
      player.chosen_trades = choice || [];
      if (decision.action === "build") return continueBuild(player, decision.cardId, allPlayers, allCardsById, game, ctx);
      const card = (player.hand || []).find((c) => c.id === decision.cardId);
      if (!card) return { decisions: [], outgoing: [] };
      return commitPlayCard(player, card, "play", allPlayers, allCardsById, game, ctx);
    }
    case "armada_badge": {
      const mv = choice || { decline: true };
      if (!mv.decline) {
        if (mv.trades && mv.trades.length) applyTradeDeferred(player, mv.trades, allPlayers, allCardsById, ctx, outgoing);
        try { applyArmadaMove(player, { ...mv, free: false }, allPlayers, allCardsById, game?.armada_islands || {}, ctx); } catch (e) { /* ignore */ }
      }
      return { decisions: ctx.decisions || [], outgoing };
    }
    case "armada_card_move": {
      const mv = choice || { decline: true };
      if (!mv.decline) {
        // Apply resource trades first (deducts buyer coins, defers neighbor payments).
        if (mv.trades && mv.trades.length) applyTradeDeferred(player, mv.trades, allPlayers, allCardsById, ctx, outgoing);
        // Then apply the move (deducts the move's own coin cost, grants track rewards).
        try { applyArmadaMove(player, { ...mv, free: false }, allPlayers, allCardsById, game?.armada_islands || {}, ctx); } catch (e) { /* ignore */ }
      }
      return { decisions: ctx.decisions || [], outgoing };
    }
    case "armada_free_build": {
      const color = choice?.color;
      if (color) {
        try { applyArmadaMove(player, { color, free: true }, allPlayers, allCardsById, game?.armada_islands || {}, ctx); } catch (e) { /* ignore */ }
      }
      return { decisions: ctx.decisions || [], outgoing };
    }
    case "edifice_donate": {
      if (choice === "donate") {
        const ed = edificeList(game).find((x) => x.id === decision.edificeId) || edificeForAge(game, decision.age);
        const st = game.edifice_state?.[ed?.id];
        if (ed && st) applyDonate(player, ed, st, ctx);
      }
      player.edifice_donate = choice === "donate" ? "donate" : null;
      return { decisions: [], outgoing };
    }
    case "unearth": {
      const discardPile = game?.discard || [];
      const dCard = discardPile.find((c) => c.id === choice);
      if (dCard) {
        // Remove from discard (caller updates game.discard).
        player._unearthRemoveId = choice;
        try { applyCardEffects(player, dCard, allPlayers, allCardsById, ctx); } catch (e) { /* ignore */ }
        handleEdificePatronageAge(player, dCard.effects, game, allPlayers, allCardsById, ctx);
        player.played_cards = [...(player.played_cards || []), dCard];
        pushNotif(ctx, player.id, { type: "unearth", cardName: dCard.name, text: `Unearthed ${dCard.name} from the discard pile` });
        handleWhenPlayed(player, dCard, false, allPlayers, allCardsById, ctx, outgoing);
        try { recomputeStaticEffects(player, allCardsById); } catch (e) { /* ignore */ }
      }
      return { decisions: newDecisions, outgoing };
    }
    case "mirror": {
      if (choice) player.mirror_choices = { ...(player.mirror_choices || {}), [decision.cardId]: choice };
      // Apply only the copied effects (own non-mirror effects were already applied
      // when the card was committed). resolvedEffectsFor now expands the mirror
      // with the chosen card; subtract the own effects to get just the copies.
      const card = (player.played_cards || []).find((c) => c.id === decision.cardId);
      if (card) {
        const ownNonMirror = (card.effects || []).filter((e) => e.kind !== "mirror");
        const expanded = resolvedEffectsFor(player, card, allCardsById);
        const ownSet = new Set(ownNonMirror);
        const copied = expanded.filter((e) => e.kind !== "mirror" && !ownSet.has(e));
        for (const e of copied) {
          try { applyEffect(player, e, card, allPlayers, allCardsById, ctx); } catch (err) { /* ignore */ }
        }
        handleEdificePatronageAge(player, copied, game, allPlayers, allCardsById, ctx);
        handleWhenPlayed(player, card, false, allPlayers, allCardsById, ctx, outgoing);
        try { recomputeStaticEffects(player, allCardsById); } catch (e) { /* ignore */ }
      }
      return { decisions: newDecisions, outgoing };
    }
    case "move_ship": {
      const choices = choice || [];
      player.move_ship_choices = choices;
      const amount = decision.amount || 1;
      const islandPool = game?.armada_islands || {};
      // Apply a ship move for each chosen color; auto-pick remaining from lowest-level tracks.
      const avail = ARMADA_TRACK_COLORS.filter((c) => (player.armada_board?.[c]?.level || 1) < 7);
      const picked = choices.filter((c) => avail.includes(c));
      for (let i = picked.length; i < amount && avail.length > 0; i++) {
        const remaining = avail.filter((c) => !picked.includes(c));
        if (!remaining.length) break;
        picked.push(remaining.sort((a, b) => (player.armada_board?.[a]?.level || 1) - (player.armada_board?.[b]?.level || 1))[0]);
      }
      for (const color of picked) {
        try { applyArmadaMove(player, { color, free: true }, allPlayers, allCardsById, islandPool, ctx); } catch (e) { /* ignore */ }
      }
      return { decisions: newDecisions, outgoing };
    }
    case "gain_island": {
      const pool = (game?.armada_islands || {})[decision.age] || [];
      const island = pool.find((i) => i.id === choice);
      if (island) {
        player._islandPoolMutated = decision.age;
        player._islandPickedId = choice;
        player.played_cards = [...(player.played_cards || []), { ...island, is_island: true }];
        for (const e of (island.effects || [])) {
          try { applyEffect(player, e, island, allPlayers, allCardsById, ctx); } catch (err) { /* ignore */ }
        }
        handleEdificePatronageAge(player, island.effects, game, allPlayers, allCardsById, ctx);
        handleWhenPlayed(player, island, false, allPlayers, allCardsById, ctx, outgoing);
        try { recomputeStaticEffects(player, allCardsById); } catch (e) { /* ignore */ }
      }
      return { decisions: newDecisions, outgoing };
    }
    case "island_pick": {
      const pool = (game?.armada_islands || {})[decision.age] || [];
      const island = pool.find((i) => i.id === choice);
      if (island) {
        player._islandPoolMutated = decision.age;
        player._islandPickedId = choice;
        player.played_cards = [...(player.played_cards || []), { ...island, is_island: true }];
        for (const e of (island.effects || [])) {
          try { applyEffect(player, e, island, allPlayers, allCardsById, ctx); } catch (err) { /* ignore */ }
        }
        handleEdificePatronageAge(player, island.effects, game, allPlayers, allCardsById, ctx);
        handleWhenPlayed(player, island, false, allPlayers, allCardsById, ctx, outgoing);
        try { recomputeStaticEffects(player, allCardsById); } catch (e) { /* ignore */ }
      }
      return { decisions: newDecisions, outgoing };
    }
    case "bury": {
      player.bury_leader_id = choice || null;
      if (decision.effect) {
        const card = (player.played_cards || []).find((c) => c.id === decision.cardId);
        // Apply with queueing disabled so the bury effect actually executes
        // (removes the leader from the city + grants VP) instead of being
        // re-queued as a decision. recomputeStaticEffects then strips the
        // buried leader's ongoing shields/science/chain contributions.
        const applyCtx = { ...ctx, queueDecisions: false };
        try { applyEffect(player, decision.effect, card, allPlayers, allCardsById, applyCtx); } catch (e) { /* ignore */ }
      }
      try { recomputeStaticEffects(player, allCardsById); } catch (e) { /* ignore */ }
      return { decisions: [], outgoing };
    }
    case "self_discard": {
      player.wonder_discard_choice = choice || null;
      if (decision.effect) {
        const card = (player.played_cards || []).find((c) => c.id === decision.cardId);
        try { applyEffect(player, decision.effect, card, allPlayers, allCardsById, ctx); } catch (e) { /* ignore */ }
      }
      try { recomputeStaticEffects(player, allCardsById); } catch (e) { /* ignore */ }
      return { decisions: [], outgoing };
    }
    case "rome_leader": {
      player.rome_leader_choice = choice || null;
      if (choice) {
        const leader = (player.leaders_hand || []).find((c) => c.id === choice);
        if (leader) {
          // Rome Night tiers 2-3: leaders played via rome_play_leader get a
          // 2-coin discount on top of any passive reduction.
          const cost = Math.max(0, leaderCoinCost(player, leader, allPlayers, Number(ctx.age) || 0) - 2);
          if (cost > (player.coins || 0)) {
            player.rome_leader_choice = null;
          } else {
            try { applyCardEffects(player, leader, allPlayers, allCardsById, ctx); } catch (e) { /* ignore */ }
            handleEdificePatronageAge(player, leader.effects, game, allPlayers, allCardsById, ctx);
            player.played_cards = [...(player.played_cards || []), leader];
            player.leaders_hand = (player.leaders_hand || []).filter((c) => c.id !== choice);
            if (cost > 0) spendCoins(player, cost, ctx, leader.name);
            handleWhenPlayed(player, leader, false, allPlayers, allCardsById, ctx, outgoing);
            try { recomputeStaticEffects(player, allCardsById); } catch (e) { /* ignore */ }
          }
        }
      }
      return { decisions: newDecisions, outgoing };
    }
    case "ur_edifice": {
      player.ur_edifice_choice = choice || null;
      const ed = edificeList(game).find((x) => String(x.age) === String(choice));
      if (ed) grantDuplicateToken(player, ed, game, ctx, (pl, eff, m) => applyEdificeEffect(pl, eff, allPlayers, allCardsById, ctx, m));
      return { decisions: [], outgoing };
    }
    case "edifice_patronage_age": {
      const ed = edificeList(game).find((x) => String(x.age) === String(decision.age)) || edificeForAge(game, decision.age);
      if (ed) grantDuplicateToken(player, ed, game, ctx, (pl, eff, m) => applyEdificeEffect(pl, eff, allPlayers, allCardsById, ctx, m));
      return { decisions: newDecisions, outgoing };
    }
    case "edifice_complete": {
      // The player acknowledged the edifice popup. Apply ALL penalty decisions
      // (e.g. lose_coins + self_discard), not just the first. For self_discard,
      // `choice` is the discard target (card id / trophy index); for others the
      // choice is ignored. Even with no choice (no eligible cards/trophies),
      // apply the self_discard effect so its fallback can take a penalty token.
      const allPens = decision.edifice?.penaltyDecisions?.[player.id] || [];
      for (const pen of allPens) {
        if (pen.effect.kind === "self_discard") player.wonder_discard_choice = choice || null;
        try { applyEffect(player, pen.effect, null, allPlayers, allCardsById, { age: pen.age }); } catch (e) { /* ignore */ }
      }
      try { recomputeStaticEffects(player, allCardsById); } catch (e) { /* ignore */ }
      player.edifice_ack = true;
      return { decisions: [], outgoing };
    }
    default:
      return { decisions: [], outgoing };
  }
}

// ---------- Apply deferred outgoing effects (round end) ----------
export function applyOutgoing(players, outgoingList, allCardsById, ctx) {
  for (const o of outgoingList) {
    const source = { id: o.playerId, player_name: o.playerName, player_color: o.playerColor, seat: o.seat };
    const eff = o.effect;
    if (o.kind === "cull") {
      const target = players.find((p) => p.seat === o.targetSeat);
      if (target) applyCull(target, o.amount, ctx, source, allCardsById);
      continue;
    }
    if (o.kind === "trade_payment") {
      const target = players.find((p) => p.seat === o.targetSeat);
      if (target && o.amount > 0) {
        grantCoins(target, o.amount, allCardsById, { trade: true, ctx, fromName: o.playerName });
        pushNotif(ctx, target.id, { type: "trade", amount: o.amount, fromId: o.playerId, fromName: o.playerName, fromColor: o.playerColor, text: `Received ${o.amount} coins from ${o.playerName} in trade` });
      }
      continue;
    }
    // effect-based outgoing (coins / neighbors_penalty / neighbors_coins / pirates)
    switch (eff.kind) {
      case "coins": {
        const recips = eff.target === "all" ? players.filter((p) => p.id !== o.playerId) : resolveTargets(source, eff.target, players);
        for (const r of recips) grantCoins(r, eff.amount || 0, allCardsById, { ctx, cardName: o.cardName, fromName: o.playerName });
        break;
      }
      case "neighbors_penalty": {
        const n = players.length;
        for (const off of [1, -1]) {
          const t = players.find((p) => p.seat === (source.seat + off + n) % n);
          if (t) { t.penalties = (t.penalties || 0) + 1; pushNotif(ctx, t.id, { type: "penalty", amount: 1, fromId: o.playerId, fromName: o.playerName, fromColor: o.playerColor, cardName: o.cardName, text: `Penalty from ${o.playerName}: +1 penalty` }); }
        }
        break;
      }
      case "neighbors_coins": {
        const n = players.length;
        const targets = eff.target === "all" ? players.filter((p) => p.id !== o.playerId) : [players.find((p) => p.seat === (source.seat + 1) % n), players.find((p) => p.seat === (source.seat - 1 + n) % n)].filter(Boolean);
        for (const t of targets) grantCoins(t, eff.amount || 0, allCardsById, { ctx, cardName: o.cardName, fromName: o.playerName });
        break;
      }
      case "pirates": {
        for (const other of players) {
          if (other.id === o.playerId) continue;
          const amt = other.trade_level || 0;
          if (amt > 0) applyCull(other, amt, ctx, source, allCardsById);
        }
        break;
      }
      default: break;
    }
  }
}

// Merge notifs from a ctx.notifs result into the player's notifications list.
export function mergeNotifs(player, notifs) {
  if (!notifs || !player) return;
  const list = notifs[player.id];
  if (list && list.length) {
    (player.notifications = player.notifications || []).push(...list);
  }
}

// ---------- AI: make all decisions in a player's queue ----------
// Returns the resolved player (mutated) with an empty queue.
export function aiResolveQueue(player, game, allPlayers, allCardsById) {
  const autoDiscards = [];
  let safety = 0;
  while ((player.decision_queue || []).length > 0 && safety++ < 50) {
    const decision = player.decision_queue[0];
    const choice = aiPickDecision(player, decision, game, allPlayers, allCardsById);
    const res = resolveDecision(player, decision, choice, game, allPlayers, allCardsById);
    // Drop the resolved head, prepend any new decisions.
    player.decision_queue = [...(player.decision_queue || []).slice(1), ...(res.decisions || [])];
    player.pending_outgoing = [...(player.pending_outgoing || []), ...(res.outgoing || [])];
    mergeNotifs(player, res.notifs);
    if (res.autoDiscardedCard) autoDiscards.push(res.autoDiscardedCard);
  }
  player.notifications = (player.notifications || []).slice(-50);
  player.round_done = true;
  player._autoDiscards = autoDiscards;
  return player;
}

function aiPickDecision(player, decision, game, allPlayers, allCardsById) {
  const pick = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
  switch (decision.type) {
    case "wonder_tier": {
      const wonder = getWonder(player.wonder, player.wonder_side);
      const stage = wonder.stages[player.wonder_stages_built || 0];
      if (Array.isArray(stage?.choices) && stage.choices.length > 1) return Math.floor(Math.random() * stage.choices.length);
      return 0;
    }
    case "trade": {
      const left = neighborBySeat(player, allPlayers, 1);
      const right = neighborBySeat(player, allPlayers, -1);
      const far = farNeighborsOf(player, allPlayers);
      const card = decision.action === "build"
        ? { is_wonder: true, cost_coins: getWonder(player.wonder, player.wonder_side).stages[player.wonder_stages_built || 0]?.cost_coins || 0, cost_resources: getWonder(player.wonder, player.wonder_side).stages[player.wonder_stages_built || 0]?.cost || {} }
        : (player.hand || []).find((c) => c.id === decision.cardId);
      if (!card) return [];
      const aff = canAfford(player, card, left, right, allCardsById, far);
      return aff.ok ? aff.tradePairs : [];
    }
    case "armada_badge": {
      const board = player.armada_board?.[decision.color];
      if (!board || (board.level || 1) >= 7) return { decline: true };
      const next = (board.level || 1) + 1;
      const left = neighborBySeat(player, allPlayers, 1);
      const right = neighborBySeat(player, allPlayers, -1);
      const far = farNeighborsOf(player, allPlayers);
      const aff = canAfford(player, armadaMoveCostCard(board, decision.color, next), left, right, allCardsById, far, null, decision.pools);
      if (!aff.ok) return { decline: true };
      const tradeCost = aff.tradePairs.reduce((s, t) => s + (t.cost || 0), 0);
      if (tradeCost > 5) return { decline: true };
      return { color: decision.color, trades: aff.tradePairs, islandId: null };
    }
    case "armada_free_build": {
      const avail = ARMADA_TRACK_COLORS.filter((c) => (player.armada_board?.[c]?.level || 1) < 7);
      if (!avail.length) return { decline: true };
      const color = avail.sort((a, b) => (player.armada_board?.[a]?.level || 1) - (player.armada_board?.[b]?.level || 1))[0];
      return { color, free: true };
    }
    case "armada_card_move": {
      const board = player.armada_board?.[decision.color];
      if (!board || (board.level || 1) >= 7) return { decline: true };
      const next = (board.level || 1) + 1;
      const left = neighborBySeat(player, allPlayers, 1);
      const right = neighborBySeat(player, allPlayers, -1);
      const far = farNeighborsOf(player, allPlayers);
      const aff = canAfford(player, armadaMoveCostCard(board, decision.color, next), left, right, allCardsById, far, null, decision.pools);
      if (!aff.ok) return { decline: true };
      const tradeCost = aff.tradePairs.reduce((s, t) => s + (t.cost || 0), 0);
      if (tradeCost > 5) return { decline: true };
      return { color: decision.color, trades: aff.tradePairs, islandId: null };
    }
    case "edifice_donate": {
      const ed = edificeList(game).find((x) => x.id === decision.edificeId) || edificeForAge(game, decision.age);
      if (ed && (player.coins || 0) >= (ed.cost || 0)) return "donate";
      return "decline";
    }
    case "unearth": {
      const eligible = (game?.discard || []).filter((c) => c.color !== "leader" && c.age !== "leader");
      return pick(eligible)?.id || null;
    }
    case "mirror": {
      const city = (player.played_cards || []).filter((c) => c.id !== decision.cardId);
      return pick(city)?.id || null;
    }
    case "move_ship": {
      const avail = ARMADA_TRACK_COLORS.filter((c) => (player.armada_board?.[c]?.level || 1) < 7);
      return avail.sort((a, b) => (player.armada_board?.[a]?.level || 1) - (player.armada_board?.[b]?.level || 1)).slice(0, decision.amount || 1);
    }
    case "gain_island":
    case "island_pick": {
      const pool = (game?.armada_islands || {})[decision.age] || [];
      return pick(pool)?.id || null;
    }
    case "bury": {
      const leaders = (player.played_cards || []).filter((c) => (allCardsById[c.id] || c).color === "leader");
      return pick(leaders)?.id || null;
    }
    case "self_discard": {
      if (decision.mode === "trophy") {
        const trophies = player.trophies || [];
        return trophies.length ? "0" : null;
      }
      const eligible = (player.played_cards || []).filter((c) => (allCardsById[c.id] || c).color === decision.color);
      return pick(eligible)?.id || null;
    }
    case "rome_leader": {
      const affordable = (player.leaders_hand || []).filter((c) => leaderCoinCost(player, c, allPlayers, Number(game?.age) || 0) <= (player.coins || 0));
      return pick(affordable)?.id || null;
    }
    case "ur_edifice": {
      const ages = edificeList(game).map((ed) => String(ed.age));
      return pick(ages) || null;
    }
    case "edifice_patronage_age":
      return null;
    case "edifice_complete": {
      // Acknowledge the popup. If there's a penalty decision, pick a discard
      // target that minimizes VP loss (the self_discard fallback already does
      // this, so a null choice triggers the optimal auto-discard).
      const pen = (decision.edifice?.penaltyDecisions?.[player.id] || [])[0];
      if (!pen) return null;
      if (pen.effect.kind === "self_discard") {
        if (pen.effect.mode === "trophy") return "0";
        const eligible = (player.played_cards || []).filter((c) => (allCardsById[c.id] || c).color === pen.effect.color);
        return pick(eligible)?.id || null;
      }
      return null;
    }
    default:
      return null;
  }
}