// Central rules engine for 7 Wonders — data-driven effect evaluation
import { RAW_RESOURCES, MANUFACTURED_RESOURCES, RESOURCE_ORDER, getWonder, AGE_POINTS, ARMADA_REWARDS, NAVAL_VICTORY_POINTS } from "./constants";
import { applyArmadaMove, ARMADA_TRACKS, armadaMoveCostCard, grantIsland, recomputeNavalShields } from "./armada";
import { edificeForAge } from "./edifices";

// ---------- Duplicate-name rule ----------
// A player may not play a card sharing a name with one already in their tableau.
// "(copy)" suffixes are ignored so reprinted/duplicated cards count as the same.
export function baseCardName(name) {
  if (!name) return "";
  return String(name).replace(/\s*\(copy\)\s*$/i, "").trim();
}
export function hasDuplicateName(player, card, allCardsById) {
  const base = baseCardName(card?.name);
  if (!base) return false;
  return (player.played_cards || []).some((pc) => {
    const c = allCardsById?.[pc.id] || pc;
    return baseCardName(c.name) === base;
  });
}

// ---------- Multi-choice wonder tiers ----------
// A wonder stage may offer several reward "options" (each a list of effects);
// the player picks one when building. `stage.choices` is an array of effect
// arrays; when absent/empty the stage's single `effects` list is the only option.
export function stageEffects(stage, choiceIndex) {
  if (!stage) return [];
  if (Array.isArray(stage.choices) && stage.choices.length > 0) {
    const idx = choiceIndex == null ? 0 : Number(choiceIndex);
    const opt = stage.choices[idx];
    if (Array.isArray(opt)) return opt;
    // An option may be an object { effects } for forward-compat.
    if (opt && Array.isArray(opt.effects)) return opt.effects;
  }
  return stage.effects || [];
}

// Effects of an already-built stage (using the choice the player made for it).
export function builtStageEffects(player, wonder, i) {
  if (!wonder) return [];
  const stage = wonder.stages?.[i];
  if (!stage) return [];
  const choice = (player.wonder_choices || [])[i];
  return stageEffects(stage, choice);
}

// Does building this stage require a player choice (option and/or self-discard)?
export function stageNeedsChoice(stage) {
  if (!stage) return false;
  const multi = Array.isArray(stage.choices) && stage.choices.length > 1;
  const allEffs = Array.isArray(stage.choices) && stage.choices.length
    ? stage.choices.flat()
    : (stage.effects || []);
  const hasSelfDiscard = allEffs.some((e) => e.kind === "self_discard");
  return multi || hasSelfDiscard;
}

// Push a player-facing notification into ctx.notifs (keyed by player id). Each
// notification gets a stable id + timestamp so the UI can show/sort/expire them.
export function pushNotif(ctx, playerId, notif) {
  if (!ctx || !playerId || !notif) return;
  ctx.notifs = ctx.notifs || {};
  (ctx.notifs[playerId] = ctx.notifs[playerId] || []).push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    age: ctx.age != null ? String(ctx.age) : null,
    round: ctx.round != null ? Number(ctx.round) : null,
    ...notif,
  });
}

const emptyRes = () => ({ wood: 0, stone: 0, clay: 0, ore: 0, glass: 0, papyrus: 0, loom: 0 });

// ---------- Deck generation ----------
// White Space is the filler card used when a deck has too few cards for a
// player count. It grants a choice of any of the 7 resources, 1 VP, and 1 coin.
export const WHITE_SPACE_IMAGE = "https://pcfxwugndktkomxgfauc.supabase.co/storage/v1/object/public/uploads/imported/82d4c8bdd4_f26e08aec_WHITESPACE.png";
export const WHITE_SPACE_EFFECTS = [
  { kind: "vp", amount: 1 },
];

function makeWhiteSpaceCard(age, index) {
  return {
    id: `__whitespace_${age}_${index}`,
    name: "White Space",
    image_url: WHITE_SPACE_IMAGE,
    age,
    color: "purple",
    cost_coins: 1,
    cost_resources: {},
    chain_cost: "",
    chain_symbols: [],
    description: "Grants 1 VP. Costs 1 coin.",
    player_counts: [3, 4, 5, 6, 7],
    effects: WHITE_SPACE_EFFECTS,
  };
}

export function generateDeck(allCards, playerCount, age, activePacks = []) {
  // activePacks: extra pack names toggled on for this game ("cities" + any custom
  // packs). The "purple" pack is always active (Age III guilds) and handled below.
  // Each active pack adds exactly ONE card per player per age (random from that
  // pack's age cards), on top of the 7-card base deck. Leaders from packs just
  // join the leader pool — the per-player draw stays 4 no matter how many packs.
  const isLeader = age === "leader";
  const packCount = isLeader ? 0 : activePacks.length;
  const handSize = isLeader ? 4 : 7 + packCount;
  const needed = playerCount * handSize;

  const hasPack = (c) => !!(c.pack && String(c.pack).trim());

  // Base deck cards: no pack, matching age + player count. Pack cards are only
  // added through their pack rule (below), and only when that pack is active.
  let baseCards = allCards.filter((c) => {
    if (c.age !== age) return false;
    if (c.pool) return false;      // legacy pool cards handled below
    if (hasPack(c)) return false;   // pack cards handled per-pack
    return matchesPlayerCount(c, playerCount);
  });

  // Each active pack: exactly playerCount cards (1 per player), random from
  // that pack's age cards. These are ADDED on top of the trimmed base deck so
  // they are guaranteed to be dealt (not mixed in and trimmed away).
  let packCards = [];
  if (!isLeader) {
    for (const packName of activePacks) {
      const pn = String(packName).toLowerCase();
      const available = shuffle(allCards.filter((c) => c.age === age && String(c.pack || "").toLowerCase() === pn && matchesPlayerCount(c, playerCount)));
      packCards = [...packCards, ...available.slice(0, playerCount)];
    }
  } else {
    // Leader draft: pack-assigned leaders join the pool; per-player draw stays 4.
    for (const packName of activePacks) {
      const pn = String(packName).toLowerCase();
      const packLeaders = allCards.filter((c) => c.age === "leader" && String(c.pack || "").toLowerCase() === pn && matchesPlayerCount(c, playerCount));
      baseCards = [...baseCards, ...packLeaders];
    }
  }

  // Legacy pool-mode cards (no longer authored, but preserved): draw pool_counts.
  const poolMembers = {};
  for (const c of allCards) {
    if (c.age === age && c.pool) (poolMembers[c.pool] = poolMembers[c.pool] || []).push(c);
  }
  for (const poolName of Object.keys(poolMembers)) {
    const members = poolMembers[poolName];
    const n = (members[0]?.pool_counts || {})[String(playerCount)] ?? 0;
    if (n > 0) baseCards = [...baseCards, ...shuffle(members).slice(0, n)];
  }

  // De-duplicate by id (base first, then pack cards against the base).
  const seen = new Set();
  baseCards = baseCards.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  const seenPack = new Set(seen);
  packCards = packCards.filter((c) => (seenPack.has(c.id) ? false : (seenPack.add(c.id), true)));

  // Purple guilds: Age III only, playerCount + 2 cards (5 in 3p, 6 in 4p, …).
  // Purple does NOT add to hand size; the base age-3 deck is trimmed to fit them.
  let purples = [];
  if (!isLeader && age === "3") {
    purples = shuffle(allCards.filter((c) => c.age === "3" && c.pack === "purple" && matchesPlayerCount(c, playerCount))).slice(0, playerCount + 2);
  }

  // Trim the base deck to 7*playerCount (minus purple room), then add pack
  // cards and purples on top. Pack cards are never trimmed — they are the
  // guaranteed extra card per player.
  const baseTarget = (isLeader ? 4 : 7) * playerCount - purples.length;
  let deck = shuffle(baseCards);
  if (deck.length > baseTarget) deck = deck.slice(0, baseTarget);
  deck = [...deck, ...packCards, ...purples];
  let pad = 0;
  while (deck.length < needed) deck.push(makeWhiteSpaceCard(age, pad++));
  return shuffle(deck);
}

function matchesPlayerCount(c, playerCount) {
  if (c.player_counts && c.player_counts.length) return c.player_counts.includes(playerCount);
  return true;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Resource production ----------
export function getProducibleResources(player, allCardsById) {
  // `fixed`/`choices` = FULL production (includes personal, usable by the owner).
  // `tradeableFixed`/`tradeableChoices` exclude personal resources — these are
  // what neighbors can trade for and what opponents see on this player's board.
  const fixed = emptyRes();
  const choices = [];
  const tradeableFixed = emptyRes();
  const tradeableChoices = [];
  const cards = (player.played_cards || []).map((c) => { const full = allCardsById[c.id] || c; return { ...full, effects: resolvedEffectsFor(player, full, allCardsById) }; });
  for (const card of cards) {
    for (const e of card.effects || []) {
      if (e.kind === "resource" && e.resources?.length === 1) {
        fixed[e.resources[0]] += 1;
        if (!e.personal) tradeableFixed[e.resources[0]] += 1;
      } else if (e.kind === "resource_choice" && e.resources?.length > 1) {
        choices.push([...e.resources]);
        if (!e.personal) tradeableChoices.push([...e.resources]);
      }
    }
  }
  // wonder start resource + wonder stage resource effects (never personal)
  const wonder = getWonder(player.wonder, player.wonder_side);
  if (wonder?.start_resource) { fixed[wonder.start_resource] += 1; tradeableFixed[wonder.start_resource] += 1; }
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) {
      if (e.kind === "resource" && e.resources?.length === 1) { fixed[e.resources[0]] += 1; tradeableFixed[e.resources[0]] += 1; }
      else if (e.kind === "resource_choice" && e.resources?.length > 1) { choices.push([...e.resources]); tradeableChoices.push([...e.resources]); }
    }
  }

  // Warehouse / Black Market: dynamic choice resources. Warehouse chooses among
  // resources the player already produces; Black Market among those they don't.
  const produced = new Set();
  for (const r of RESOURCE_ORDER) if (fixed[r] > 0) produced.add(r);
  for (const ch of choices) for (const r of ch) produced.add(r);
  for (const card of cards) {
    for (const e of card.effects || []) {
      if (e.kind === "warehouse") {
        const set = [...produced];
        if (set.length) { choices.push(set); if (!e.personal) tradeableChoices.push(set); }
      } else if (e.kind === "black_market") {
        const set = RESOURCE_ORDER.filter((r) => !produced.has(r));
        if (set.length) { choices.push(set); if (!e.personal) tradeableChoices.push(set); }
      }
    }
  }

  return { fixed, choices, tradeableFixed, tradeableChoices };
}

// Does neighbor produce a given (tradeable) resource? Personal resources are
// excluded — opponents can never trade for them.
export function producesResource(player, resource, allCardsById) {
  const { tradeableFixed, tradeableChoices } = getProducibleResources(player, allCardsById);
  if (tradeableFixed[resource] > 0) return true;
  return tradeableChoices.some((c) => c.includes(resource));
}

// Foreign Trade: the players 2 seats away (both directions), excluding direct
// neighbors and self. Empty in 3-player games (where those seats are direct).
export function farNeighborsOf(player, allPlayers) {
  const n = allPlayers.length;
  const out = [];
  const seen = new Set();
  for (const off of [2, -2]) {
    const t = allPlayers.find((q) => q.seat === (player.seat + off + n) % n);
    if (!t) continue;
    const d = (t.seat - player.seat + n) % n;
    if (Math.min(d, n - d) <= 1) continue;
    if (seen.has(t.seat)) continue;
    seen.add(t.seat);
    out.push(t);
  }
  return out;
}

