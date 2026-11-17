// Host round-end logic for the queue model.
// Runs when every player is round_done: applies deferred outgoing effects,
// resolves military/naval at age end, completes edifices (with an interactive
// popup + discard choices), and passes hands / advances the age.

import { applyOutgoing } from "./queue";
import {
  resolveMilitary, recomputeStaticEffects, rotateHands, nextAge,
  passDirectionForAge, pushNotif, hasEffect, getIslands, applyEdificeEffect,
  resolveNavalOverwhelm, applyCoinGainBonus,
} from "./rules";
import { resolveNaval } from "./armada";
import { edificeForAge, edificeList, completeEdifice } from "./edifices";
import { getWonder } from "./constants";

// Does the edifice for `age` complete now? It completes when all patronage
// tokens are taken (remaining === 0) OR at the end of its age.
export function shouldCompleteEdifice(game, age, atAgeEnd = false, playerCount = 0) {
  if (!game?.edifice_expansion) return null;
  if (String(age) === "leader") return null;
  const ed = edificeForAge(game, age);
  const st = game.edifice_state?.[ed?.id];
  if (!ed || !st || st.completed) return null;
  // At age end the edifice completes regardless of remaining tokens.
  if (atAgeEnd) return { ed, st };
  // Mid-age completion only when EVERY player has donated at least once
  // (unique donors), not merely when total donations equal the player count.
  const uniqueDonors = new Set(st.holders || []).size;
  if (playerCount > 0 && uniqueDonors >= playerCount) return { ed, st };
  return null;
}

// Apply edifice completion. Rewards and flat penalties apply immediately; a
// self_discard / lose_coins penalty queues an `edifice_penalty` decision for
// the player so they can choose what to lose. Returns:
//   { edificeSummary: { [playerId]: { rewards, penalties } }, penaltyDecisions: { [playerId]: [decision] } }
export function completeEdificeInteractive(ed, st, players, game, allCardsById, ctx) {
  const summary = {};
  const penaltyDecisions = {};
  if (!ed || !st || st.completed) return { edificeSummary: summary, penaltyDecisions };
  for (const p of players) {
    const count = (p.patronage_tokens || []).filter((t) => t.edifice_id === ed.id).length;
    if (count > 0) {
      const rewards = [];
      if (ed.reward_effects && ed.reward_effects.length) {
        for (const e of ed.reward_effects) {
          rewards.push(describeEdificeEffect(e, count));
          applyEdificeEffect(p, e, players, allCardsById, ctx, count);
        }
      } else {
        const vp = (ed.rewards?.vp || 0) * count;
        p.bonus_vp = (p.bonus_vp || 0) + vp;
        const rc = (ed.rewards?.coins || 0) * count;
        if (rc) { p.coins = (p.coins || 0) + rc; pushNotif(ctx, p.id, { type: "coin_gain", amount: rc, cardName: `${ed.name} reward`, text: `Gained ${rc} coins — ${ed.name} reward` }); }
        if (vp) rewards.push(`+${vp} VP`);
        if (rc) rewards.push(`+${rc} coins`);
      }
      summary[p.id] = { rewards, penalties: [] };
      pushNotif(ctx, p.id, { type: "edifice_reward", amount: count, cardName: ed.name, text: `${ed.name} (Age ${ed.age}) completed — gained: ${rewards.join(", ") || "reward"}` });
    } else {
      const penalties = [];
      if (ed.penalty_effects && ed.penalty_effects.length) {
        for (const e of ed.penalty_effects) {
          penalties.push(describeEdificeEffect(e, 1));
          if (e.kind === "self_discard" || e.kind === "lose_coins") {
            (penaltyDecisions[p.id] = penaltyDecisions[p.id] || []).push({ type: "edifice_penalty", effect: e, edificeName: ed.name, age: ed.age });
          } else {
            applyEdificeEffect(p, e, players, allCardsById, ctx, 1);
          }
        }
      } else {
        const pvp = ed.penalties?.vp || 0;
        p.bonus_vp = (p.bonus_vp || 0) + pvp;
        const pc = ed.penalties?.coins || 0;
        if (pc) { const before = p.coins || 0; p.coins = Math.max(0, before + pc); const lost = before - p.coins; if (lost > 0) pushNotif(ctx, p.id, { type: "coin_spend", amount: lost, cardName: `${ed.name} penalty`, text: `Lost ${lost} coins — ${ed.name} penalty` }); }
        if (pvp) penalties.push(`${pvp} VP`);
        if (pc) penalties.push(`${pc} coins`);
      }
      summary[p.id] = { rewards: [], penalties };
      pushNotif(ctx, p.id, { type: "penalty", amount: 1, cardName: ed.name, text: `${ed.name} (Age ${ed.age}) completed — lost: ${penalties.join(", ") || "penalty"}` });
    }
  }
  st.completed = true;
  return { edificeSummary: summary, penaltyDecisions };
}

