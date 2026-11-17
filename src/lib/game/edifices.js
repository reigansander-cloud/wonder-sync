// Local notif helper (edifices.js is imported by rules.js, so avoid a circular import).
function pushNotif(ctx, playerId, notif) {
  if (!ctx || !playerId || !notif) return;
  ctx.notifs = ctx.notifs || {};
  (ctx.notifs[playerId] = ctx.notifs[playerId] || []).push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), ...notif });
}

let edificeRegistry = [];
export function setEdificeRegistry(list) { edificeRegistry = list || []; }

// Only custom edifices (Edifice entity) are used — there is no built-in pool.
// Custom ids are prefixed `c:` so they never collide.
function mergedPool() {
  return edificeRegistry.map((e) => ({
    id: `c:${e.id}`, name: e.name, age: String(e.age), cost: e.cost || 0,
    icon_url: e.icon_url || "",
    reward_effects: e.reward_effects || [],
    penalty_effects: e.penalty_effects || [],
    custom: true,
  }));
}

// Roll one random custom edifice per age (1/2/3). Each edifice starts with a
// number of patronage tokens equal to the player count. Ages with no custom
// edifice simply have no edifice that age.
export function rollEdifices(playerCount) {
  const all = mergedPool();
  const byAge = { "1": [], "2": [], "3": [] };
  for (const e of all) (byAge[String(e.age)] || []).push(e);
  const edifices = {};
  const edifice_state = {};
  for (const age of ["1", "2", "3"]) {
    const pool = byAge[age];
    if (!pool || pool.length === 0) continue;
    const ed = pool[Math.floor(Math.random() * pool.length)];
    edifices[age] = ed;
    edifice_state[ed.id] = { remaining: playerCount, holders: [], completed: false };
  }
  return { edifices, edifice_state };
}

export function edificeForAge(game, age) {
  return (game?.edifices || {})[String(age)] || null;
}

export function edificeList(game) {
  return Object.values(game?.edifices || {});
}

// Apply a player's donate choice for an edifice. Returns true on success.
export function applyDonate(player, edifice, state, ctx) {
  if (!edifice || !state || state.completed) return false;
  if ((player.coins || 0) < (edifice.cost || 0)) return false;
  const cost = edifice.cost || 0;
  player.coins = (player.coins || 0) - cost;
  if (cost > 0) pushNotif(ctx, player.id, { type: "coin_spend", amount: cost, cardName: `Donate — ${edifice.name}`, text: `Spent ${cost} coins — Donate to ${edifice.name}` });
  state.remaining = (state.remaining || 0) - 1;
  state.holders = [...(state.holders || []), player.id];
  player.patronage_tokens = [...(player.patronage_tokens || []), { edifice_id: edifice.id, age: edifice.age, duplicate: false }];
  pushNotif(ctx, player.id, { type: "edifice_reward", amount: 1, cardName: edifice.name, text: `Donated ${cost} coins — gained a patronage token for ${edifice.name} (Age ${edifice.age})` });
  return true;
}

// Build a short human-readable description of a single edifice effect (for the
// end-of-age popup summary). `mult` is the patronage token count for rewards.
function describeEdificeEffect(effect, mult) {
  const amt = (effect.amount || 0) * mult;
  switch (effect.kind) {
    case "vp":
      return effect.perMetric
        ? `+${effect.amount || 0} VP per ${effect.perMetric} ×${mult}`
        : `${amt >= 0 ? "+" : ""}${amt} VP`;
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
    default: return effect.kind || "effect";
  }
}

// Distribute rewards (holders) and penalties (non-holders) for a completed edifice.
// Custom edifices use reward_effects / penalty_effects (applied per token for
// holders, once for non-holders); built-in edifices fall back to flat vp/coins.
// `applyEdFn(player, effect, mult)` is supplied by the caller (rules.js) so this
// module stays free of the rules.js circular import.
// Returns a per-player summary: { [playerId]: { rewards: string[], penalties: string[] } }
export function completeEdifice(edifice, state, players, ctx, applyEdFn) {
  if (!edifice || !state || state.completed) return {};
  const summary = {};
  for (const p of players) {
    const count = (p.patronage_tokens || []).filter((t) => t.edifice_id === edifice.id).length;
    if (count > 0) {
      const rewards = [];
      if (edifice.reward_effects && edifice.reward_effects.length) {
        for (const e of edifice.reward_effects) { rewards.push(describeEdificeEffect(e, count)); applyEdFn(p, e, count); }
      } else {
        const vp = (edifice.rewards?.vp || 0) * count;
        p.bonus_vp = (p.bonus_vp || 0) + vp;
        const rc = (edifice.rewards?.coins || 0) * count;
        if (rc) { p.coins = (p.coins || 0) + rc; pushNotif(ctx, p.id, { type: "coin_gain", amount: rc, cardName: `${edifice.name} reward`, text: `Gained ${rc} coins — ${edifice.name} reward` }); }
        if (vp) rewards.push(`+${vp} VP`);
        if (rc) rewards.push(`+${rc} coins`);
      }
      summary[p.id] = { rewards, penalties: [] };
      pushNotif(ctx, p.id, { type: "edifice_reward", amount: count, cardName: edifice.name, text: `${edifice.name} (Age ${edifice.age}) completed — gained: ${rewards.join(", ") || "reward"}` });
    } else {
      const penalties = [];
      if (edifice.penalty_effects && edifice.penalty_effects.length) {
        for (const e of edifice.penalty_effects) { penalties.push(describeEdificeEffect(e, 1)); applyEdFn(p, e, 1); }
      } else {
        const pvp = edifice.penalties?.vp || 0;
        p.bonus_vp = (p.bonus_vp || 0) + pvp;
        const pc = edifice.penalties?.coins || 0;
        if (pc) { const before = p.coins || 0; p.coins = Math.max(0, before + pc); const lost = before - p.coins; if (lost > 0) pushNotif(ctx, p.id, { type: "coin_spend", amount: lost, cardName: `${edifice.name} penalty`, text: `Lost ${lost} coins — ${edifice.name} penalty` }); }
        if (pvp) penalties.push(`${pvp} VP`);
        if (pc) penalties.push(`${pc} coins`);
      }
      summary[p.id] = { rewards: [], penalties };
      pushNotif(ctx, p.id, { type: "penalty", amount: 1, cardName: edifice.name, text: `${edifice.name} (Age ${edifice.age}) completed — lost: ${penalties.join(", ") || "penalty"}` });
    }
  }
  state.completed = true;
  return summary;
}

// Grant a duplicate patronage token (Ur wonder). Duplicate tokens come from out
// of play (don't decrement remaining). If the edifice is already completed, the
// rewards are gained immediately; otherwise they're granted at completion.
export function grantDuplicateToken(player, edifice, game, ctx, applyEdFn) {
  if (!edifice) return;
  player.patronage_tokens = [...(player.patronage_tokens || []), { edifice_id: edifice.id, age: edifice.age, duplicate: true }];
  const st = game?.edifice_state?.[edifice.id];
  if (st?.completed) {
    if (edifice.reward_effects && edifice.reward_effects.length) {
      for (const e of edifice.reward_effects) applyEdFn(player, e, 1);
    } else {
      player.bonus_vp = (player.bonus_vp || 0) + (edifice.rewards?.vp || 0);
      const rc = edifice.rewards?.coins || 0;
      if (rc) { player.coins = (player.coins || 0) + rc; pushNotif(ctx, player.id, { type: "coin_gain", amount: rc, cardName: `${edifice.name} reward`, text: `Gained ${rc} coins — ${edifice.name} reward` }); }
    }
  }
}