// Leader coin cost after wonder passives (Rome). leaders_cost_zero → 0;
// leader_cost_reduction → -1 for own leaders, and each neighbor with it also
// grants -1 to this player's leaders. Never negative.
export function leaderCoinCost(player, card, allPlayers, gameAge) {
  if (player.leader_cost_reduction != null && player.leader_cost_reduction > 0) {
    const r = player.leader_cost_reduction;
    if (r >= 99) return 0;
    return Math.max(0, effectiveCoinCost(card, gameAge) - r);
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  const passives = wonder.passives || [];
  if (passives.includes("leaders_cost_zero")) return 0;
  let cost = effectiveCoinCost(card, gameAge);
  if (passives.includes("leader_cost_reduction_2")) cost -= 2;
  else if (passives.includes("leader_cost_reduction")) cost -= 1;
  const n = allPlayers.length;
  for (const off of [1, -1]) {
    const nb = allPlayers.find((q) => q.seat === (player.seat + off + n) % n);
    if (!nb) continue;
    const nbP = (getWonder(nb.wonder, nb.wonder_side).passives || []);
    if (nbP.includes("leader_cost_reduction_2") || nbP.includes("leader_cost_reduction") || nbP.includes("leaders_cost_zero")) cost -= 1;
  }
  return Math.max(0, cost);
}

export function computeLeaderReduction(player, allPlayers) {
  const wonder = getWonder(player.wonder, player.wonder_side);
  const passives = wonder.passives || [];
  if (passives.includes("leaders_cost_zero")) return 99;
  let r = 0;
  if (passives.includes("leader_cost_reduction_2")) r += 2;
  else if (passives.includes("leader_cost_reduction")) r += 1;
  const n = allPlayers.length;
  for (const off of [1, -1]) {
    const nb = allPlayers.find((q) => q.seat === (player.seat + off + n) % n);
    if (!nb) continue;
    const nbP = (getWonder(nb.wonder, nb.wonder_side).passives || []);
    if (nbP.includes("leader_cost_reduction_2") || nbP.includes("leader_cost_reduction") || nbP.includes("leaders_cost_zero")) r += 1;
  }
  return r;
}

// Rome (night) wonder stage abilities, applied when a stage is built.
// stageIndex = the 0-based index of the stage just built (before increment).
// Stage 1: draw up to 4 leaders from the out-of-play leader deck into hand.
// Stages 2-3: play the chosen leader (player.rome_leader_choice) for free.
// `leaderDeck` is mutated (splice) so the caller persists the depleted deck.
export function resolveRomeNightStage(player, stageIndex, leaderDeck, allPlayers, allCardsById, ctx) {
  if (player.wonder !== "rome" || player.wonder_side !== "B") return;
  if (stageIndex === 0) {
    const drawn = leaderDeck.splice(0, 4);
    player.leaders_hand = [...(player.leaders_hand || []), ...drawn];
  } else if (stageIndex === 1 || stageIndex === 2) {
    const leaderId = player.rome_leader_choice;
    if (!leaderId) return;
    const leader = (player.leaders_hand || []).find((c) => c.id === leaderId);
    if (!leader) return;
    applyCardEffects(player, leader, allPlayers, allCardsById, ctx);
    player.played_cards = [...(player.played_cards || []), leader];
    player.leaders_hand = (player.leaders_hand || []).filter((c) => c.id !== leaderId);
    const gameAge = Number(ctx?.age) || 0;
    const cost = Math.max(0, leaderCoinCost(player, leader, allPlayers, gameAge) - 2);
    if (cost > 0) spendCoins(player, cost, ctx);
  }
}

// "A" coin cost: a card whose cost_coins is negative costs coins equal to its
// age when played (black cards) — i.e. the current age. Leaders (age "leader")
// have no numeric age of their own, so when one is played the current/upcoming
// game age is passed in (gameAge) and the card costs that many coins. When no
// game context is supplied (e.g. Bury valuation), an A-cost leader falls back
// to 3 coins (its Age III value) so Bury always grants 6 VP.
export function effectiveCoinCost(card, gameAge) {
  const c = card?.cost_coins || 0;
  if (c < 0) {
    if (card?.age === "leader") {
      const g = Number(gameAge);
      return Number.isFinite(g) && g > 0 ? g : 3;
    }
    const a = Number(card?.age);
    return Number.isFinite(a) && a > 0 ? a : 3;
  }
  return c;
}

// ---------- Affordability ----------
// Returns { ok, coinsNeeded, missing, tradePairs }
export function canAfford(player, card, leftNeighbor, rightNeighbor, allCardsById, farNeighbors = [], game = null, pools = null) {
  const { fixed, choices } = pools ? { fixed: pools.fixed, choices: pools.choices } : getProducibleResources(player, allCardsById);
  const coinBalance = pools ? (pools.coins ?? 0) : (player.coins || 0);

  // Free First Card Per Color: a qualifying card is free if an unused instance
  // for its color exists this age (no resource/coin cost, no trade).
  if (game && canFreeFirstPerColor(player, card, game, allCardsById)) {
    return { ok: true, coinsNeeded: 0, missing: emptyRes(), tradePairs: [], freeColor: card.color };
  }

  // Chain: free if player owns chain symbol
  if (card.chain_cost && (player.played_cards || []).some((pc) => {
    const c = allCardsById[pc.id] || pc;
    return (c.chain_symbols || []).includes(card.chain_cost);
  })) {
    return { ok: true, coinsNeeded: 0, missing: emptyRes(), tradePairs: [] };
  }

  // Free cost reduction: an effect with `free` set waives the entire cost
  // (resources + coins) of its matching target (card color / wonder tier / ship).
  if (isCostFree(player, card, allCardsById)) {
    return { ok: true, coinsNeeded: 0, missing: emptyRes(), tradePairs: [], freeReduction: true };
  }

  // Free build color (from wonder stage)
  const wonder = getWonder(player.wonder, player.wonder_side);
  let freeBuild = false;
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    const stage = wonder.stages[i];
    if (stage?.effects?.some((e) => e.kind === "free_build_color" && e.color === card.color)) {
      // free build once per age — simplified: allow if no free build used marker
      if (!(player._freeBuildUsed)) { freeBuild = true; }
    }
  }
  if (freeBuild && effectiveCoinCost(card) === 0) {
    return { ok: true, coinsNeeded: 0, missing: emptyRes(), tradePairs: [] };
  }

  const need = applyCostReductions(player, card, { ...(card.cost_resources || {}) }, allCardsById);
  const coinCost = effectiveCoinCost(card);

  // First subtract fixed resources
  const remaining = emptyRes();
  let fixedPool = { ...fixed };
  const missing = emptyRes();
  for (const r of Object.keys(need)) {
    let needAmt = need[r] || 0;
    let have = fixedPool[r] || 0;
    const use = Math.min(needAmt, have);
    fixedPool[r] -= use;
    needAmt -= use;
    if (needAmt > 0) remaining[r] = needAmt;
  }

  // Try to satisfy remaining with choices
  let best = satisfyWithChoices(remaining, choices);
  if (!best.satisfied) {
    // Trading: buy missing from neighbors
    const missingRes = { ...best.missing };
    const tradePairs = [];
    let coins = coinCost;
    // Supply trade: cover 1 missing resource per "supply_trade" effect for 1 coin each.
    let supplyLeft = countEffects(player, "supply_trade", allCardsById);
    if (supplyLeft > 0) {
      for (const r of Object.keys(missingRes)) {
        while (missingRes[r] > 0 && supplyLeft > 0) {
          missingRes[r] -= 1;
          coins += 1;
          supplyLeft -= 1;
        }
      }
    }
    const scamState = getScamState(player, allCardsById);
    let tradePossible = true;
    let foreignUsed = false;
    // Each resource a neighbor produces can only be bought once per turn (a
    // choice card is consumed entirely once used). Track per-neighbor pools so
    // a single ore card can't supply 2 ore in one turn.
    const makePool = (nbr) => {
      if (!nbr) return null;
      const { tradeableFixed, tradeableChoices } = getProducibleResources(nbr, allCardsById);
      return { nbr, fixed: { ...tradeableFixed }, choices: tradeableChoices.map((c) => [...c]) };
    };
    const consumeFrom = (pool, r) => {
      if (!pool) return false;
      if (pool.fixed[r] > 0) { pool.fixed[r] -= 1; return true; }
      for (let i = 0; i < pool.choices.length; i++) {
        if (pool.choices[i].includes(r)) { pool.choices.splice(i, 1); return true; }
      }
      return false;
    };
    const leftPool = makePool(leftNeighbor);
    const rightPool = makePool(rightNeighbor);
    const farPools = farNeighbors.map(makePool);
    for (const r of Object.keys(missingRes)) {
      let amt = missingRes[r];
      const tryNeighbor = (pool, side) => {
        let bought = 0;
        while (amt > 0 && consumeFrom(pool, r)) {
          const cost = tradeUnitCost(player, pool.nbr, side, r, allCardsById, scamState);
          tradePairs.push({ resource: r, side, cost });
          coins += cost;
          bought++;
          amt--;
        }
        return bought;
      };
      if (leftPool) tryNeighbor(leftPool, "left");
      if (rightPool && amt > 0) tryNeighbor(rightPool, "right");
      // Foreign Trade: once per turn, buy 1 resource from a player 2 seats away for 1 coin.
      if (amt > 0 && !foreignUsed && hasEffect(player, "foreign_trade", allCardsById)) {
        for (let i = 0; i < farPools.length; i++) {
          if (amt <= 0) break;
          const fp = farPools[i];
          if (fp && consumeFrom(fp, r)) {
            tradePairs.push({ resource: r, side: "far", seat: fp.nbr.seat, cost: 1 });
            coins += 1;
            foreignUsed = true;
            amt -= 1;
          }
        }
      }
      if (amt > 0) tradePossible = false;
    }
    if (!tradePossible) {
      return { ok: false, coinsNeeded: coins, missing: best.missing, tradePairs, reason: "Not enough resources" };
    }
    if (coins > coinBalance) {
      return { ok: false, coinsNeeded: coins, missing: best.missing, tradePairs, reason: "Not enough coins for cost + trading" };
    }
    return { ok: true, coinsNeeded: coins, missing: emptyRes(), tradePairs };
  }

  if (coinCost > coinBalance) {
    return { ok: false, coinsNeeded: coinCost, missing: emptyRes(), tradePairs: [], reason: "Not enough coins" };
  }
  return { ok: true, coinsNeeded: coinCost, missing: emptyRes(), tradePairs: [] };
}

// Resource/coin pools remaining AFTER the player's committed card or wonder-stage
// cost for this round. Own resources are consumed by the card/wonder, so a ship
// move decided in the same round can't reuse them — it must trade for the rest.
// `pools` = { fixed, choices, coins } ready to pass into canAfford/getTradeInfo.
export function poolsAfterCommit(player, card, action, tradePairs, game, allCardsById, leftNeighbor, rightNeighbor, farNeighbors) {
  const { fixed, choices } = getProducibleResources(player, allCardsById);
  const freeAction = action === "discard" || action === "discard_armada" || action === "play_free" || action === "play_free_color";
  let costResources = {};
  let coinCost = 0;
  let free = freeAction;
  if (action === "build") {
    const wonder = getWonder(player.wonder, player.wonder_side);
    const stage = wonder.stages[player.wonder_stages_built || 0];
    if (stage) { costResources = stage.cost || {}; coinCost = stage.cost_coins || 0; }
    else free = true;
  } else if (action === "play" && card) {
    const freeChain = card.chain_cost && (player.played_cards || []).some((pc) => {
      const c = allCardsById[pc.id] || pc;
      return (c.chain_symbols || []).includes(card.chain_cost);
    });
    if (!freeChain && !isCostFree(player, card, allCardsById)) {
      costResources = applyCostReductions(player, card, { ...(card.cost_resources || {}) }, allCardsById);
      coinCost = effectiveCoinCost(card);
    } else free = true;
  }
  const remFixed = { ...fixed };
  const remChoices = choices.map((c) => [...c]);
  if (!free) {
    const tr = {}; if (tradePairs) for (const t of tradePairs) if (t.resource) tr[t.resource] = (tr[t.resource] || 0) + 1;
    const need = { ...costResources };
    for (const r of Object.keys(need)) {
      let amt = Math.max(0, (need[r] || 0) - (tr[r] || 0));
      const useF = Math.min(amt, remFixed[r] || 0);
      remFixed[r] -= useF; amt -= useF;
      for (const ch of remChoices) { if (amt <= 0) break; const idx = ch.indexOf(r); if (idx >= 0) { ch.splice(idx, 1); amt--; } }
    }
  }
  let coinsUsed = 0;
  if (!free) {
    if (tradePairs && tradePairs.length) {
      coinsUsed = coinCost + tradePairs.reduce((s, t) => s + (t.cost || 0), 0);
    } else if (Object.keys(costResources).length || coinCost) {
      const pseudo = action === "build"
        ? { color: "brown", is_wonder: true, cost_coins: coinCost, cost_resources: costResources, chain_cost: null }
        : { ...card, cost_coins: coinCost, cost_resources: costResources, chain_cost: null };
      const aff = canAfford(player, pseudo, leftNeighbor, rightNeighbor, allCardsById, farNeighbors, game);
      coinsUsed = aff.ok ? aff.coinsNeeded : coinCost;
    }
  }
  return { fixed: remFixed, choices: remChoices, coins: Math.max(0, (player.coins || 0) - coinsUsed) };
}

export function tradeCostFor(player, neighbor, side, resource) {
  // discounts: trade_discount effects reduce cost to 1 for matching resources.
  // An effect with no `resources` list discounts every resource; otherwise only
  // the listed resources are discounted.
  let cost = 2;
  const matches = (e) => e.kind === "trade_discount" && (e.side === side || e.side === "both") &&
    (!(e.resources || []).length || (resource && e.resources.includes(resource)));
  const cards = player.played_cards || [];
  for (const pc of cards) {
    for (const e of (pc.effects || [])) {
      if (matches(e)) cost = Math.min(cost, 1);
    }
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) {
      if (matches(e)) cost = Math.min(cost, 1);
    }
  }
  return cost;
}

// Scam: the first resource traded from a matching neighbor each turn costs 1
// less (min 0; can stack with trade discounts for a free trade). "Starting only"
// limits the discount to the neighbor's starting resource.
export function getScamState(player, allCardsById) {
  const state = { left: null, right: null };
  const add = (side, startingOnly) => {
    if (!state[side]) state[side] = { active: true, startingOnly: !!startingOnly };
    else if (!startingOnly) state[side].startingOnly = false;
  };
  const collect = (effects) => {
    for (const e of effects || []) {
      if (e.kind !== "scam") continue;
      const so = !!e.startingOnly;
      if (e.side === "left" || e.side === "both") add("left", so);
      if (e.side === "right" || e.side === "both") add("right", so);
    }
  };
  for (const pc of player.played_cards || []) collect((allCardsById?.[pc.id] || pc).effects);
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) collect(builtStageEffects(player, wonder, i));
  return state;
}

// Cost for one traded unit, applying the first-resource Scam discount (mutates
// scamState so only the first unit from that side is discounted).
export function tradeUnitCost(player, neighbor, side, resource, allCardsById, scamState) {
  let cost = tradeCostFor(player, neighbor, side, resource);
  if (scamState && scamState[side] && scamState[side].active) {
    const so = scamState[side].startingOnly;
    const ok = !so || getWonder(neighbor?.wonder, neighbor?.wonder_side)?.start_resource === resource;
    if (ok) { cost = Math.max(0, cost - 1); scamState[side].active = false; }
  }
  return cost;
}

// Find the assignment of choice-resources that minimizes the number of missing
// resources (so the caller can trade for only what remains). Each choice can
// supply at most one unit of one of its listed resources. Returns the minimal
// residual `missing`; satisfied=true when that residual is zero.
function satisfyWithChoices(need, choices) {
  const remaining = { ...need };
  const total = Object.values(remaining).reduce((a, b) => a + b, 0);
  if (total === 0) return { satisfied: true, missing: emptyRes() };
  if (choices.length === 0) return { satisfied: false, missing: remaining };

  let bestMissing = { ...remaining };
  let bestTotal = total;
  const rec = (rem, idx) => {
    const curTotal = Object.values(rem).reduce((a, b) => a + b, 0);
    if (curTotal < bestTotal) { bestTotal = curTotal; bestMissing = { ...rem }; }
    if (curTotal === 0 || idx >= choices.length) return;
    // Skip this choice (leave it unused).
    rec(rem, idx + 1);
    // Use this choice for one needed resource it can provide.
    const ch = choices[idx];
    for (const r of Object.keys(rem)) {
      if (rem[r] > 0 && ch.includes(r)) {
        const nr = { ...rem };
        nr[r] -= 1;
        rec(nr, idx + 1);
      }
    }
  };
  rec(remaining, 0);
  if (bestTotal === 0) return { satisfied: true, missing: emptyRes() };
  return { satisfied: false, missing: bestMissing };
}

// ---------- Effect application ----------
// Mirror: a "mirror" card copies a chosen city card's effects. The choice is
// stored per mirror card in player.mirror_choices (mirror card id -> chosen id).
// resolvedEffectsFor expands a card's effects so play/derivation functions see
// the copied effects directly — no per-kind special-casing needed.
function mirrorChosenCard(player, cardId, allCardsById) {
  const id = player.mirror_choices?.[cardId];
  if (!id) return null;
  const chosen = (player.played_cards || []).find((c) => c.id === id);
  return chosen ? (allCardsById?.[chosen.id] || chosen) : null;
}
export function resolvedEffectsFor(player, card, allCardsById, depth = 0) {
  const own = card.effects || [];
  if (!own.some((e) => e.kind === "mirror")) return own;
  if (depth > 4) return own.filter((e) => e.kind !== "mirror");
  const full = mirrorChosenCard(player, card.id, allCardsById);
  const copied = full ? resolvedEffectsFor(player, full, allCardsById, depth + 1).filter((e) => e.kind !== "mirror") : [];
  return [...own.filter((e) => e.kind !== "mirror"), ...copied];
}

export function applyCardEffects(player, card, allPlayers, allCardsById, context = {}) {
  for (const effect of resolvedEffectsFor(player, card, allCardsById)) {
    applyEffect(player, effect, card, allPlayers, allCardsById, context);
  }
}

// Recompute the "static" derived fields — shields, science_symbols and
// chain_symbols_owned — from the player's current played cards and built
// wonder stages. These are accumulated incrementally when a card or stage is
// played, so when a card is later removed from the city (Bury, or a wonder
// stage's discard effect) they must be re-derived or the discarded card keeps
// granting its ongoing effects. Naval shields are owned by the Armada tracks
// (recomputed on track moves) and are not touched here.
export function recomputeStaticEffects(player, allCardsById) {
  let shields = 0;
  const science = [];
  const chain = new Set();
  const apply = (effects) => {
    for (const e of effects || []) {
      switch (e.kind) {
        case "shields": shields += e.amount || 0; break;
        case "science": science.push(e.symbol || "script"); break;
        case "science_choice": science.push(e.most ? "__most__" : e.spy ? "__spy__" : "__choice__"); break;
        case "chain": if (e.chainSymbol) chain.add(e.chainSymbol); break;
        default: break;
      }
    }
  };
  for (const pc of player.played_cards || []) {
    const full = allCardsById?.[pc.id] || pc;
    apply(resolvedEffectsFor(player, full, allCardsById));
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) apply(builtStageEffects(player, wonder, i));
  player.shields = shields; player.science_symbols = science; player.chain_symbols_owned = [...chain];
  try { recomputeNavalShields(player, allCardsById); } catch (e) { /* no armada board */ }
}