function describeEdificeEffect(effect, mult) {
  const amt = (effect.amount || 0) * mult;
  switch (effect.kind) {
    case "vp": return effect.perMetric ? `+${effect.amount || 0} VP per ${effect.perMetric} ×${mult}` : `${amt >= 0 ? "+" : ""}${amt} VP`;
    case "coins": return `${amt >= 0 ? "+" : ""}${amt} coins`;
    case "shields": return `${amt >= 0 ? "+" : ""}${amt} shields`;
    case "naval_shields": return `${amt >= 0 ? "+" : ""}${amt} naval shields`;
    case "science": return `+${mult} science`;
    case "set_vp": return `+${effect.amount || 0} VP/set ×${mult}`;
    case "vp_per_island": return `+${effect.amount || 0} VP/island ×${mult}`;
    case "vp_if_ge": return `+${effect.amount || 5} VP if ≥ neighbors ×${mult}`;
    case "vp_if_none": return `+${effect.amount || 0} VP if none ×${mult}`;
    case "vp_if_one": return `+${effect.amount || 0} VP if one ×${mult}`;
    case "trophy_pairs_vp": return `Trophy pairs VP ×${mult}`;
    case "vp_if_wonder_complete": return `+${effect.amount || 0} VP if wonder complete ×${mult}`;
    case "self_discard": return `Discard a ${effect.color || "?"} card/trophy`;
    case "lose_coins": return `Lose ${effect.amount || 0} coins`;
    default: return effect.kind || "effect";
  }
}