function countByColor(player, color, allCardsById) {
  return (player.played_cards || []).filter((c) => {
    const full = allCardsById[c.id] || c;
    return full.color === color;
  }).length;
}

// ---------- Effect categorization (queue model) ----------
// Outgoing effects target OTHER players and are deferred to round end in the
// new sequential-resolution model. "coins" is outgoing when its target is not
// "self". cull/trigger-cull are outgoing (handled via resolveRoundEffects path
// but also collected when deferred).
export const OUTGOING_KINDS = new Set(["neighbors_penalty", "neighbors_coins", "pirates"]);
export function isOutgoingEffect(effect) {
  if (!effect || !effect.kind) return false;
  if (effect.kind === "coins") {
    // perMetric coins always grant to the acting player (the metric may count
    // opponents, but the coins go to self); only flat coins with a non-self
    // target are outgoing.
    if (effect.perMetric) return false;
    return (effect.target || "self") !== "self";
  }
  return OUTGOING_KINDS.has(effect.kind);
}
// Decision-generating effects require a player choice before they can resolve.
export const DECISION_KINDS = new Set(["move_ship", "gain_island", "bury", "self_discard", "unearth", "mirror", "rome_play_leader", "edifice_patronage_choice"]);
export function isDecisionEffect(effect) {
  return !!(effect && DECISION_KINDS.has(effect.kind));
}
// Build a decision descriptor for a decision-generating effect.
export function makeDecision(effect, card, context) {
  const e = { ...effect };
  switch (effect.kind) {
    case "move_ship": return { type: "move_ship", amount: effect.amount || 1, color: effect.color || "any", cardId: card?.id || null, effect: e };
    case "gain_island": return { type: "gain_island", age: String(effect.age || "1"), cardId: card?.id || null, effect: e };
    case "bury": return { type: "bury", cardId: card?.id || null, effect: e };
    case "self_discard": return { type: "self_discard", mode: effect.mode || "card", color: effect.color || null, trophyAge: effect.trophyAge != null ? String(effect.trophyAge) : null, cardId: card?.id || null, effect: e };
    case "unearth": return { type: "unearth", cardId: card?.id || null, color: card?.color || null, effect: e };
    case "mirror": return { type: "mirror", cardId: card?.id || null, effect: e };
    case "rome_play_leader": return { type: "rome_leader", cardId: card?.id || null, effect: e };
    case "edifice_patronage_choice": return { type: "ur_edifice", cardId: card?.id || null, effect: e };
    default: return null;
  }
}

export function applyEffect(player, effect, card, allPlayers, allCardsById, context = {}) {
  if (!effect || typeof effect !== "object" || !effect.kind) {
    throw new Error(`Bad effect on "${card?.name || (card?.is_wonder ? "wonder stage" : "unknown")}" (player ${player?.player_name || "?"}): ${JSON.stringify(effect)}`);
  }
  // Queue model: defer outgoing effects to round end instead of applying now.
  if (context.deferOutgoing && isOutgoingEffect(effect)) {
    (context.outgoing = context.outgoing || []).push({ playerId: player.id, playerName: player.player_name, playerColor: player.player_color, seat: player.seat, effect: { ...effect }, cardId: card?.id || null, cardName: card?.name || null });
    return;
  }
  // Queue model: collect decision-generating effects as pending decisions
  // instead of auto-resolving them from a pre-stored choice.
  if (context.queueDecisions && isDecisionEffect(effect)) {
    const d = makeDecision(effect, card, context);
    if (d) (context.decisions = context.decisions || []).push(d);
    return;
  }
  switch (effect.kind) {
    // Coins are a RESOURCE: granted exactly once, here, when the effect enters.
    // They are never recomputed or revoked later.
    case "coins": {
      const tgt = effect.target || "self";
      if (effect.perMetric) {
        const cnt = tgt === "all"
          ? allPlayers.filter((q) => q.id !== player.id).reduce((s, p) => s + singleMetric(p, effect.perMetric, allCardsById, player, allPlayers), 0)
          : countMetric(player, effect.perMetric, tgt, allPlayers, allCardsById);
        grantCoins(player, (effect.amount || 0) * cnt, allCardsById, { ctx: context, cardName: card?.name });
      } else {
        const recips = tgt === "all" ? allPlayers.filter((q) => q.id !== player.id) : resolveTargets(player, tgt, allPlayers);
        for (const r of recips) {
          grantCoins(r, effect.amount || 0, allCardsById, { ctx: context, cardName: card?.name, fromName: r.id !== player.id ? player.player_name : null });
        }
      }
      break;
    }
    // VP is NOT a resource and is never granted/stored here. It is always
    // recomputed from current state in scorePlayer, so it tracks the table in
    // real time (and can go up or down as the underlying metric changes).
    case "vp":
      break;
    case "shields":
      player.shields = (player.shields || 0) + (effect.amount || 0);
      break;
    case "science":
      player.science_symbols = [...(player.science_symbols || []), effect.symbol || "script"];
      break;
    case "science_choice":
      player.science_symbols = [...(player.science_symbols || []), effect.most ? "__most__" : effect.spy ? "__spy__" : "__choice__"];
      break;
    case "chain":
      player.chain_symbols_owned = [...new Set([...(player.chain_symbols_owned || []), effect.chainSymbol])];
      break;
    case "trophy_on_enter": {
      const validAge = (a) => { const s = String(a); return s === "1" || s === "2" || s === "3"; };
      let age;
      if (effect.age === "current") {
        age = validAge(context?.age) ? String(context.age) : (validAge(card?.age) ? String(card.age) : "1");
      } else {
        age = validAge(effect.age) ? String(effect.age) : "1";
      }
      player.trophies = [...(player.trophies || []), { age, points: AGE_POINTS[age] || 0 }];
      pushNotif(context, player.id, { type: "trophy", age, cardName: card?.name, text: `Gained an Age ${age} trophy${card?.name ? ` — ${card.name}` : ""}` });
      break;
    }
    case "neighbors_penalty": {
      const n = allPlayers.length;
      const lN = allPlayers.find((q) => q.seat === (player.seat + 1) % n);
      const rN = allPlayers.find((q) => q.seat === (player.seat - 1 + n) % n);
      if (lN) { lN.penalties = (lN.penalties || 0) + 1; pushNotif(context, lN.id, { type: "penalty", amount: 1, fromId: player.id, fromName: player.player_name, fromColor: player.player_color, cardId: card?.id, cardName: card?.name, cardImage: card?.image_url, text: `Penalty from ${player.player_name}: +1 penalty` }); }
      if (rN) { rN.penalties = (rN.penalties || 0) + 1; pushNotif(context, rN.id, { type: "penalty", amount: 1, fromId: player.id, fromName: player.player_name, fromColor: player.player_color, cardId: card?.id, cardName: card?.name, cardImage: card?.image_url, text: `Penalty from ${player.player_name}: +1 penalty` }); }
      break;
    }
    case "neighbors_coins": {
      const n = allPlayers.length;
      const targets = effect.target === "all"
        ? allPlayers.filter((q) => q.id !== player.id)
        : [allPlayers.find((q) => q.seat === (player.seat + 1) % n), allPlayers.find((q) => q.seat === (player.seat - 1 + n) % n)].filter(Boolean);
      for (const t of targets) {
        grantCoins(t, effect.amount || 0, allCardsById, { ctx: context, cardName: card?.name, fromName: player.player_name });
      }
      break;
    }
    case "bury": {
      const leaders = (player.played_cards || []).filter((pc) => (allCardsById?.[pc.id] || pc).color === "leader");
      if (!leaders.length) break;
      let target;
      if (player.bury_leader_id) target = leaders.find((l) => l.id === player.bury_leader_id);
      if (!target) target = leaders.reduce((a, b) => effectiveCoinCost(allCardsById?.[b.id] || b) > effectiveCoinCost(allCardsById?.[a.id] || a) ? b : a);
      player.played_cards = (player.played_cards || []).filter((pc) => pc.id !== target.id);
      const gained = 2 * effectiveCoinCost(allCardsById?.[target.id] || target);
      player.bonus_vp = (player.bonus_vp || 0) + gained;
      break;
    }
    case "naval_shields":
      player.naval_shields = (player.naval_shields || 0) + (effect.amount || 0);
      break;
    case "naval_victory": {
      const a = effect.age || 0;
      player.naval_trophies = [...(player.naval_trophies || []), { age: String(a), points: NAVAL_VICTORY_POINTS[a] || 0 }];
      break;
    }
    case "move_ship": {
      // Move up to `amount` ships (different colors) one level each for free. A
      // specific color moves only that track (amount ignored). For "any", the
      // player's recorded `move_ship_choices` (array of colors) is used; any
      // unfilled slots fall back to the lowest-level non-maxed tracks.
      const max = Math.min(effect.amount || 1, 4);
      let cols;
      if (effect.color && effect.color !== "any") {
        cols = [effect.color];
      } else {
        const chosen = [...new Set((player.move_ship_choices || []).filter((c) => ARMADA_TRACKS.includes(c) && (player.armada_board?.[c]?.level || 1) < 7))];
        const used = new Set(chosen);
        const fillers = ARMADA_TRACKS.filter((c) => (player.armada_board?.[c]?.level || 1) < 7 && !used.has(c))
          .sort((a, b) => (player.armada_board?.[a]?.level || 1) - (player.armada_board?.[b]?.level || 1));
        cols = [...chosen, ...fillers].slice(0, max);
      }
      for (const col of cols) {
        applyArmadaMove(player, { color: col, free: true, islandId: null }, allPlayers, allCardsById, context?.islandPool, context);
      }
      break;
    }
    case "gain_island": {
      // Draw & play an island card of a chosen age, exactly like the green
      // Armada track reward. The player may pre-pick a specific island from
      // the age's pool (stored as player.island_choice via the Gain Island
      // dialog); otherwise one is drawn at random. Default to age "1" when
      // the effect has no age set (the editor defaults to Age 1 in the UI).
      const giAge = effect.age || "1";
      const move = player.island_choice ? { islandId: player.island_choice } : null;
      grantIsland(player, giAge, context?.islandPool, allPlayers, allCardsById, context, move);
      player.island_choice = null;
      break;
    }
    case "cleanse": {
      // Remove ALL of your military loss tokens (not naval defeats). Optionally
      // gain X coins per loss removed (effect.coinsPerLoss, default 0 = none).
      const count = (player.defeats || []).length;
      if (count > 0) {
        player.defeats = [];
        const per = effect.coinsPerLoss || 0;
        if (per > 0) { const gained = count * per; player.coins = (player.coins || 0) + gained; pushNotif(context, player.id, { type: "coin_gain", amount: gained, cardName: "Cleanse", text: `Gained ${gained} coins — Cleanse` }); }
      }
      break;
    }
    case "ship_move_coin":
      break;
    case "pirates": {
      for (const other of allPlayers) {
        if (other.id === player.id) continue;
        const amt = other.trade_level || 0;
        if (amt > 0) applyCull(other, amt, context, player, allCardsById);
      }
      break;
    }
    case "lose_coins": {
      // Lose only what you have; any shortfall converts to the age-based
      // penalty (2/3/5) issued ONCE — not per-coin. This is primarily used
      // for edifice penalties, where the age penalty is the real consequence.
      const amount = effect.amount || 0;
      const have = player.coins || 0;
      const lost = Math.min(have, amount);
      if (lost > 0) {
        player.coins = have - lost;
        if (context) pushNotif(context, player.id, { type: "coin_spend", amount: lost, cardName: card?.name || null, text: card?.name ? `Lost ${lost} coins — ${card.name}` : `Lost ${lost} coins` });
      }
      const shortfall = amount - lost;
      if (shortfall > 0) {
        const ageStr = String(context?.age || "");
        const penalty = { "1": 2, "2": 3, "3": 5 }[ageStr] || 1;
        player.penalties = (player.penalties || 0) + penalty;
        if (context) pushNotif(context, player.id, { type: "penalty", amount: penalty, text: `Could not pay ${shortfall} coin(s) — took ${penalty} penalty token(s)` });
      }
      break;
    }
    case "self_discard": {
      const ageStr = String(context?.age || "");
      const penalty = { "1": 2, "2": 3, "3": 5 }[ageStr] || 0;
      if (effect.mode === "trophy") {
        const trophies = player.trophies || [];
        let idx = -1;
        const raw = player.wonder_discard_choice;
        if (raw != null && raw !== "") {
          const ti = parseInt(raw, 10);
          if (Number.isFinite(ti) && ti >= 0 && ti < trophies.length) idx = ti;
        }
        if (idx < 0) {
          const eligible = effect.trophyAge != null && effect.trophyAge !== ""
            ? trophies.filter((t) => String(t.age) === String(effect.trophyAge))
            : trophies;
          // Fallback (AI / no explicit choice): discard the trophy worth the
          // fewest VP so the player loses the least.
          if (eligible.length) {
            let best = eligible[0];
            for (const t of eligible) if ((t.points || 0) < (best.points || 0)) best = t;
            idx = trophies.indexOf(best);
          }
        }
        if (idx >= 0) {
          player.trophies = trophies.filter((_, i) => i !== idx);
        } else if (penalty) {
          player.penalties = (player.penalties || 0) + penalty;
          pushNotif(context, player.id, { type: "penalty", amount: penalty, text: `Could not discard a trophy — took ${penalty} penalty token(s)` });
        }
      } else {
        const eligible = (player.played_cards || []).filter((c) => (allCardsById?.[c.id] || c).color === effect.color);
        const raw = player.wonder_discard_choice;
        let target = null;
        if (raw) target = eligible.find((c) => c.id === raw);
        if (!target && eligible.length) {
          // Fallback (AI / no explicit choice): discard the card whose removal
          // costs the fewest VP. Simulate scorePlayer with each candidate
          // removed and pick the one with the smallest VP loss.
          const baseScore = scorePlayer(player, allPlayers, allCardsById).total;
          let best = eligible[0];
          let bestLoss = Infinity;
          for (const c of eligible) {
            const clone = { ...player, played_cards: (player.played_cards || []).filter((pc) => pc.id !== c.id) };
            try { recomputeStaticEffects(clone, allCardsById); } catch (e) { /* ignore */ }
            const loss = baseScore - scorePlayer(clone, allPlayers, allCardsById).total;
            if (loss < bestLoss) { bestLoss = loss; best = c; }
          }
          target = best;
        }
        if (target) {
          player.played_cards = (player.played_cards || []).filter((c) => c.id !== target.id);
        } else if (penalty) {
          player.penalties = (player.penalties || 0) + penalty;
          pushNotif(context, player.id, { type: "penalty", amount: penalty, text: `Could not discard a ${effect.color} card — took ${penalty} penalty token(s)` });
        }
      }
      break;
    }
    case "armada_cost_reduction":
    case "free_first_per_color":
      break;
    case "diplomacy": case "naval_diplomacy": { let a = String(context?.age||""); if (a === "leader") a = "1"; if (a) { const k = effect.kind === "diplomacy" ? "diplomacy_ages" : "naval_diplomacy_ages"; player[k] = [...(player[k]||[]), a]; } break; }
    case "rome_draw_leaders": {
      // Rome (Night) stage 1: draw N leaders from the out-of-play leader deck
      // into the player's hand. The deck is supplied via context.leaderDeck
      // (mutated in place so the caller persists the depleted deck).
      const n = effect.amount || 4;
      const drawn = context?.leaderDeck ? context.leaderDeck.splice(0, n) : [];
      player.leaders_hand = [...(player.leaders_hand || []), ...drawn];
      if (context?.leaderDeck) player._leaderDeckDepleted = context.leaderDeck;
      break;
    }
    case "rome_play_leader": {
      // Rome (Night) stages 2-3: play the chosen leader (player.rome_leader_choice).
      // The leader's coin cost is charged with a 2-coin discount (on top of any
      // passive reduction), so trading for the wonder stage can affect affordability.
      const leaderId = player.rome_leader_choice;
      if (!leaderId) break;
      const leader = (player.leaders_hand || []).find((c) => c.id === leaderId);
      if (!leader) break;
      applyCardEffects(player, leader, allPlayers, allCardsById, context);
      player.played_cards = [...(player.played_cards || []), leader];
      player.leaders_hand = (player.leaders_hand || []).filter((c) => c.id !== leaderId);
      const gameAge = Number(context?.age) || 0;
      const cost = Math.max(0, leaderCoinCost(player, leader, allPlayers, gameAge) - 2);
      if (cost > 0) spendCoins(player, cost, context, leader.name);
      break;
    }
    default:
      break;
  }
}

// Apply a single edifice reward/penalty effect to a player. Edifice effects are
// resolved at completion (not "when played"), so flat VP is stored in bonus_vp
// (unlike card VP, which is recomputed from the tableau). `mult` repeats the
// effect (reward effects repeat per patronage token; penalties use mult=1).
// Ongoing VP effect kinds: these depend on the player's final city state, so
// they are stored on the player and evaluated at scoring time (not at edifice
// completion, when the city is still being built).
const ONGOING_VP_KINDS = new Set(["set_vp", "vp_per_island", "vp_if_ge", "vp_if_none", "vp_if_one", "trophy_pairs_vp", "vp_if_wonder_complete"]);
function isOngoingVpEffect(effect) {
  if (!effect || !effect.kind) return false;
  if (effect.kind === "vp" && effect.perMetric) return true;
  return ONGOING_VP_KINDS.has(effect.kind);
}

// Evaluate a single ongoing VP effect against the current player state.
// Returns the VP gained (without the patronage-token multiplier).
function evaluateOngoingVp(player, effect, allPlayers, allCardsById) {
  switch (effect.kind) {
    case "vp": {
      const cnt = countMetric(player, effect.perMetric, effect.target || "self", allPlayers, allCardsById);
      return (effect.amount || 0) * cnt;
    }
    case "set_vp":
      return (effect.amount || 0) * countSet(player, effect.set, allCardsById);
    case "vp_per_island": {
      const chosen = new Set(player.island_vp_choices || []);
      if (chosen.size === 0) return 0;
      const islandCount = (player.played_cards || []).filter((pc) => {
        const full = allCardsById[pc.id] || pc;
        const isIsland = full.is_island || full.pack === "island" || !full.color || full.color === "island";
        return isIsland && chosen.has(pc.id);
      }).length;
      return (effect.amount || 0) * islandCount;
    }
    case "vp_if_ge": {
      const self = metricValue(player, effect.metric, allCardsById);
      const nn = allPlayers.length;
      const lN = allPlayers.find((q) => q.seat === (player.seat + 1) % nn);
      const rN = allPlayers.find((q) => q.seat === (player.seat - 1 + nn) % nn);
      const lv = lN ? metricValue(lN, effect.metric, allCardsById) : -Infinity;
      const rv = rN ? metricValue(rN, effect.metric, allCardsById) : -Infinity;
      return (self >= lv && self >= rv) ? (effect.amount || 5) : 0;
    }
    case "vp_if_none":
      return metricValue(player, effect.metric, allCardsById) === 0 ? (effect.amount || 0) : 0;
    case "vp_if_one":
      return metricValue(player, effect.metric, allCardsById) === 1 ? (effect.amount || 0) : 0;
    case "trophy_pairs_vp": {
      let pairsVP = 0;
      for (const a of ["1", "2", "3"]) {
        const cnt = (player.trophies || []).filter((t) => String(t.age) === a).length;
        pairsVP += Math.floor(cnt / 2) * (AGE_POINTS[a] || 0);
      }
      return pairsVP;
    }
    case "vp_if_wonder_complete": {
      const w = getWonder(player.wonder, player.wonder_side);
      return ((player.wonder_stages_built || 0) >= (w.stages?.length || 0)) ? (effect.amount || 0) : 0;
    }
    default:
      return 0;
  }
}

export function applyEdificeEffect(player, effect, allPlayers, allCardsById, ctx, mult = 1) {
  if (!effect || typeof effect !== "object" || !effect.kind) return;
  // Ongoing VP effects are stored on the player and evaluated at scoring time.
  if (isOngoingVpEffect(effect)) {
    player.edifice_reward_effects = [...(player.edifice_reward_effects || []), { ...effect, _mult: mult }];
    pushNotif(ctx, player.id, { type: "edifice_reward", amount: mult, cardName: "Edifice", text: `Gained ongoing VP effect from edifice` });
    return;
  }
  switch (effect.kind) {
    case "vp": {
      const total = (effect.amount || 0) * mult;
      player.bonus_vp = (player.bonus_vp || 0) + total;
      if (total) pushNotif(ctx, player.id, { type: "edifice_reward", amount: total, cardName: "Edifice", text: `Gained ${total} VP from edifice` });
      break;
    }
    case "coins": {
      const amt = effect.amount || 0;
      const total = effect.perMetric
        ? amt * countMetric(player, effect.perMetric, "self", allPlayers, allCardsById) * mult
        : amt * mult;
      if (total) grantCoins(player, total, allCardsById, { ctx, cardName: "Edifice reward" });
      break;
    }
    case "shields": {
      const total = (effect.amount || 0) * mult;
      player.shields = (player.shields || 0) + total;
      if (total) pushNotif(ctx, player.id, { type: "edifice_reward", amount: total, cardName: "Edifice", text: `Gained ${total} shield(s) from edifice` });
      break;
    }
    case "naval_shields": {
      const total = (effect.amount || 0) * mult;
      player.naval_shields = (player.naval_shields || 0) + total; player.edifice_reward_effects = [...(player.edifice_reward_effects || []), { kind: "naval_shields", amount: total }];
      if (total) pushNotif(ctx, player.id, { type: "edifice_reward", amount: total, cardName: "Edifice", text: `Gained ${total} naval shield(s) from edifice` });
      break;
    }
    case "science": {
      const sym = effect.symbol || "script";
      for (let i = 0; i < mult; i++) player.science_symbols = [...(player.science_symbols || []), sym];
      pushNotif(ctx, player.id, { type: "edifice_reward", amount: mult, cardName: "Edifice", text: `Gained ${mult} science symbol(s) from edifice` });
      break;
    }
    case "trophy_on_enter": { const validAge = (a) => { const s = String(a); return s === "1" || s === "2" || s === "3"; }; const a = effect.age === "current" ? (validAge(ctx?.age) ? String(ctx.age) : "1") : (validAge(effect.age) ? String(effect.age) : "1"); for (let i = 0; i < mult; i++) player.trophies = [...(player.trophies || []), { age: a, points: AGE_POINTS[a] || 0 }]; break; }
    default: try { applyEffect(player, effect, null, allPlayers, allCardsById, ctx); } catch (e) { /* never stall */ }
  }
}

// Grant coins and log to the coin gain log. `trade` skips the notification.
// The coin gain bonus is applied at round end via applyCoinGainBonus.
export function grantCoins(player, amount, allCardsById, opts = {}) {
  if (!amount) return;
  player.coins = (player.coins || 0) + amount;
  if (amount > 0 && opts.ctx && !opts.trade && !opts.skipNotif) {
    const card = opts.cardName ? ` — ${opts.cardName}` : "";
    const from = opts.fromName ? ` from ${opts.fromName}` : "";
    pushNotif(opts.ctx, player.id, { type: "coin_gain", amount, cardName: opts.cardName || null, fromName: opts.fromName || null, text: `Gained ${amount} coins${card}${from}` });
  }
}

// Coin gain bonus: scan the coin gain log each round; first + grants the bonus.
export function applyCoinGainBonus(players, ctx, allCardsById) {
  const round = ctx.round != null ? Number(ctx.round) : null, age = ctx.age != null ? String(ctx.age) : null;
  for (const p of players) {
    let bonus = 0;
    for (const pc of p.played_cards || []) { const full = allCardsById?.[pc.id] || pc; for (const e of full.effects || []) if (e.kind === "coin_gain_bonus") bonus += (e.amount || 1); }
    const wonder = getWonder(p.wonder, p.wonder_side);
    for (let i = 0; i < (p.wonder_stages_built || 0); i++) { for (const e of builtStageEffects(p, wonder, i)) if (e.kind === "coin_gain_bonus") bonus += (e.amount || 1); }
    if (bonus <= 0) continue;
    const hadGain = (p.notifications || []).some(n => n.type === "coin_gain" && (n.amount || 0) > 0 && Number(n.round) === round && String(n.age) === age) || (ctx.notifs?.[p.id] || []).some(n => n.type === "coin_gain" && (n.amount || 0) > 0);
    if (hadGain) { p.coins = (p.coins || 0) + bonus; pushNotif(ctx, p.id, { type: "coin_gain", amount: bonus, cardName: "Coin gain bonus", text: `Coin gain bonus: +${bonus}` }); }
  }
}

// Does the player own an effect of the given kind (cards + built wonder stages)?
export function hasEffect(player, kind, allCardsById) {
  for (const pc of player.played_cards || []) {
    // Check both the map version and the inline card object — the inline
    // card (from played_cards) may carry effects the map version lacks
    // (e.g. a just-played card whose library entry is partial/stale).
    const fromMap = allCardsById?.[pc.id];
    for (const src of [fromMap, pc]) {
      if (!src) continue;
      for (const e of src.effects || []) if (e.kind === kind) return true;
    }
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) if (e.kind === kind) return true;
  }
  return false;
}

// Free Cards Per Age: once per age, a qualifying card can be played for free
// (no resource/coin cost, no trade) when it's unaffordable, or instead of
// trading. `scope`: "black" (a black card), "first" (first card played this
// age), "last" (final normally-played card this age). Returns true if the
// ability is present, unused this age, and the card qualifies.
export function canFreeCard(player, card, game, allCardsById) {
  if (!game || game.age === "leader" || game.phase !== "choosing") return false;
  let scope = null;
  for (const pc of player.played_cards || []) {
    for (const e of (allCardsById?.[pc.id] || pc).effects || []) {
      if (e.kind === "free_cards_per_age") scope = e.scope || "black";
    }
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) {
      if (e.kind === "free_cards_per_age") scope = e.scope || "black";
    }
  }
  if (!scope) return false;
  if ((player.free_card_used || {})[game.age]) return false;
  if (scope === "black") return card.color === "black";
  if (scope === "first") return (game.round || 0) === 0;
  if (scope === "last") return (player.hand || []).length <= 2;
  return false;
}

// Free First Card Per Color: once per age per color, the first card of a
// qualifying color can be played for free (no resource/coin cost, no trade).
// A player may own several of these (one per color). Returns true if an unused
// instance for the card's color exists this age.
export function canFreeFirstPerColor(player, card, game, allCardsById) {
  if (!game || game.age === "leader" || game.phase !== "choosing") return false;
  const colors = new Set();
  const collect = (effects) => {
    for (const e of effects || []) if (e.kind === "free_first_per_color" && e.color) colors.add(e.color);
  };
  for (const pc of player.played_cards || []) collect((allCardsById?.[pc.id] || pc).effects);
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) collect(builtStageEffects(player, wonder, i));
  if (!colors.has(card.color)) return false;
  const used = player.free_colors_used || {};
  const key = `${game.age}:${card.color}`;
  return !used[key];
}

// Armada cost reduction: each instance grants a 1-resource discount (of any
// type) toward a single Armada ship move per instance. Returns the number of
// available discounts the player owns.
export function armadaCostReductions(player, allCardsById) {
  let count = 0;
  for (const pc of player.played_cards || []) {
    const full = allCardsById?.[pc.id] || pc;
    for (const e of full.effects || []) if (e.kind === "armada_cost_reduction") count += e.amount || 1;
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) if (e.kind === "armada_cost_reduction") count += e.amount || 1;
  }
  return count;
}

// Reduce a card's/wonder tier's/ship move's resource cost by 1 per
// "cost_reduction" effect the player owns. Each effect targets exactly one
// kind of cost via `appliesTo`: "card" (a colored card), "wonder" (a wonder
// tier), or "ship" (an Armada ship move). A "card"/"ship" effect may also
// specify a color to narrow further. An effect only ever reduces the cost of
// its selected target — never a wonder tier in addition to cards.
function collectCostReductions(player, card, allCardsById) {
  const out = [];
  const isWonder = !!card.is_wonder;
  const isShip = !!card.is_ship;
  const matches = (e) => {
    const appliesTo = e.appliesTo || "card";
    if (isWonder) return appliesTo === "wonder";
    if (isShip) return appliesTo === "ship" && (!e.color || e.color === "any" || e.color === card.color);
    // For cards: a "card" effect applies to cards of that color (or any if no color).
    // A "ship" effect with a SPECIFIC color (not "any") also discounts cards of
    // that color — so a "red ship" reduction also makes red cards cheaper.
    if (appliesTo === "ship") return e.color && e.color !== "any" && e.color === card.color;
    if (appliesTo !== "card") return false;
    return !e.color || e.color === card.color;
  };
  for (const pc of player.played_cards || []) {
    const full = allCardsById?.[pc.id] || pc;
    for (const e of full.effects || []) if (e.kind === "cost_reduction" && matches(e)) out.push(e);
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) if (e.kind === "cost_reduction" && matches(e)) out.push(e);
  }
  return out;
}

// Does any matching cost_reduction effect have the "free" flag? When true, the
// entire resource AND coin cost of the selected target is waived.
export function isCostFree(player, card, allCardsById) {
  const reductions = collectCostReductions(player, card, allCardsById);
  return reductions.some((e) => e.free);
}

function applyCostReductions(player, card, need, allCardsById) {
  const out = { ...need };
  const reductions = collectCostReductions(player, card, allCardsById);
  if (reductions.length === 0) return out;
  // "Free" flag: zero out the entire resource cost.
  if (reductions.some((e) => e.free)) {
    for (const k of Object.keys(out)) out[k] = 0;
    return out;
  }
  const { fixed } = getProducibleResources(player, allCardsById);
  for (const e of reductions) {
    const keys = Object.keys(out).filter((k) => out[k] > 0);
    if (keys.length === 0) break;
    keys.sort((a, b) => (out[b] - (fixed[b] || 0)) - (out[a] - (fixed[a] || 0)));
    out[keys[0]] = Math.max(0, out[keys[0]] - 1);
  }
  return out;
}

function metricValue(player, metric, allCardsById) {
  if (metric && metric.startsWith("color:")) return countByColor(player, metric.slice(6), allCardsById);
  if (metric === "coins") return player.coins || 0;
  if (metric === "trophies") return (player.trophies || []).length;
  if (metric === "losses") return (player.defeats || []).length;
  return 0;
}

export function countEffects(player, kind, allCardsById) {
  let count = 0;
  for (const pc of player.played_cards || []) {
    const full = allCardsById?.[pc.id] || pc;
    for (const e of full.effects || []) if (e.kind === kind) count++;
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) if (e.kind === kind) count++;
  }
  return count;
}