// Finish a round. Mutates a COPY of players + game and returns the new state.
// `phase` = "choosing" | "leader_select". This does NOT persist — the caller
// (host) persists the result.
export function finishRound(game, players, allCardsById, opts = {}) {
  const ctx = { age: game.age, round: game.round || 0, islandPool: game.armada_islands || {}, notifs: {} };
  const g = { ...game, edifice_state: JSON.parse(JSON.stringify(game.edifice_state || {})) };
  const ps = players.map((p) => ({ ...p, pending_outgoing: p.pending_outgoing || [] }));

  // 1. Apply deferred outgoing effects (in seat order by source).
  const allOutgoing = [];
  for (const p of ps) allOutgoing.push(...(p.pending_outgoing || []));
  applyOutgoing(ps, allOutgoing, allCardsById, ctx);
  for (const p of ps) p.pending_outgoing = [];

  // 2. Recompute static effects (cards may have been added/removed).
  for (const p of ps) { try { recomputeStaticEffects(p, allCardsById); } catch (e) { /* ignore */ } }

  // 3. Determine if the age ends (all players have ≤1 card in hand).
  const ageEnds = ps.every((p) => (p.hand || []).length <= 1);
  // Play Both: players with the ability get an extra round with their last card.
  const pbPlayers = ps.filter((p) => hasEffect(p, "play_both", allCardsById));
  // Only set up the extra round if a play_both player actually has a card to
  // play. If every hand is already empty (e.g. the last card was played this
  // round), skip the setup and fall through to age-end — otherwise the game
  // returns to "choosing" with all players done and no cards, stalling.
  const pbWithCard = pbPlayers.filter((p) => (p.hand || []).length === 1);
  if (ageEnds && pbWithCard.length > 0 && !g.play_both_round) {
    // Set up the extra round: PB players keep their last card & go again; others
    // discard their last card. No military yet.
    const discard = [...(g.discard || [])];
    for (const p of ps) {
      const isPB = hasEffect(p, "play_both", allCardsById);
      if (isPB && (p.hand || []).length === 1) {
        p.round_done = false; p.ready = false;
      } else {
        if ((p.hand || []).length === 1) { discard.push(p.hand[0]); p.hand = []; }
        p.round_done = true; p.ready = true;
      }
      p.chosen_card_id = null; p.chosen_action = null; p.chosen_trades = []; p.bury_leader_id = null;
    }
    return { game: { ...g, discard, play_both_round: true }, players: ps, notifs: ctx.notifs, ageEnded: false, edificePopup: null };
  }

  // 4. Edifice completion (mid-age if all donated, or at age end).
  let edificePopup = null;
  let edificeCompletedMidAge = false;
  const checkCompletion = (age, atAgeEnd = false, players = ps) => {
    const c = shouldCompleteEdifice(g, age, atAgeEnd, players.length);
    if (!c) return;
    const { ed, st } = c;
    const { edificeSummary, penaltyDecisions } = completeEdificeInteractive(ed, st, players, g, allCardsById, ctx);
    edificePopup = { name: ed.name, age: ed.age, icon_url: ed.icon_url || "", summary: edificeSummary, penaltyDecisions };
  };
  // Mid-age completion (all donated) — checked even when the age doesn't end.
  if (g.edifice_expansion && String(g.age) !== "leader") {
    checkCompletion(g.age);
    if (edificePopup) edificeCompletedMidAge = true;
  }

  if (ageEnds) {
    // 5a. Age end: discard last card, resolve military + naval.
    const discard = [...(g.discard || [])];
    for (const p of ps) if ((p.hand || []).length === 1) { discard.push(p.hand[0]); p.hand = []; }

    const beforeTrophies = ps.map((p) => (p.trophies || []).length);
    const beforeDefeats = ps.map((p) => (p.defeats || []).length);
    const beforeNavalT = ps.map((p) => (p.naval_trophies || []).length);
    const beforeNavalD = ps.map((p) => (p.naval_defeats || []).length);

    let resolved = ps;
    try { resolved = resolveMilitary(ps, g.age, allCardsById, ctx); } catch (e) { console.error("resolveMilitary", e); }
    const armadaOn = !!(g.armada_expansion || (g.packs || []).some((p) => String(p).toLowerCase() === "armada"));
    if (armadaOn) {
      try { resolved = resolveNaval(resolved, g.age, ctx, allCardsById); } catch (e) { console.error("resolveNaval", e); }
      try { resolved = resolveNavalOverwhelm(resolved, g.age, allCardsById, ctx); } catch (e) { console.error("resolveNavalOverwhelm", e); }
    }

    // Coin gain bonus: scan the coin gain log for this round and grant once.
    applyCoinGainBonus(resolved, ctx, allCardsById);

    // End-of-age token summary for the popup.
    const ageTokensById = {};
    const lastAge = String(g.age);
    resolved.forEach((p, idx) => {
      const military = [
        ...(p.trophies || []).slice(beforeTrophies[idx]).map((t) => ({ type: "trophy", age: String(t.age), vs: t.vs })),
        ...(p.defeats || []).slice(beforeDefeats[idx]).map((t) => ({ type: "defeat", age: String(t.age), vs: t.vs })),
      ];
      const naval = [
        ...(p.naval_trophies || []).slice(beforeNavalT[idx]).map((t) => ({ type: "victory", age: String(t.age) })),
        ...(p.naval_defeats || []).slice(beforeNavalD[idx]).map((t) => ({ type: "defeat", age: String(t.age) })),
      ];
      ageTokensById[p.id] = { age: lastAge, military, naval };
    });

    // Age-end edifice completion (if not already completed mid-age).
    // AtAgeEnd=true forces completion regardless of remaining patronage tokens.
    if (g.edifice_expansion && String(g.age) !== "leader" && !edificePopup) checkCompletion(g.age, true, resolved);
    // Only include the edifice in the end-of-age popup if it completed at age
    // end — a mid-age completion already showed its own popup and should not
    // reappear in the end-of-age resolution screen.
    if (edificePopup && !edificeCompletedMidAge) {
      for (const p of resolved) {
        const pen = edificePopup.penaltyDecisions[p.id] || [];
        ageTokensById[p.id] = { ...(ageTokensById[p.id] || { age: lastAge, military: [], naval: [] }), edifice: { ...edificePopup, ...(edificePopup.summary[p.id] || { rewards: [], penalties: [] }) } };
      }
    }

    // Clear per-round choice fields.
    for (const p of resolved) {
      p.wonder_discard_choice = null; p.bury_leader_id = null; p.wonder_choice = null;
      p.chosen_card_id = null; p.chosen_action = null; p.chosen_trades = []; p.ready = false;
      p.round_done = false; p.decision_queue = []; p.last_age_tokens = ageTokensById[p.id] || null;
      p.stages_built_this_age = 0;
      p.edifice_donate = null; p.ur_edifice_choice = null; p.rome_leader_choice = null;
      p.armada_move = null; p.armada_move_free = null; p.move_ship_choices = []; p.unearth_choice = null;
      p.edifice_ack = false;
    }

    const nx = nextAge(g.age);
    if (!nx) {
      return { game: { ...g, discard, phase: "scoring", status: "finished", play_both_round: false }, players: resolved, notifs: ctx.notifs, ageEnded: true, edificePopup };
    }
    // If an edifice completed, gate on acknowledgements before dealing the next age.
    if (edificePopup) {
      for (const p of resolved) p.decision_queue = edificePopup.penaltyDecisions[p.id] ? [{ type: "edifice_complete", edifice: edificePopup }] : [{ type: "edifice_complete", edifice: edificePopup }];
      return { game: { ...g, discard, phase: "edifice_gate", age: g.age, play_both_round: false }, players: resolved, notifs: ctx.notifs, ageEnded: true, edificePopup };
    }
    return { game: { ...g, discard, phase: "leader_select", play_both_round: false }, players: resolved, notifs: ctx.notifs, ageEnded: true, edificePopup };
  }

  // 5b. Mid-round: rotate hands.
  for (const p of ps) {
    p.chosen_card_id = null; p.chosen_action = null; p.chosen_trades = []; p.ready = false;
    p.round_done = false; p.decision_queue = []; p.bury_leader_id = null; p.wonder_choice = null;
    p.edifice_donate = null; p.ur_edifice_choice = null; p.rome_leader_choice = null;
    p.armada_move = null; p.armada_move_free = null; p.move_ship_choices = []; p.unearth_choice = null;
    p.edifice_ack = false;
  }
  // Coin gain bonus: scan the coin gain log for this round and grant once.
  applyCoinGainBonus(ps, ctx, allCardsById);
  // Safety: a player with only 1 card should never pass it — discard it instead.
  // This prevents a neighbor from receiving a 1-card hand at the end of an age.
  const midDiscard = [];
  for (const p of ps) {
    if ((p.hand || []).length === 1) { midDiscard.push(p.hand[0]); p.hand = []; }
  }
  // If an edifice completed mid-round, gate on acknowledgements.
  if (edificePopup) {
    for (const p of ps) p.decision_queue = [{ type: "edifice_complete", edifice: edificePopup }];
    return { game: { ...g, discard: [...(g.discard || []), ...midDiscard], phase: "edifice_gate", round: (g.round || 0) + 1 }, players: ps, notifs: ctx.notifs, ageEnded: false, edificePopup };
  }
  const rotated = rotateHands(ps, g.pass_direction);
  return { game: { ...g, discard: [...(g.discard || []), ...midDiscard], round: (g.round || 0) + 1 }, players: rotated, notifs: ctx.notifs, ageEnded: false, edificePopup };
}

// After all players acknowledge the edifice popup, advance from the gate.
export function advanceFromEdificeGate(game, players, allCardsById) {
  const g = { ...game };
  const ps = players.map((p) => ({ ...p, decision_queue: [], edifice_ack: false, round_done: false, ready: false }));
  // If we were at age end, advance to leader_select (or scoring).
  if (g.phase === "edifice_gate" && (g._wasAgeEnd || ps.every((p) => (p.hand || []).length === 0))) {
    const nx = nextAge(g.age);
    if (!nx) return { game: { ...g, phase: "scoring", status: "finished" }, players: ps };
    return { game: { ...g, phase: "leader_select" }, players: ps };
  }
  // Mid-round: rotate hands.
  const rotated = rotateHands(ps, g.pass_direction);
  return { game: { ...g, phase: "choosing", round: (g.round || 0) + 1 }, players: rotated };
}