// For the trade UI: resources still missing after self-production (and supply
// credits), and which neighbors can supply each.
export function getTradeInfo(player, card, leftNeighbor, rightNeighbor, allCardsById, pools = null) {
  const { fixed, choices } = pools ? { fixed: pools.fixed, choices: pools.choices } : getProducibleResources(player, allCardsById);
  const need = applyCostReductions(player, card, { ...(card.cost_resources || {}) }, allCardsById);
  const fixedPool = { ...fixed };
  const remaining = emptyRes();
  for (const r of Object.keys(need)) {
    let amt = need[r] || 0;
    const use = Math.min(amt, fixedPool[r] || 0);
    fixedPool[r] -= use;
    amt -= use;
    if (amt > 0) remaining[r] = amt;
  }
  const best = satisfyWithChoices(remaining, choices);
  const missing = best.satisfied ? {} : { ...best.missing };
  let supplyLeft = countEffects(player, "supply_trade", allCardsById);
  if (supplyLeft > 0) {
    for (const r of Object.keys(missing)) {
      while (missing[r] > 0 && supplyLeft > 0) { missing[r] -= 1; supplyLeft -= 1; }
    }
  }
  const sources = {};
  const availability = {};
  const slotCount = (nbr, r) => {
    if (!nbr) return 0;
    const { tradeableFixed, tradeableChoices } = getProducibleResources(nbr, allCardsById);
    return (tradeableFixed[r] || 0) + tradeableChoices.filter((c) => c.includes(r)).length;
  };
  for (const r of Object.keys(missing)) {
    if (missing[r] <= 0) continue;
    const list = [];
    const av = {};
    const lAv = slotCount(leftNeighbor, r);
    const rAv = slotCount(rightNeighbor, r);
    if (lAv > 0) { list.push("left"); av.left = lAv; }
    if (rAv > 0) { list.push("right"); av.right = rAv; }
    if (list.length) { sources[r] = list; availability[r] = av; }
  }
  return { missing, sources, availability };
}

// Apply a trade plan: deduct coins from the buyer, pay neighbors (trade source,
// so no coin-gain bonus), and grant the buyer's trade-bonus coins.
export function applyTrade(player, tradePlan, allPlayers, allCardsById, ctx) {
  if (!tradePlan || tradePlan.length === 0) return;
  const n = allPlayers.length;
  const left = allPlayers.find((q) => q.seat === (player.seat + 1) % n);
  const right = allPlayers.find((q) => q.seat === (player.seat - 1 + n) % n);
  const tradedSides = new Set();
  const tradeIncome = {}; // neighborId -> coins received from this trade
  for (const t of tradePlan) {
    spendCoins(player, t.cost || 0, ctx, "Trade");
    let neighbor;
    if (t.side === "left") { neighbor = left; tradedSides.add("left"); }
    else if (t.side === "right") { neighbor = right; tradedSides.add("right"); }
    else if (t.side === "far") { neighbor = allPlayers.find((q) => q.seat === t.seat); }
    if (neighbor) {
      grantCoins(neighbor, t.cost || 0, allCardsById, { trade: true });
      tradeIncome[neighbor.id] = (tradeIncome[neighbor.id] || 0) + (t.cost || 0);
    }
  }
  for (const [nid, amt] of Object.entries(tradeIncome)) {
    if (amt > 0) pushNotif(ctx, nid, { type: "trade", amount: amt, fromId: player.id, fromName: player.player_name, fromColor: player.player_color, text: `Received ${amt} coins from ${player.player_name} in trade` });
  }
  const bonus = countEffects(player, "trade_bonus", allCardsById);
  if (bonus > 0 && tradedSides.size > 0) grantCoins(player, tradedSides.size * bonus, allCardsById, { ctx, cardName: "Trade bonus" });
}

// Deduct coins from a player, clamping at zero. Any shortfall (coins they
// didn't have) becomes penalty tokens (-1 VP each) instead of going negative.
export function spendCoins(player, amount, ctx, cardName) {
  if (!amount || amount <= 0) return;
  const have = player.coins || 0;
  const lost = Math.min(have, amount);
  player.coins = have - lost;
  if (lost > 0 && ctx) {
    pushNotif(ctx, player.id, {
      type: "coin_spend", amount: lost,
      cardName: cardName || null,
      text: cardName ? `Spent ${lost} coins — ${cardName}` : `Spent ${lost} coins`,
    });
  }
  const shortfall = amount - lost;
  if (shortfall > 0) {
    player.penalties = (player.penalties || 0) + shortfall;
    pushNotif(ctx, player.id, {
      type: "penalty", amount: shortfall,
      text: `Could not pay ${shortfall} coin(s) — took ${shortfall} penalty token(s)`,
    });
  }
}

// Cull: a player loses `amount` coins. Any shortfall (coins they didn't have)
// becomes penalty tokens (-1 VP each). Targets with "coin_loss_immunity" are
// unaffected by opponent-sourced coin loss (their own self-costs still apply).
export function applyCull(target, amount, ctx, source, allCardsById) {
  if (amount <= 0) return;
  if (source && source.id !== target.id && hasEffect(target, "coin_loss_immunity", allCardsById)) {
    pushNotif(ctx, target.id, { type: "immunity", amount, fromId: source?.id, fromName: source?.player_name, text: `Protected from ${source?.player_name || "an opponent"}'s coin loss` });
    return;
  }
  const have = target.coins || 0;
  const lost = Math.min(have, amount);
  target.coins = have - lost;
  const shortfall = amount - lost;
  if (shortfall > 0) target.penalties = (target.penalties || 0) + shortfall;
  if (lost > 0 || shortfall > 0) {
    pushNotif(ctx, target.id, {
      type: "cull", amount: lost, shortfall,
      fromId: source?.id, fromName: source?.player_name, fromColor: source?.player_color,
      text: `Lost ${lost} coins to ${source?.player_name || "an opponent"}'s cull${shortfall ? ` (+${shortfall} penalty)` : ""}`,
    });
    if (lost > 0) pushNotif(ctx, target.id, { type: "coin_spend", amount: lost, cardName: "Cull", text: `Spent ${lost} coins — Cull` });
  }
}

// Does a trigger effect match this round's events?
export function matchTrigger(effect, ev) {
  if (!ev) return false;
  switch (effect.triggerType) {
    case "color": return (ev.colors || []).includes(effect.triggerColor);
    case "wonder_stage": return !!ev.builtStage;
    case "trophy": return !!ev.gainedTrophy;
    case "discard": return !!ev.discarded;
    default: return false;
  }
}

// Number of complete sets of the chosen items (colors and/or science symbols).
export function countSet(player, set, allCardsById) {
  if (!set || set.length === 0) return 0;
  const syms = player.science_symbols || [], wild = syms.filter((s) => s === "__choice__" || s === "__most__" || s === "__spy__").length;
  const counts = set.map((item) => item.startsWith("color:") ? countByColor(player, item.slice(6), allCardsById) : item.startsWith("science:") ? syms.filter((s) => s === item.slice(8)).length : 0);
  if (wild > 0) { const si = set.map((it, i) => it.startsWith("science:") ? i : -1).filter((i) => i >= 0); let r = wild; while (r > 0 && si.length) { let m = si[0]; for (const i of si) if (counts[i] < counts[m]) m = i; counts[m]++; r--; } }
  return Math.min(...counts);
}

// Second pass of a round: apply immediate cull effects (from cards played this
// round), persistent trigger effects, and chain-free bonuses. `events` maps
// player id -> { colors, builtStage, discarded, chained, gainedTrophy, playedCardId }.
export function resolveRoundEffects(players, events, allCardsById, ctx) {
  for (const p of players) {
    const ev = events[p.id] || {};
    if (ev.chained) {
      for (const pc of p.played_cards || []) {
        const full = allCardsById[pc.id] || pc;
        for (const e of full.effects || []) {
          if (e.kind === "chain_bonus") grantCoins(p, e.amount || 0, allCardsById, { ctx, cardName: "Chain bonus" });
        }
      }
    }
    for (const pc of p.played_cards || []) {
      const full = allCardsById[pc.id] || pc;
      for (const e of full.effects || []) {
        if (e.kind === "trigger" && matchTrigger(e, ev)) {
          grantCoins(p, e.coins || 0, allCardsById, { ctx, cardName: full?.name });
          let culls = e.culls ?? 0;
          if (culls === -1) culls = Number(ctx?.age) || 0;
          if (culls > 0) for (const other of players) if (other.id !== p.id) applyCull(other, culls, ctx, p, allCardsById);
        }
      }
    }
    if (ev.playedCardId) {
      const card = (p.played_cards || []).find((c) => c.id === ev.playedCardId) || allCardsById[ev.playedCardId];
      for (const e of (card?.effects || [])) {
        if (e.kind === "cull") {
          let culls = e.culls ?? 0;
          if (e.perMetric) culls = (e.culls || 0) * countMetric(p, e.perMetric, "self", players, allCardsById);
          if (culls === -1) culls = Number(ctx?.age) || 0;
          if (culls > 0) for (const other of players) if (other.id !== p.id) applyCull(other, culls, ctx, p, allCardsById);
        }
      }
    }
  }
}

export function countMetric(player, metric, target, allPlayers, allCardsById) {
  // "neighbor_*" metrics are relative to the card OWNER (the original player),
  // not the resolved target. Evaluate once against the original player so
  // target "self" / "both" / "all" all give the same correct neighbor count
  // (avoiding double-counting when target is "both" or "all").
  if (metric && metric.startsWith("neighbor_")) {
    return singleMetric(player, metric, allCardsById, player, allPlayers);
  }
  const targets = resolveTargets(player, target, allPlayers);
  return targets.reduce((sum, p) => sum + singleMetric(p, metric, allCardsById, player, allPlayers), 0);
}

export function resolveTargets(player, target, allPlayers) {
  const n = allPlayers.length;
  const seat = player.seat;
  const left = allPlayers.find((p) => p.seat === (seat + 1) % n);
  const right = allPlayers.find((p) => p.seat === (seat - 1 + n) % n);
  switch (target) {
    case "left": return [left].filter(Boolean);
    case "right": return [right].filter(Boolean);
    case "both": return [left, right].filter(Boolean);
    case "all": return allPlayers;
    default: return [player];
  }
}

function neighborColorCount(originalPlayer, color, allPlayers, allCardsById) {
  if (!allPlayers || !originalPlayer) return 0;
  const nn = allPlayers.length;
  const lN = allPlayers.find((q) => q.seat === (originalPlayer.seat + 1) % nn);
  const rN = allPlayers.find((q) => q.seat === (originalPlayer.seat - 1 + nn) % nn);
  return (lN ? countByColor(lN, color, allCardsById) : 0) + (rN ? countByColor(rN, color, allCardsById) : 0);
}

function singleMetric(player, metric, allCardsById, originalPlayer, allPlayers) {
  switch (metric) {
    case "brown_card": return countByColor(player, "brown", allCardsById);
    case "gray_card": return countByColor(player, "gray", allCardsById);
    case "blue_card": return countByColor(player, "blue", allCardsById);
    case "yellow_card": return countByColor(player, "yellow", allCardsById);
    case "red_card": return countByColor(player, "red", allCardsById);
    case "green_card": return countByColor(player, "green", allCardsById);
    case "purple_card": return countByColor(player, "purple", allCardsById);
    case "black_card": return countByColor(player, "black", allCardsById);
    case "wonder_stage": return player.wonder_stages_built || 0;
    case "neighbor_wonder_stages": {
      if (!allPlayers || !originalPlayer) return 0;
      const nn = allPlayers.length;
      const lN = allPlayers.find((q) => q.seat === (originalPlayer.seat + 1) % nn);
      const rN = allPlayers.find((q) => q.seat === (originalPlayer.seat - 1 + nn) % nn);
      return (lN?.wonder_stages_built || 0) + (rN?.wonder_stages_built || 0);
    }
    case "military_victory": return (player.trophies || []).length;
    case "military_defeat": return (player.defeats || []).length;
    case "raw_resource": return countRaw(player, allCardsById);
    case "manufactured_resource": return countManufactured(player, allCardsById);
    case "science_symbol": return (player.science_symbols || []).length;
    case "chain_symbol": return (player.chain_symbols_owned || []).length;
    case "coins": return player.coins || 0;
    case "coins_third": return Math.floor((player.coins || 0) / 3);
    case "trophy_age1": return (player.trophies || []).filter((t) => String(t.age) === "1").length;
    case "trophy_age2": return (player.trophies || []).filter((t) => String(t.age) === "2").length;
    case "trophy_age3": return (player.trophies || []).filter((t) => String(t.age) === "3").length;
    case "neighbor_brown": return neighborColorCount(originalPlayer, "brown", allPlayers, allCardsById);
    case "neighbor_gray": return neighborColorCount(originalPlayer, "gray", allPlayers, allCardsById);
    case "neighbor_guild": return neighborColorCount(originalPlayer, "purple", allPlayers, allCardsById);
    case "neighbor_green": return neighborColorCount(originalPlayer, "green", allPlayers, allCardsById);
    case "neighbor_blue": return neighborColorCount(originalPlayer, "blue", allPlayers, allCardsById);
    case "neighbor_yellow": return neighborColorCount(originalPlayer, "yellow", allPlayers, allCardsById);
    case "neighbor_red": return neighborColorCount(originalPlayer, "red", allPlayers, allCardsById);
    case "neighbor_black": return neighborColorCount(originalPlayer, "black", allPlayers, allCardsById);
    case "neighbor_leader": return neighborColorCount(originalPlayer, "leader", allPlayers, allCardsById);
    case "own_resources": return countTotalResources(player, allCardsById);
    case "islands": return getIslands(player, allCardsById).length;
    case "own_card_name": return countByName(player, allCardsById, originalPlayer?._effectCardName);
    case "trade_level": return player.trade_level || 0;
    case "leader_card": return countByColor(player, "leader", allCardsById);
    case "naval_victory": return (player.naval_trophies || []).length;
    case "most_color": {
      const cols = ["brown", "gray", "green", "blue", "yellow", "red", "purple", "black", "leader"];
      return cols.reduce((m, c) => Math.max(m, countByColor(player, c, allCardsById)), 0);
    }
    default: return 0;
  }
}

function countRaw(player, allCardsById) {
  let c = 0;
  for (const card of player.played_cards || []) {
    const full = allCardsById[card.id] || card;
    for (const e of full.effects || []) {
      if ((e.kind === "resource" || e.kind === "resource_choice") && e.resources?.some((r) => RAW_RESOURCES.includes(r))) c++;
    }
  }
  return c;
}
function countManufactured(player, allCardsById) {
  let c = 0;
  for (const card of player.played_cards || []) {
    const full = allCardsById[card.id] || card;
    for (const e of full.effects || []) {
      if ((e.kind === "resource" || e.kind === "resource_choice") && e.resources?.some((r) => MANUFACTURED_RESOURCES.includes(r))) c++;
    }
  }
  return c;
}
function countTotalResources(player, allCardsById) {
  const { fixed } = getProducibleResources(player, allCardsById);
  return Object.values(fixed).reduce((a, b) => a + b, 0);
}
function countByName(player, allCardsById, name) {
  if (!name) return 0;
  return (player.played_cards || []).filter((c) => {
    const full = allCardsById[c.id] || c;
    return full.name === name;
  }).length;
}

// ---------- Science scoring (optimal) ----------
export function computeOptimalScience(symbols, opts = {}) {
  // symbols may include "__choice__" (wild), "__most__" (your majority type), and
  // "__spy__" (copy a neighbor's symbol — constrained to opts.spyTypes).
  // Returns { score, assignment, wildAssignments } where wildAssignments lists
  // each wild token's resolved symbol, in original symbol order.
  const spyTypes = (opts.spyTypes && opts.spyTypes.length)
    ? opts.spyTypes.filter((s) => s === "script" || s === "gear" || s === "mason")
    : [];
  const counts = { script: 0, gear: 0, mason: 0 };
  for (const s of symbols) if (s === "script" || s === "gear" || s === "mason") counts[s]++;

  // Greedy "most" tokens (assign to current majority; ties → script > gear > mason).
  const mostCount = symbols.filter((s) => s === "__most__").length;
  const mostAssignments = [];
  for (let i = 0; i < mostCount; i++) {
    let top = "script";
    for (const k of ["gear", "mason"]) if (counts[k] > counts[top]) top = k;
    counts[top]++;
    mostAssignments.push(top);
  }

  // Search wilds: "__choice__" (any of 3) and "__spy__" (spyTypes only), in order.
  const wilds = [];
  for (const s of symbols) {
    if (s === "__choice__") wilds.push(["script", "gear", "mason"]);
    else if (s === "__spy__") wilds.push(spyTypes);
  }
  const n = wilds.length;
  const assign = new Array(n).fill(null);
  const scoreNow = () => counts.script ** 2 + counts.gear ** 2 + counts.mason ** 2 + 7 * Math.min(counts.script, counts.gear, counts.mason);
  let best = -1, bestCounts = null, bestAssign = null;
  const rec = (i) => {
    if (i === n) {
      const sc = scoreNow();
      if (sc > best) { best = sc; bestCounts = { ...counts }; bestAssign = [...assign]; }
      return;
    }
    if (wilds[i].length === 0) { rec(i + 1); return; } // spy with no neighbor types → useless
    for (const k of wilds[i]) { counts[k]++; assign[i] = k; rec(i + 1); counts[k]--; assign[i] = null; }
  };
  rec(0);
  if (best < 0) { best = scoreNow(); bestCounts = { ...counts }; bestAssign = []; }

  // Map back to per-wild assignments in original symbol order.
  let ci = 0, mi = 0;
  const wildAssignments = [];
  symbols.forEach((s, idx) => {
    if (s === "__most__") wildAssignments.push({ idx, kind: "most", symbol: mostAssignments[mi++] || null });
    else if (s === "__choice__") wildAssignments.push({ idx, kind: "choice", symbol: bestAssign ? bestAssign[ci++] : null });
    else if (s === "__spy__") wildAssignments.push({ idx, kind: "spy", symbol: bestAssign ? bestAssign[ci++] : null });
  });
  return { score: best, assignment: bestCounts, wildAssignments };
}

// For banner display: maps each science_choice card id → the science symbol it
// currently counts as (optimal assignment). Recomputed from played cards.
export function getScienceCardAssignments(player, allPlayers, allCardsById) {
  const items = []; // { cardId, symbol, choice }
  for (const pc of player.played_cards || []) {
    const c = allCardsById[pc.id] || pc;
    for (const e of c.effects || []) {
      if (e.kind === "science") items.push({ cardId: c.id, symbol: e.symbol || "script", choice: false });
      else if (e.kind === "science_choice") {
        const sym = e.most ? "__most__" : e.spy ? "__spy__" : "__choice__";
        items.push({ cardId: c.id, symbol: sym, choice: true });
      }
    }
  }
  if (items.length === 0) return {};
  const symbols = items.map((it) => it.symbol);
  const n = allPlayers.length;
  const lN = allPlayers.find((q) => q.seat === (player.seat + 1) % n);
  const rN = allPlayers.find((q) => q.seat === (player.seat - 1 + n) % n);
  const spyTypes = [];
  const seen = new Set();
  for (const nb of [lN, rN]) {
    if (!nb) continue;
    for (const s of (nb.science_symbols || [])) {
      if ((s === "script" || s === "gear" || s === "mason") && !seen.has(s)) { seen.add(s); spyTypes.push(s); }
    }
  }
  const { wildAssignments } = computeOptimalScience(symbols, { spyTypes });
  const byIdx = {};
  for (const w of wildAssignments) byIdx[w.idx] = w.symbol;
  const map = {};
  items.forEach((it, idx) => {
    if (!it.choice) return;
    const sym = byIdx[idx];
    if (sym) (map[it.cardId] ||= []).push(sym);
  });
  return map;
}

// ---------- Full scoring ----------
// Compute the VP contribution of a single card's effect-based VP only (vp,
// set_vp, vp_per_island, vp_if_ge, vp_if_none, vp_if_one, trophy_pairs_vp,
// vp_if_wonder_complete). Used by the Double Purple effect to find the
// highest-scoring purple card. Coins/science/military/wonder are not per-card.
function singleCardVP(player, card, allPlayers, allCardsById) {
  const effects = card.effects || [];
  let vp = 0;
  for (const e of effects) {
    if (e.kind === "vp" && !e.perMetric) vp += e.amount || 0;
    if (e.kind === "vp" && e.perMetric) {
      const cnt = countMetric(player, e.perMetric, e.target || "self", allPlayers, allCardsById);
      vp += (e.amount || 0) * cnt;
    }
    if (e.kind === "set_vp") {
      const sets = countSet(player, e.set, allCardsById);
      vp += (e.amount || 0) * sets;
    }
    if (e.kind === "vp_per_island") {
      const chosen = new Set(player.island_vp_choices || []);
      if (chosen.size > 0) {
        const islandCount = (player.played_cards || []).filter((pc) => {
          const full = allCardsById[pc.id] || pc;
          const isIsland = full.is_island || full.pack === "island" || !full.color || full.color === "island";
          return isIsland && chosen.has(pc.id);
        }).length;
        vp += (e.amount || 0) * islandCount;
      }
    }
    if (e.kind === "vp_if_ge") {
      const self = metricValue(player, e.metric, allCardsById);
      const nn = allPlayers.length;
      const lN = allPlayers.find((q) => q.seat === (player.seat + 1) % nn);
      const rN = allPlayers.find((q) => q.seat === (player.seat - 1 + nn) % nn);
      const lv = lN ? metricValue(lN, e.metric, allCardsById) : -Infinity;
      const rv = rN ? metricValue(rN, e.metric, allCardsById) : -Infinity;
      if (self >= lv && self >= rv) vp += e.amount || 5;
    }
    if (e.kind === "vp_if_none" && metricValue(player, e.metric, allCardsById) === 0) vp += e.amount || 0;
    if (e.kind === "vp_if_one" && metricValue(player, e.metric, allCardsById) === 1) vp += e.amount || 0;
    if (e.kind === "trophy_pairs_vp") {
      for (const a of ["1", "2", "3"]) {
        const cnt = (player.trophies || []).filter((t) => String(t.age) === a).length;
        vp += Math.floor(cnt / 2) * (AGE_POINTS[a] || 0);
      }
    }
    if (e.kind === "vp_if_wonder_complete") {
      const w = getWonder(player.wonder, player.wonder_side);
      if ((player.wonder_stages_built || 0) >= (w.stages?.length || 0)) vp += e.amount || 0;
    }
  }
  return vp;
}

export function scorePlayer(player, allPlayers, allCardsById) {
  const cards = (player.played_cards || []).map((c) => { const full = allCardsById[c.id] || c; return { ...full, effects: resolvedEffectsFor(player, full, allCardsById) }; });
  let vp = 0;
  const breakdown = {};

  // Blue card flat VP
  for (const c of cards) {
    for (const e of c.effects || []) {
      if (e.kind === "vp" && !e.perMetric) { vp += e.amount || 0; breakdown["Blue/Civilian VP"] = (breakdown["Blue/Civilian VP"] || 0) + (e.amount || 0); }
      if (e.kind === "vp" && e.perMetric) {
        const cnt = countMetric(player, e.perMetric, e.target || "self", allPlayers, allCardsById);
        const gained = (e.amount || 0) * cnt;
        vp += gained;
        breakdown[`VP per ${e.perMetric}`] = (breakdown[`VP per ${e.perMetric}`] || 0) + gained;
      }
      // Coin-grant effects are intentionally NOT re-evaluated here: they were
      // applied once at entry (applyEffect). Only their coins feed VP via the
      // 1-VP-per-3-coins rule below. per-metric VP below is recomputed live.
    }
  }

  // Set VP: X VP per complete set of chosen colors/science symbols.
  for (const c of cards) {
    for (const e of c.effects || []) {
      if (e.kind === "set_vp") {
        const sets = countSet(player, e.set, allCardsById);
        const gained = (e.amount || 0) * sets;
        vp += gained;
        breakdown["Sets"] = (breakdown["Sets"] || 0) + gained;
      }
    }
  }

  // VP per chosen island: the player selects which of their island cards count.
  for (const c of cards) {
    for (const e of c.effects || []) {
      if (e.kind === "vp_per_island") {
        const chosen = new Set(player.island_vp_choices || []);
        if (chosen.size === 0) continue;
        const islandCount = (player.played_cards || []).filter((pc) => {
          const full = allCardsById[pc.id] || pc;
          const isIsland = full.is_island || full.pack === "island" || !full.color || full.color === "island";
          return isIsland && chosen.has(pc.id);
        }).length;
        const gained = (e.amount || 0) * islandCount;
        vp += gained;
        breakdown["Islands"] = (breakdown["Islands"] || 0) + gained;
      }
    }
  }

  // Science — spy tokens copy a neighbor's symbol; gather concrete neighbor types.
  const _spyTypes = [];
  {
    const seen = new Set();
    const _n = allPlayers.length;
    for (const nb of [allPlayers.find((q) => q.seat === (player.seat + 1) % _n), allPlayers.find((q) => q.seat === (player.seat - 1 + _n) % _n)]) {
      if (!nb) continue;
      for (const s of (nb.science_symbols || [])) {
        if ((s === "script" || s === "gear" || s === "mason") && !seen.has(s)) { seen.add(s); _spyTypes.push(s); }
      }
    }
  }
  const sci = computeOptimalScience(player.science_symbols || [], { spyTypes: _spyTypes });
  vp += sci.score;
  breakdown["Science"] = sci.score;

  // Military
  const mil = (player.trophies || []).reduce((s, t) => s + (t.points || 0), 0) - (player.defeats || []).length;
  vp += mil;
  breakdown["Military"] = mil;

  // Penalty tokens: -1 VP each
  const penaltyVP = -(player.penalties || 0);
  vp += penaltyVP;
  breakdown["Penalties"] = penaltyVP;

  // VP if your metric is equal-or-greater than each neighbor; VP if you have none
  // of a metric; and VP per pair of identical trophies.
  for (const c of cards) {
    for (const e of c.effects || []) {
      if (e.kind === "vp_if_ge") {
        const self = metricValue(player, e.metric, allCardsById);
        const nn = allPlayers.length;
        const lN = allPlayers.find((q) => q.seat === (player.seat + 1) % nn);
        const rN = allPlayers.find((q) => q.seat === (player.seat - 1 + nn) % nn);
        const lv = lN ? metricValue(lN, e.metric, allCardsById) : -Infinity;
        const rv = rN ? metricValue(rN, e.metric, allCardsById) : -Infinity;
        if (self >= lv && self >= rv) {
          const gained = e.amount || 5;
          vp += gained;
          breakdown["Compare VP"] = (breakdown["Compare VP"] || 0) + gained;
        }
      }
      if (e.kind === "vp_if_none" && metricValue(player, e.metric, allCardsById) === 0) {
        const gained = e.amount || 0;
        vp += gained;
        breakdown["None VP"] = (breakdown["None VP"] || 0) + gained;
      }
      if (e.kind === "vp_if_one" && metricValue(player, e.metric, allCardsById) === 1) {
        const gained = e.amount || 0;
        vp += gained;
        breakdown["One VP"] = (breakdown["One VP"] || 0) + gained;
      }
      if (e.kind === "trophy_pairs_vp") {
        let pairsVP = 0;
        for (const a of ["1", "2", "3"]) {
          const cnt = (player.trophies || []).filter((t) => String(t.age) === a).length;
          pairsVP += Math.floor(cnt / 2) * (AGE_POINTS[a] || 0);
        }
        vp += pairsVP;
        breakdown["Trophy Pairs"] = (breakdown["Trophy Pairs"] || 0) + pairsVP;
      }
      if (e.kind === "vp_if_wonder_complete") {
        const w = getWonder(player.wonder, player.wonder_side);
        if ((player.wonder_stages_built || 0) >= (w.stages?.length || 0)) {
          const gained = e.amount || 0;
          vp += gained;
          breakdown["Wonder Complete"] = (breakdown["Wonder Complete"] || 0) + gained;
        }
      }
    }
  }

  // Coins
  const coinVP = Math.floor((player.coins || 0) / 3);
  vp += coinVP;
  breakdown["Coins"] = coinVP;

  // Wonder stages VP (uses the chosen option for multi-choice tiers, and
  // evaluates per-metric VP live from current state).
  const wonder = getWonder(player.wonder, player.wonder_side);
  let wonderVP = 0;
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) {
      if (e.kind === "vp" && !e.perMetric) wonderVP += e.amount || 0;
      if (e.kind === "vp" && e.perMetric) {
        const cnt = countMetric(player, e.perMetric, e.target || "self", allPlayers, allCardsById);
        wonderVP += (e.amount || 0) * cnt;
      }
      if (e.kind === "vp_if_wonder_complete" && (player.wonder_stages_built || 0) >= (wonder.stages?.length || 0)) wonderVP += e.amount || 0;
    }
  }
  vp += wonderVP;
  breakdown["Wonder"] = wonderVP;

  // Edifice patronage rewards / penalties (flat VP applied at edifice completion).
  const edificeVP = player.bonus_vp || 0;
  vp += edificeVP;
  breakdown["Edifice"] = edificeVP;

  // Ongoing edifice reward effects (evaluated live at scoring time so they
  // reflect the final city state, not just the state at edifice completion).
  for (const e of (player.edifice_reward_effects || [])) {
    const mult = e._mult || 1;
    const gained = evaluateOngoingVp(player, e, allPlayers, allCardsById) * mult;
    vp += gained;
    breakdown["Edifice"] += gained;
  }

  // Armada: blue track VP (current level only) + naval victory/defeat tokens.
  const blueLevel = player.armada_board?.blue?.level || 1;
  const blueVP = ARMADA_REWARDS.blue?.[blueLevel]?.vp || 0;
  if (blueVP) { vp += blueVP; breakdown["Armada (Blue)"] = blueVP; }
  const navalVictoryVP = (player.naval_trophies || []).reduce((s, t) => s + (t.points || 0), 0);
  const navalDefeatVP = (player.naval_defeats || []).reduce((s, t) => s + (t.points || 0), 0);
  const navalVP = navalVictoryVP + navalDefeatVP;
  if (navalVP) { vp += navalVP; breakdown["Naval"] = navalVP; }

  if (hasEffect(player, "double_purple", allCardsById)) { // highest-scoring purple card scores twice (science_choice adds a wild)
    const pc = cards.filter((c) => c.color === "purple");
    if (pc.length) { let best = 0; for (const c of pc) { let g = singleCardVP(player, c, allPlayers, allCardsById); if ((c.effects||[]).some(e=>e.kind==="science_choice")) g = Math.max(g, computeOptimalScience([...(player.science_symbols||[]), "__choice__"], { spyTypes: _spyTypes }).score - sci.score); if (g > best) best = g; } if (best > 0) { vp += best; breakdown["Double Purple"] = best; } }
  }

  return { total: vp, breakdown, scienceAssignment: sci.assignment };
}

// A player is "diplomatic" for a given age if they've played a diplomacy card of
// that age (a diplomacy card only exempts the age it belongs to). Diplomacy now
// also exempts the player from the naval conflict of that age.
export function playerHasDiplomacy(player, allCardsById, age) {
  const a = String(age);
  if ((player.diplomacy_ages || []).includes(a)) return true;
  return (player.played_cards || []).some((pc) => { const c = allCardsById?.[pc.id] || pc; return String(c.age) === a && (c.effects || []).some((e) => e.kind === "diplomacy"); });
}

// Naval diplomacy: a card of the given age with `naval_diplomacy` exempts the
// player from that age's naval conflict only (land military still resolves).
export function playerHasNavalDiplomacy(player, allCardsById, age) {
  const a = String(age);
  if ((player.naval_diplomacy_ages || []).includes(a)) return true;
  return (player.played_cards || []).some((pc) => { const c = allCardsById?.[pc.id] || pc; return String(c.age) === a && (c.effects || []).some((e) => e.kind === "naval_diplomacy"); });
}

// Does the player skip the naval conflict for this age (naval diplomacy OR
// regular diplomacy)?
export function playerSkipsNaval(player, allCardsById, age) {
  return playerHasNavalDiplomacy(player, allCardsById, age) || playerHasDiplomacy(player, allCardsById, age);
}

// Island cards in the player's tableau (played cards with no color / flagged).
export function getIslands(player, allCardsById) {
  return (player.played_cards || []).filter((c) => {
    const full = allCardsById?.[c.id] || c;
    return full.is_island || full.pack === "island" || !full.color || full.color === "island";
  });
}

// Auto-pick up to `amount` distinct non-maxed tracks for a move_ship(any) card.
// Returns null when the card has no move_ship(any) effect.
export function autoMoveShipChoices(player, card, allCardsById) {
  const full = card && (allCardsById?.[card.id] || card);
  const ms = (full?.effects || []).find((e) => e.kind === "move_ship" && (!e.color || e.color === "any"));
  if (!ms) return null;
  const max = Math.min(ms.amount || 1, 4);
  const avail = ["red", "yellow", "blue", "green"].filter((c) => (player.armada_board?.[c]?.level || 1) < 7);
  return avail.sort((a, b) => (player.armada_board?.[a]?.level || 1) - (player.armada_board?.[b]?.level || 1)).slice(0, max);
}

// Highest `amount` among a player's effects of the given kind (cards + wonder).
function effectAmount(player, kind, allCardsById) {
  let amt = 0;
  for (const pc of player.played_cards || []) {
    const c = allCardsById?.[pc.id] || pc;
    for (const e of c.effects || []) if (e.kind === kind) amt = Math.max(amt, e.amount || 0);
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) if (e.kind === kind) amt = Math.max(amt, e.amount || 0);
  }
  return amt;
}

// First effect of the given kind a player owns (cards + built wonder stages),
// returning the effect object so the caller can read its config fields.
function findEffect(player, kind, allCardsById) {
  for (const pc of player.played_cards || []) {
    const c = allCardsById?.[pc.id] || pc;
    for (const e of c.effects || []) if (e.kind === kind) return e;
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) if (e.kind === kind) return e;
  }
  return null;
}

// All effects of the given kind a player owns (cards + built wonder stages).
function findAllEffects(player, kind, allCardsById) {
  const out = [];
  for (const pc of player.played_cards || []) {
    const c = allCardsById?.[pc.id] || pc;
    for (const e of c.effects || []) if (e.kind === kind) out.push(e);
  }
  const wonder = getWonder(player.wonder, player.wonder_side);
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    for (const e of builtStageEffects(player, wonder, i)) if (e.kind === kind) out.push(e);
  }
  return out;
}

// ---------- Military resolution ----------
// Diplomatic players sit out: they get no trophies/defeats, and their neighbors
// resolve against each other. The active (non-diplomatic) players form a reduced
// circle in seat order; each adjacent pair compares once (no pair fights twice).
// Boarding adds extra conflicts vs players 2 seats away (ignores diplomacy, no
// effect in 3p). Overwhelm grants a bonus when a conflict is won by ≥X shields.
export function resolveMilitary(allPlayers, age, allCardsById, ctx) {
  const points = AGE_POINTS[age] || 0;
  const updated = allPlayers.map((p) => ({ ...p, trophies: [...(p.trophies || [])], defeats: [...(p.defeats || [])] }));
  const conflicts = []; // { winner, loser, diff }
  const n = allPlayers.length;

  const active = updated.filter((p) => !playerHasDiplomacy(p, allCardsById, age)).sort((a, b) => a.seat - b.seat);
  const m = active.length;
  for (let i = 0; i < m; i++) {
    const a = active[i];
    const b = active[(i + 1) % m];
    const da = a.shields || 0, db = b.shields || 0;
    if (da > db) conflicts.push({ winner: a, loser: b, diff: da - db });
    else if (db > da) conflicts.push({ winner: b, loser: a, diff: db - da });
  }

  // Boarding: a player with "boarding" resolves against exactly ONE player 2
  // seats away (their choice, stored as `boarding_side`: "left2" = seat+2,
  // "right2" = seat-2). If unset, they board the 2-away neighbor with fewer
  // shields (more likely to win; tie → seat+2). Ignores diplomacy; no 3p effect.
  if (n > 3) {
    const boarded = new Set();
    for (const p of updated) {
      // Boarding only applies to the military resolution for the age in which
      // the boarding card was played (card.age === current age). Wonder-stage
      // boarding (no age) persists across ages.
      let hasBoarding = false;
      for (const pc of p.played_cards || []) {
        const full = allCardsById?.[pc.id] || pc;
        if (String(full.age) !== String(age)) continue;
        if ((full.effects || []).some((e) => e.kind === "boarding")) { hasBoarding = true; break; }
      }
      if (!hasBoarding) {
        const wonder = getWonder(p.wonder, p.wonder_side);
        for (let i = 0; i < (p.wonder_stages_built || 0); i++) {
          if (builtStageEffects(p, wonder, i).some((e) => e.kind === "boarding")) { hasBoarding = true; break; }
        }
      }
      if (!hasBoarding) continue;
      let offset;
      if (p.boarding_side === "right2") offset = -2;
      else if (p.boarding_side === "left2") offset = 2;
      else {
        const l2 = updated.find((x) => x.seat === (p.seat + 2) % n);
        const r2 = updated.find((x) => x.seat === (p.seat - 2 + n) % n);
        offset = (l2 && r2 && (r2.shields || 0) < (l2.shields || 0)) ? -2 : 2;
      }
      const t = updated.find((x) => x.seat === (p.seat + offset + n) % n);
      if (!t) continue;
      const key = [Math.min(p.seat, t.seat), Math.max(p.seat, t.seat)].join("-");
      if (boarded.has(key)) continue;
      boarded.add(key);
      const dp = p.shields || 0, dt = t.shields || 0;
      if (dp > dt) conflicts.push({ winner: p, loser: t, diff: dp - dt });
      else if (dt > dp) conflicts.push({ winner: t, loser: p, diff: dt - dp });
    }
  }

  // Apply each conflict: trophy + defeat, plus overwhelm if the margin is enough.
  for (const c of conflicts) {
    c.winner.trophies.push({ age, points, vs: c.loser.seat });
    c.loser.defeats.push({ age, vs: c.winner.seat });
    pushNotif(ctx, c.loser.id, { type: "defeat", age: String(age), fromId: c.winner.id, fromName: c.winner.player_name, fromColor: c.winner.player_color, text: `Defeated by ${c.winner.player_name} in Age ${age}` });
    // Overwhelm: land military only (naval overwhelm handled after naval resolution).
    for (const ovEff of findAllEffects(c.winner, "overwhelm", allCardsById)) {
      if (ovEff.naval) continue;
      const margin = ovEff.margin ?? ovEff.amount ?? 0;
      if (!margin || c.diff < margin) continue;
      const rewardValue = ovEff.rewardValue ?? ovEff.amount ?? 0;
      const reward = ovEff.reward || "coins";
      const mult = ovEff.per ? c.diff : 1;
      if (reward === "coins") {
        const gained = rewardValue * mult;
        c.winner.coins = (c.winner.coins || 0) + gained;
        pushNotif(ctx, c.winner.id, { type: "coin_gain", amount: gained, cardName: "Overwhelm", text: `Gained ${gained} coins — Overwhelm` });
      } else if (reward === "trophy") {
        for (let i = 0; i < mult; i++) c.winner.trophies.push({ age, points, vs: c.loser.seat, overwhelm: true });
      } else if (reward === "penalties") {
        c.loser.penalties = (c.loser.penalties || 0) + rewardValue * mult;
        pushNotif(ctx, c.loser.id, { type: "penalty", amount: rewardValue * mult, fromId: c.winner.id, fromName: c.winner.player_name, fromColor: c.winner.player_color, text: `Overwhelmed by ${c.winner.player_name}: +${rewardValue * mult} penalty` });
      }
      if (ovEff.drawback === "discard_card" && ovEff.drawbackColor) {
        applyOverwhelmDrawback(c.loser, ovEff.drawbackColor, age, ctx, c.winner, allCardsById);
      }
    }
  }

  // Loss redirect: a player with this effect sends each of their defeats to the
  // winning neighbor instead.
  for (const p of updated) {
    if (!hasEffect(p, "loss_redirect", allCardsById)) continue;
    const kept = [];
    for (const d of p.defeats) {
      const neighbor = updated.find((x) => x.seat === d.vs);
      if (neighbor) neighbor.defeats.push({ age, vs: p.seat });
      else kept.push(d);
    }
    p.defeats = kept;
  }
  for (const p of updated) { const nt=(p.trophies||[]).length-(allPlayers.find((a)=>a.id===p.id)?.trophies||[]).length; if(nt>0) for(const e of findAllEffects(p,"trigger",allCardsById)) if(e.triggerType==="trophy"&&e.coins) grantCoins(p,e.coins*nt,allCardsById,{ctx}); }
  return updated;
}

// Apply an overwhelm drawback: the target discards a card of the given color
// from their city. If they can't, they take a penalty token (2/3/5 by age).
// Static effects (shields/science/chains) are recomputed after the discard.
export function applyOverwhelmDrawback(target, color, age, ctx, source, allCardsById) {
  const eligible = (target.played_cards || []).filter((c) => {
    const full = allCardsById?.[c.id] || c;
    return full.color === color;
  });
  if (eligible.length) {
    const targetCard = eligible[0];
    target.played_cards = (target.played_cards || []).filter((c) => c.id !== targetCard.id);
    recomputeStaticEffects(target, allCardsById);
    pushNotif(ctx, target.id, { type: "discard", color, cardId: targetCard.id, cardName: targetCard.name, fromId: source?.id, fromName: source?.player_name, fromColor: source?.player_color, text: `Overwhelmed by ${source?.player_name}: discarded ${targetCard.name}` });
  } else {
    const penalty = { "1": 2, "2": 3, "3": 5 }[String(age)] || 0;
    if (penalty) {
      target.penalties = (target.penalties || 0) + penalty;
      pushNotif(ctx, target.id, { type: "penalty", amount: penalty, fromId: source?.id, fromName: source?.player_name, fromColor: source?.player_color, text: `Overwhelmed by ${source?.player_name}: couldn't discard a ${color} card — took ${penalty} penalty` });
    }
  }
}

// Naval overwhelm: after naval resolution, a player with a naval overwhelm
// effect deals the drawback AND reward to every player they have ≥ margin
// more naval shields than. PER scales the reward by the shield difference.
export function resolveNavalOverwhelm(allPlayers, age, allCardsById, ctx) {
  const a = Number(age);
  if (!a) return allPlayers;
  for (const p of allPlayers) {
    for (const ovEff of findAllEffects(p, "overwhelm", allCardsById)) {
      if (!ovEff.naval) continue;
      const margin = ovEff.margin ?? ovEff.amount ?? 0;
      if (!margin) continue;
      const rewardValue = ovEff.rewardValue ?? ovEff.amount ?? 0;
      const reward = ovEff.reward || "coins";
      const myShields = p.naval_shields || 0;
      for (const other of allPlayers) {
        if (other.id === p.id) continue;
        const diff = myShields - (other.naval_shields || 0);
        if (diff < margin) continue;
        const mult = ovEff.per ? diff : 1;
        if (reward === "coins") {
          const gained = rewardValue * mult;
          p.coins = (p.coins || 0) + gained;
          pushNotif(ctx, p.id, { type: "coin_gain", amount: gained, cardName: "Naval Overwhelm", text: `Gained ${gained} coins — Naval Overwhelm` });
        } else if (reward === "trophy") {
          for (let i = 0; i < mult; i++) p.naval_trophies.push({ age: String(a), points: NAVAL_VICTORY_POINTS[a] || 0 });
        } else if (reward === "penalties") {
          other.penalties = (other.penalties || 0) + rewardValue * mult;
          pushNotif(ctx, other.id, { type: "penalty", amount: rewardValue * mult, fromId: p.id, fromName: p.player_name, fromColor: p.player_color, text: `Naval overwhelmed by ${p.player_name}: +${rewardValue * mult} penalty` });
        }
        if (ovEff.drawback === "discard_card" && ovEff.drawbackColor) {
          applyOverwhelmDrawback(other, ovEff.drawbackColor, age, ctx, p, allCardsById);
        }
      }
    }
  }
  return allPlayers;
}

// ---------- Hand passing ----------
export function rotateHands(players, direction) {
  const n = players.length;
  const hands = players.map((p) => p.hand);
  const newPlayers = players.map((p, i) => {
    const fromIdx = direction === "left" ? (i - 1 + n) % n : (i + 1) % n;
    return { ...p, hand: hands[fromIdx], chosen_card_id: null, chosen_action: null, build_sacrifice_id: null, ready: false };
  });
  return newPlayers;
}

export function passDirectionForAge(age) {
  if (age === "leader") return "right";
  if (age === "1") return "left";
  if (age === "2") return "right";
  if (age === "3") return "left";
  return "left";
}

export function nextAge(age) {
  const order = ["leader", "1", "2", "3"];
  const i = order.indexOf(age);
  return i < order.length - 1 ? order[i + 1] : null;
}

// ---------- Wonder stage affordability ----------
// Returns true if the player can afford to build their next wonder stage.
export function canAffordWonderStage(player, leftNeighbor, rightNeighbor, allCardsById, farNeighbors = []) {
  const wonder = getWonder(player.wonder, player.wonder_side);
  const stage = wonder.stages[player.wonder_stages_built || 0];
  if (!stage) return false;
  const pseudoCard = {
    color: "brown",
    is_wonder: true,
    cost_coins: stage.cost_coins || 0,
    cost_resources: stage.cost || {},
    chain_cost: null,
  };
  return canAfford(player, pseudoCard, leftNeighbor, rightNeighbor, allCardsById, farNeighbors).ok;
}

// ---------- AI decision ----------
// Preference-driven AI. Each AI is assigned two color preferences at game start
// (green/yellow/red/blue, plus black when Cities is on). Decisions follow
// per-age priorities plus global guardrails (no ≥6-coin trades, no redundant red
// cards, build a wonder tier each age, donate to edifices, and — with Armada —
// always move a ship when affordable).
const PREF_COLORS = ["green", "yellow", "red", "blue"];

export function aiRandomPrefs(citiesEnabled, difficulty) {
  const pool = citiesEnabled ? [...PREF_COLORS, "black"] : [...PREF_COLORS];
  const count = difficulty === "easy" ? 4 : 2;
  const result = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    result.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return result;
}

// A leader "references" a preference if its effects touch that color, grant
// science (green pref), or grant shields/trophies (red pref).
function leaderMatchesPref(card, prefs) {
  if (!prefs || prefs.length === 0) return false;
  for (const e of card.effects || []) {
    const colorFields = [e.color, e.perMetric, e.metric, e.triggerColor].filter(Boolean).map(String);
    for (const f of colorFields) {
      if (f.startsWith("color:") && prefs.includes(f.slice(6))) return true;
    }
    if (e.color && prefs.includes(e.color)) return true;
    if (prefs.includes("green") && (e.kind === "science" || e.kind === "science_choice")) return true;
    if (prefs.includes("red") && ["shields", "trophy_on_enter", "overwhelm"].includes(e.kind)) return true;
    if (prefs.includes("red") && e.perMetric && /trophy|military/.test(e.perMetric)) return true;
  }
  return false;
}

// Leader draft (age "leader" choosing phase): prefer leaders matching a pref.
export function aiChooseLeaderDraft(player, allCardsById) {
  const hand = player.hand || [];
  if (hand.length === 0) return { cardId: null, action: "pick" };
  const prefs = player.ai_prefs || [];
  const matching = hand.filter((c) => leaderMatchesPref(allCardsById?.[c.id] || c, prefs));
  const pool = matching.length ? matching : hand;
  return { cardId: pool[Math.floor(Math.random() * pool.length)].id, action: "pick" };
}

// Leader select (play one leader before an age): prefer a pref-matching leader,
// else a random one. Build a wonder tier only when no playable leader would give
// VP or coins (25% chance in that case), or when no leader is affordable.
export function aiChooseLeader(player, allPlayers, allCardsById, game) {
  const leaders = player.leaders_hand || [];
  const n = allPlayers.length;
  const left = allPlayers.find((p) => p.seat === (player.seat + 1) % n);
  const right = allPlayers.find((p) => p.seat === (player.seat - 1 + n) % n);
  const far = farNeighborsOf(player, allPlayers);
  const prefs = player.ai_prefs || [];
  const canBuild = canAffordWonderStage(player, left, right, allCardsById, far);
  const wonderBuiltThisAge = (player.stages_built_this_age || 0) > 0;

  const playable = leaders.filter((c) => (player.coins || 0) >= leaderCoinCost(player, c, allPlayers, Number(nextAge(game?.age))));

  if (playable.length > 0) {
    // Check if any playable leader would give VP or coins.
    const valued = playable.map((c) => {
      const d = leaderValueDelta(player, c, allPlayers, allCardsById, game);
      return { card: c, ...d };
    });
    const anyValue = valued.some((d) => d.vp > 0 || d.coins > 0);

    if (anyValue) {
      // At least one leader gives value — play the best, never build.
      const matching = valued.filter((d) => leaderMatchesPref(allCardsById?.[d.card.id] || d.card, prefs));
      const pool = matching.length ? matching : valued;
      pool.sort((a, b) => (b.vp + b.coins) - (a.vp + a.coins));
      return { cardId: pool[0].card.id, action: "play_leader" };
    }

    // No leader gives VP or coins — 25% chance to build, else play a random one.
    if (!wonderBuiltThisAge && canBuild && Math.random() < 0.25) {
      return aiBuildAction(player, leaders, game, allPlayers, allCardsById, !!game?.armada_expansion);
    }
    return { cardId: playable[Math.floor(Math.random() * playable.length)].id, action: "play_leader" };
  }

  // No affordable leader — build if possible, else discard a leader for coins.
  if (!wonderBuiltThisAge && canBuild) {
    return aiBuildAction(player, leaders, game, allPlayers, allCardsById, !!game?.armada_expansion);
  }
  return { cardId: leaders[0]?.id || null, action: "discard" };
}

// Build action helper: sacrifice the first hand card, donate to edifice if able.
function aiBuildAction(player, hand, game, allPlayers, allCardsById, armadaOn) {
  let donate = null;
  if (game?.edifice_expansion && String(game.age) !== "leader") {
    const ed = edificeForAge(game, game.age);
    const st = game.edifice_state?.[ed?.id];
    if (ed && st && !st.completed && (st.remaining || 0) > 0 && (player.coins || 0) >= (ed.cost || 0)) donate = "donate";
  }
  let buildPools = null;
  if (armadaOn) {
    const n = allPlayers.length;
    const left = allPlayers.find((p) => p.seat === (player.seat + 1) % n);
    const right = allPlayers.find((p) => p.seat === (player.seat - 1 + n) % n);
    const far = farNeighborsOf(player, allPlayers);
    buildPools = poolsAfterCommit(player, null, "build", null, game, allCardsById, left, right, far);
  }
  // Wonder stage with multiple options: pick one at random.
  let wonderChoice = null;
  const wonder = getWonder(player.wonder, player.wonder_side);
  const stage = wonder?.stages?.[player.wonder_stages_built || 0];
  if (stage && Array.isArray(stage.choices) && stage.choices.length > 1) {
    wonderChoice = Math.floor(Math.random() * stage.choices.length);
  }
  return { cardId: hand[0]?.id || null, action: "build", armadaMove: armadaOn ? aiBadgeMove(player, allPlayers, allCardsById, buildPools) : null, edificeDonate: donate, wonderChoice };
}

// Armada: the badge track move available when building a wonder tier.
function aiBadgeMove(player, allPlayers, allCardsById, pools = null) {
  const board = player.armada_board || {};
  for (const c of ARMADA_TRACKS) {
    if (board[c]?.wonder && (board[c].level || 1) < 7) return aiArmadaMove(player, c, allPlayers, allCardsById, pools);
  }
  return null;
}

// Decide an Armada ship move for `color`: move if self-affordable, or with trade
// only when the player holds ≥7 coins. Returns null (no move offered) when the
// track is maxed; { decline: true } when a move exists but isn't affordable.
function aiArmadaMove(player, color, allPlayers, allCardsById, pools = null) {
  const board = player.armada_board?.[color];
  if (!board || (board.level || 1) >= 7) return null;
  const next = (board.level || 1) + 1;
  const n = allPlayers.length;
  const left = allPlayers.find((p) => p.seat === (player.seat + 1) % n);
  const right = allPlayers.find((p) => p.seat === (player.seat - 1 + n) % n);
  const far = farNeighborsOf(player, allPlayers);
  const aff = canAfford(player, armadaMoveCostCard(board, color, next), left, right, allCardsById, far, null, pools);
  if (!aff.ok) return { decline: true };
  if (aff.tradePairs.length === 0) return { color, trades: [], free: false };
  const availCoins = pools ? (pools.coins ?? 0) : (player.coins || 0);
  if (availCoins >= 7) return { color, trades: aff.tradePairs, free: false };
  return { decline: true };
}

// Per-metric VP delta if `card` were played (used for Age 3 "most VP" choice).
function vpDelta(player, card, allPlayers, allCardsById, game) {
  const before = scorePlayer(player, allPlayers, allCardsById).total;
  const sim = JSON.parse(JSON.stringify(player));
  sim.played_cards = [...(sim.played_cards || []), card];
  applyCardEffects(sim, card, allPlayers, allCardsById, { age: game?.age, islandPool: game?.armada_islands || {} });
  return scorePlayer(sim, allPlayers, allCardsById).total - before;
}

// VP and coin delta if a leader were played — used to decide whether the AI
// should play a leader vs. build a wonder tier with it.
function leaderValueDelta(player, card, allPlayers, allCardsById, game) {
  const before = scorePlayer(player, allPlayers, allCardsById).total;
  const beforeCoins = player.coins || 0;
  const sim = JSON.parse(JSON.stringify(player));
  sim.played_cards = [...(sim.played_cards || []), card];
  applyCardEffects(sim, card, allPlayers, allCardsById, { age: game?.age, islandPool: game?.armada_islands || {} });
  return { vp: scorePlayer(sim, allPlayers, allCardsById).total - before, coins: (sim.coins || 0) - beforeCoins };
}

function vpDeltaBuild(player, allPlayers, allCardsById, game) {
  const wonder = getWonder(player.wonder, player.wonder_side);
  const stage = wonder.stages[player.wonder_stages_built || 0];
  if (!stage) return -Infinity;
  const before = scorePlayer(player, allPlayers, allCardsById).total;
  const sim = JSON.parse(JSON.stringify(player));
  for (const e of stage.effects || []) applyEffect(sim, e, null, allPlayers, allCardsById, { age: game?.age });
  sim.wonder_stages_built = (sim.wonder_stages_built || 0) + 1;
  return scorePlayer(sim, allPlayers, allCardsById).total - before;
}

export function aiChoose(player, allPlayers, allCardsById, game) {
  const n = allPlayers.length;
  const left = allPlayers.find((p) => p.seat === (player.seat + 1) % n);
  const right = allPlayers.find((p) => p.seat === (player.seat - 1 + n) % n);
  const far = farNeighborsOf(player, allPlayers);
  const hand = player.hand || [];
  const prefs = player.ai_prefs || [];
  const age = game?.age;
  const armadaOn = !!game?.armada_expansion;
  const pick = (list) => (list.length ? list[Math.floor(Math.random() * list.length)] : null);

  // Evaluate each hand card: affordable, non-duplicate, with its trade coin cost.
  const evalCard = (card) => {
    if (hasDuplicateName(player, card, allCardsById)) return null;
    if (card.chain_cost && (player.played_cards || []).some((pc) => (allCardsById[pc.id] || pc).chain_symbols?.includes(card.chain_cost)))
      return { card, tradeCost: 0, tradePairs: [] };
    const aff = canAfford(player, card, left, right, allCardsById, far);
    if (!aff.ok) return null;
    const tradeCost = aff.tradePairs.reduce((s, t) => s + (t.cost || 0), 0);
    return { card, tradeCost, tradePairs: aff.tradePairs };
  };
  const playable = hand.map(evalCard).filter(Boolean);
  // Guardrail: never play a card requiring ≥6 coins of trading.
  const light = playable.filter((e) => e.tradeCost < 6);
  // Guardrail: never play a red card if already ≥4 shields above both neighbors.
  const shieldOk = (card) => {
    if (card.color !== "red") return true;
    const myS = player.shields || 0;
    return !(myS >= (left?.shields || 0) + 4 && myS >= (right?.shields || 0) + 4);
  };
  const candidates = light.filter((e) => shieldOk(e.card));

  const canBuild = canAffordWonderStage(player, left, right, allCardsById, far);
  const wonderBuiltThisAge = (player.stages_built_this_age || 0) > 0;
  // Final-2-cards enforcement: build a wonder tier (over anything else) if none
  // built this age, and donate to the edifice when affordable.
  if ((hand || []).length <= 2 && !wonderBuiltThisAge && canBuild) {
    return aiBuildAction(player, hand, game, allPlayers, allCardsById, armadaOn);
  }

  const finalize = (e) => {
    const playPools = poolsAfterCommit(player, e.card, "play", e.tradePairs, game, allCardsById, left, right, far);
    return { cardId: e.card.id, action: "play", armadaMove: armadaOn ? aiArmadaMove(player, e.card.color, allPlayers, allCardsById, playPools) : null };
  };

  // ---- Age 1: always brown/grey, then preference color, then build, then any. ----
  if (age === "1") {
    let bg = candidates.filter((e) => e.card.color === "brown" || e.card.color === "gray");
    if (bg.length > 1) {
      const wonder = getWonder(player.wonder, player.wonder_side);
      const needRes = Object.keys(wonder.stages[player.wonder_stages_built || 0]?.cost || {});
      const scored = bg.map((e) => {
        const produces = (e.card.effects || []).filter((ef) => ef.kind === "resource" || ef.kind === "resource_choice").flatMap((ef) => ef.resources || []);
        return { e, score: produces.filter((r) => needRes.includes(r)).length };
      });
      const best = Math.max(...scored.map((s) => s.score));
      if (best > 0) bg = scored.filter((s) => s.score === best).map((s) => s.e);
    }
    let choice = pick(bg);
    if (!choice) choice = pick(candidates.filter((e) => prefs.includes(e.card.color)));
    if (choice) return finalize(choice);
    if (canBuild && !wonderBuiltThisAge) return aiBuildAction(player, hand, game, allPlayers, allCardsById, armadaOn);
    const any = pick(candidates.length ? candidates : playable);
    if (any) return finalize(any);
    return { cardId: hand[0]?.id || null, action: "discard" };
  }

  // ---- Age 2: brown/yellow/grey producing a new resource, then pref, build, any. ----
  if (age === "2") {
    const owned = new Set();
    for (const r of RESOURCE_ORDER) if ((getProducibleResources(player, allCardsById).fixed || {})[r] > 0) owned.add(r);
    const nbrRes = new Set();
    for (const nb of [left, right]) {
      if (!nb) continue;
      const pr = getProducibleResources(nb, allCardsById);
      for (const r of RESOURCE_ORDER) if ((pr.tradeableFixed || {})[r] > 0) nbrRes.add(r);
    }
    const novel = candidates.filter((e) => {
      if (!["brown", "yellow", "gray"].includes(e.card.color)) return false;
      const produces = (e.card.effects || []).filter((ef) => ef.kind === "resource" || ef.kind === "resource_choice").flatMap((ef) => ef.resources || []);
      return produces.some((r) => !owned.has(r) && !nbrRes.has(r));
    });
    let choice = pick(novel);
    if (!choice) choice = pick(candidates.filter((e) => prefs.includes(e.card.color)));
    if (choice) return finalize(choice);
    if (canBuild && !wonderBuiltThisAge) return aiBuildAction(player, hand, game, allPlayers, allCardsById, armadaOn);
    const any = pick(candidates.length ? candidates : playable);
    if (any) return finalize(any);
    return { cardId: hand[0]?.id || null, action: "discard" };
  }

  // ---- Age 3: play the card/build that yields the most VP; ties → pref color. ----
  if (age === "3") {
    const scored = candidates.map((e) => ({ e, vp: vpDelta(player, e.card, allPlayers, allCardsById, game), pref: prefs.includes(e.card.color) ? 1 : 0 }));
    const buildVP = canBuild ? vpDeltaBuild(player, allPlayers, allCardsById, game) : -Infinity;
    const bestCardVP = scored.length ? Math.max(...scored.map((s) => s.vp)) : -Infinity;
    // Prefer the build when it beats every card (or there are no playable cards).
    if (canBuild && (scored.length === 0 || buildVP > bestCardVP || (buildVP === bestCardVP && !wonderBuiltThisAge))) {
      return aiBuildAction(player, hand, game, allPlayers, allCardsById, armadaOn);
    }
    if (scored.length) {
      const best = Math.max(...scored.map((s) => s.vp));
      const top = scored.filter((s) => s.vp === best);
      // Tie-break: preference color.
      const prefTop = top.filter((s) => s.pref);
      const chosen = (prefTop.length ? prefTop : top)[Math.floor(Math.random() * (prefTop.length || top.length))];
      return finalize(chosen.e);
    }
    const any = pick(playable);
    if (any) return finalize(any);
    return { cardId: hand[0]?.id || null, action: "discard" };
  }

  // Fallback (unknown age): affordable card or discard.
  const any = pick(playable);
  if (any) return finalize(any);
  return { cardId: hand[0]?.id || null, action: "discard" };
}