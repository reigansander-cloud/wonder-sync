// Shared game constants for 7 Wonders

export const RESOURCE_ICONS = {
  wood: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/895f219af_Wood2.png",
  stone: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/9346dfd79_Stone2.png",
  clay: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/aa41c856c_Clay2.png",
  ore: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/0051f995b_Ore2.png",
  glass: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/c15020f84_Glass2.png",
  papyrus: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/e989f6116_Papyrus2.png",
  loom: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/92c9b6924_Loom.png",
};

export const RESOURCE_ORDER = ["wood", "stone", "clay", "ore", "glass", "papyrus", "loom"];
export const RAW_RESOURCES = ["wood", "stone", "clay", "ore"];
export const MANUFACTURED_RESOURCES = ["glass", "papyrus", "loom"];

export const ICONS = {
  coin: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/f75487bd5_Coin.png",
  vp: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/1454afdda_VictoryPoints.png",
  shield: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/28e646a85_MilitaryShield.png",
};

export const SCIENCE_SYMBOLS = [
  { key: "script", name: "Script", icon: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/5aa2b499b_Science-Script.png" },
  { key: "gear", name: "Gear", icon: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/c73f18da2_Science-Gear.png" },
  { key: "mason", name: "Mason", icon: "https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/9b87f2d8a_Science-Mason.png" },
];

export const CARD_COLORS = [
  { key: "brown", name: "Brown (Raw Material)", hex: "#8a5a2b" },
  { key: "gray", name: "Gray (Manufactured)", hex: "#8a8a8a" },
  { key: "green", name: "Green (Science)", hex: "#3d8b3d" },
  { key: "blue", name: "Blue (Civilian)", hex: "#2e5fa3" },
  { key: "yellow", name: "Yellow (Commercial)", hex: "#d9b920" },
  { key: "red", name: "Red (Military)", hex: "#b83232" },
  { key: "purple", name: "Purple (Guild)", hex: "#7a3d8a" },
  { key: "leader", name: "Leader", hex: "#d4af37" },
  { key: "black", name: "Black (Cities)", hex: "#1c1c1c" },
  { key: "island", name: "Island", hex: "#2e7d6b" },
];

export const PLAYER_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e84393",
];

export const AGES = ["leader", "1", "2", "3"];

export const AGE_POINTS = { 1: 1, 2: 3, 3: 5 };

export const TOKEN_ICONS = {
  "1": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/375c8824d_Age1Trophy.png",
  "2": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/7a124e570_Age2Trophy.png",
  "3": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/ddfc78dfa_Age3Trophy.png",
  loss: "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/8aca72127_Loss.png",
  penalty: "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/69d9afeb2_Penalty.jpeg",
};

// Wonders — boards with starting resource + stages (cost in resources + rewards as effects)
export const WONDERS = [
  {
    id: "giza", name: "Giza (Pyramids)", color: "#d4a64a",
    day: {
      start_resource: "stone",
      stages: [
        { cost: { wood: 2 }, effects: [{ kind: "vp", amount: 3 }] },
        { cost: { clay: 2, loom: 1 }, effects: [{ kind: "vp", amount: 5 }] },
        { cost: { stone: 4 }, effects: [{ kind: "vp", amount: 7 }] },
      ],
    },
    night: {
      start_resource: "stone",
      stages: [
        { cost: { wood: 2 }, effects: [{ kind: "vp", amount: 3 }] },
        { cost: { stone: 3 }, effects: [{ kind: "vp", amount: 5 }] },
        { cost: { clay: 3 }, effects: [{ kind: "vp", amount: 5 }] },
        { cost: { stone: 4, papyrus: 1 }, effects: [{ kind: "vp", amount: 7 }] },
      ],
    },
  },
  {
    id: "ur", name: "Ur", color: "#7d5ba6",
    day: {
      start_resource: "wood",
      stages: [
        { cost: { stone: 1, ore: 1 }, effects: [{ kind: "vp", amount: 3 }] },
        { cost: { stone: 2, clay: 1 }, effects: [{ kind: "edifice_patronage_choice" }] },
        { cost: { wood: 3, papyrus: 1 }, effects: [{ kind: "vp", amount: 7 }] },
      ],
    },
    night: {
      start_resource: "wood",
      stages: [
        { cost: { stone: 1, glass: 1 }, effects: [{ kind: "edifice_patronage_age", age: "1" }] },
        { cost: { ore: 2, stone: 1 }, effects: [{ kind: "edifice_patronage_age", age: "2" }] },
        { cost: { clay: 2, loom: 1, stone: 1 }, effects: [{ kind: "edifice_patronage_age", age: "3" }] },
      ],
    },
  },
  {
    id: "rome", name: "Rome", color: "#9b2d20",
    day: {
      start_resource: null,
      passives: ["leaders_cost_zero"],
      stages: [
        { cost: { wood: 1, clay: 1, ore: 1 }, effects: [{ kind: "vp", amount: 4 }] },
        { cost: { stone: 2, clay: 1, loom: 1 }, effects: [{ kind: "vp", amount: 6 }] },
      ],
    },
    night: {
      start_resource: null,
      passives: ["leader_cost_reduction_2"],
      stages: [
        { cost: { wood: 1, clay: 1 }, effects: [{ kind: "rome_draw_leaders", amount: 4 }] },
        { cost: { stone: 1, clay: 1, glass: 1 }, effects: [{ kind: "rome_play_leader" }] },
        { cost: { stone: 2, papyrus: 1 }, effects: [{ kind: "rome_play_leader" }] },
      ],
    },
  },
];

// Build a Wonder-entity override payload for a built-in wonder, copying its
// day/night definitions (stages, start_resource, passives) so the built-in can
// be edited like a custom wonder — most importantly its artwork. Art fields
// (image_url / image_crop) start empty and are added via the Wonder editor.
// A record with `builtin_id` registers under that id (overriding the built-in);
// records without it register under `c:<id>` as a normal custom wonder.
export function builtinWonderOverride(w) {
  const clone = (s) => s
    ? { ...s, stages: (s.stages || []).map((st) => ({ ...st, cost: { ...(st.cost || {}) }, cost_coins: st.cost_coins || 0, effects: (st.effects || []).map((e) => ({ ...e })) })) }
    : { start_resource: "", stages: [] };
  return { name: w.name, color: w.color, builtin_id: w.id, day: clone(w.day), night: clone(w.night) };
}

export const PATRONAGE_TOKEN_IMAGES = {
  "1": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/be8ba8073_Age1Patronage.png",
  "2": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/031cf4952_Age2Patronage.png",
  "3": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/9fa52627f_Age3Patronage.png",
};

// Edifice pool — one random edifice per age is enabled when the Edifice
// expansion is on. Rewards/penalties apply at edifice completion.
export const EDIFICE_POOL = [
  { id: "ed_prytaneion", name: "Prytaneion", age: "1", cost: 3, rewards: { vp: 3 }, penalties: { vp: -1 } },
  { id: "ed_aqueduct", name: "Aqueduct", age: "1", cost: 4, rewards: { vp: 3, coins: 3 }, penalties: { vp: -1 } },
  { id: "ed_theater", name: "Theater", age: "1", cost: 4, rewards: { vp: 4 }, penalties: { vp: -1 } },
  { id: "ed_palace", name: "Palace", age: "2", cost: 5, rewards: { vp: 5 }, penalties: { vp: -2 } },
  { id: "ed_observatory", name: "Observatory", age: "2", cost: 6, rewards: { vp: 5, coins: 3 }, penalties: { vp: -2 } },
  { id: "ed_library", name: "Library", age: "2", cost: 6, rewards: { vp: 6 }, penalties: { vp: -2 } },
  { id: "ed_cathedral", name: "Cathedral", age: "3", cost: 7, rewards: { vp: 7 }, penalties: { vp: -3 } },
  { id: "ed_forum", name: "Forum", age: "3", cost: 8, rewards: { vp: 7, coins: 4 }, penalties: { vp: -3 } },
  { id: "ed_mausoleum", name: "Mausoleum", age: "3", cost: 8, rewards: { vp: 8 }, penalties: { vp: -3 } },
];

let wonderRegistry = {};
export function setWonderRegistry(map) { wonderRegistry = map || {}; }

export function getWonder(id, side) {
  const custom = wonderRegistry[id];
  const builtin = WONDERS.find((w) => w.id === id);
  if (custom) {
    const s = (side === "B" || side === "night") ? (custom.night || {}) : (custom.day || {});
    // Fall back to the built-in wonder's passives when the custom record
    // doesn't have them (e.g. a Rome override saved before the schema included
    // the passives field — without this, leader_cost_reduction_2 is lost and
    // Rome Night's leader discount stops applying).
    const bs = builtin ? ((side === "B" || side === "night") ? (builtin.night || {}) : (builtin.day || {})) : {};
    return { id, name: custom.name, color: custom.color, start_resource: s.start_resource || null,     image_url: s.image_url || null, image_crop: s.image_crop || null, tier_cuts: s.tier_cuts || null, stages: s.stages || [], passives: (s.passives && s.passives.length) ? s.passives : (bs.passives || []) };
  }
  const w = builtin || WONDERS[0];
  if (w.day || w.night) {
    const s = (side === "B" || side === "night") ? (w.night || {}) : (w.day || {});
    return { id: w.id, name: w.name, color: w.color, start_resource: s.start_resource || null,     image_url: s.image_url || null, image_crop: s.image_crop || null, tier_cuts: s.tier_cuts || null, stages: s.stages || [], passives: (s.passives && s.passives.length) ? s.passives : [] };
  }
  return w;
}

// Default chain symbols. Custom chain symbols are stored in the ChainSymbol entity
// and merged with this list at runtime (see useChainSymbols hook).
export const DEFAULT_CHAIN_SYMBOLS = ["Mask"];
export const CHAIN_SYMBOLS = ["Mask"];

// Effect metadata for the editor
export const EFFECT_TYPES = [
  { key: "coins", name: "Coins", desc: "Gain or lose coins" },
  { key: "vp", name: "Victory Points", desc: "Gain victory points" },
  { key: "shields", name: "Military Shields", desc: "Gain military shields" },
  { key: "science", name: "Science Symbol", desc: "Gain a specific science symbol" },
  { key: "science_choice", name: "Science Choice", desc: "Choose any science symbol (optimal auto-assigned)" },
  { key: "resource", name: "Produce Resource", desc: "Produce a single resource each turn" },
  { key: "resource_choice", name: "Produce Choice Resource", desc: "Produce one of several resources each turn" },
  { key: "free_build_color", name: "Free Construction", desc: "Build a card of a color for free once per age" },
  { key: "trade_discount", name: "Trade Discount", desc: "Reduce trade cost for a resource from neighbors" },
  { key: "chain", name: "Grant Chain Symbol", desc: "Add a chain symbol to your supply" },
  { key: "cull", name: "Cull Others", desc: "When played: every other player loses coins (penalties for shortfalls)" },
  { key: "trigger", name: "When Played (Trigger)", desc: "Persistent: on a trigger, gain coins and cull other players" },
  { key: "chain_bonus", name: "Chain Free Coins", desc: "Persistent: gain coins when you play a card free via chain" },
  { key: "set_vp", name: "VP per Set", desc: "VP for every complete set of chosen colors/science" },
  { key: "cost_reduction", name: "Cost Reduction", desc: "Reduce the cost of a chosen target (card color, wonder tier, or ship move) by 1, or make it entirely free with the Free toggle" },
  { key: "coin_gain_bonus", name: "Coin Gain Bonus", desc: "Persistent: +coin on each coin gain (except trade/self)" },
  { key: "loss_redirect", name: "Loss Redirect", desc: "Persistent: a neighbor's military win gives them the loss" },
  { key: "vp_if_ge", name: "VP if Compare ≥ Neighbors", desc: "Gain VP if your metric ≥ both neighbors" },
  { key: "vp_if_none", name: "VP if None", desc: "Gain VP if you have none of a metric" },
  { key: "trophy_pairs_vp", name: "Trophy Pairs VP", desc: "VP per pair of identical trophies (by age)" },
  { key: "supply_trade", name: "Supply Trade", desc: "Once per card, buy 1 resource from the supply for 1 coin" },
  { key: "trade_bonus", name: "Trade Bonus", desc: "Persistent: gain 1 coin per neighbor traded with, once per turn" },
  { key: "trophy_on_enter", name: "Gain Trophy", desc: "When played: gain a trophy of a chosen age" },
  { key: "neighbors_penalty", name: "Neighbors Penalty", desc: "When played: both neighbors gain a penalty token" },
  { key: "neighbors_coins", name: "Neighbors/Opponents Coins", desc: "When played: neighbors or all opponents gain coins" },
  { key: "boarding", name: "Boarding", desc: "Also resolve military vs players 2 seats away (ignores diplomacy, no effect in 3p)" },
  { key: "overwhelm", name: "Overwhelm", desc: "Win a military conflict by ≥X shields: gain X coins, a trophy, opponent takes X penalties" },
  { key: "foreign_trade", name: "Foreign Trade", desc: "Once per turn, trade 1 resource with a player 2 seats away for 1 coin" },
  { key: "scam", name: "Scam", desc: "First resource traded from a neighbor (left/right/both) costs 1 less (can be free with a discount)" },
  { key: "warehouse", name: "Warehouse", desc: "Choice resource: produce 1 of any resource you already produce" },
  { key: "black_market", name: "Black Market", desc: "Choice resource: produce 1 of any resource you don't already produce" },
  { key: "free_cards_per_age", name: "Free Cards Per Age", desc: "Once per age: play a qualifying card for free when you can't afford it (or instead of trading)" },
  { key: "play_both", name: "Play Both", desc: "After the age's last draft, get an extra round to play your final (normally discarded) card" },
  { key: "bury", name: "Bury", desc: "When played: remove an in-play leader from the game and gain VP equal to twice its coin cost" },
  { key: "vp_if_one", name: "VP if One", desc: "Gain VP if you have exactly one of a metric" },
  { key: "vp_if_wonder_complete", name: "VP if Wonder Complete", desc: "Gain VP if you have built all tiers of your wonder" },
  { key: "diplomacy", name: "Diplomacy", desc: "Skip military resolution this age (the card's age); neighbors resolve among themselves" },
  { key: "naval_shields", name: "Naval Shields", desc: "Gain naval shields (Armada) used in the naval resolution" },
  { key: "naval_victory", name: "Naval Victory", desc: "Gain a naval victory token of age 0, 1, 2, or 3" },
  { key: "move_ship", name: "Move Ship", desc: "Move up to X ships (different colors) up one level each for free" },
  { key: "ship_move_coin", name: "Ship Move Coin", desc: "Persistent: gain 1 coin each time one of your ships moves" },
  { key: "pirates", name: "Pirates", desc: "When played: all other players are culled equal to their current trade level" },
  { key: "self_discard", name: "Discard Card/Trophy", desc: "Remove a card of a color or a trophy from your city; if you cannot, suffer penalties (2/3/5 by age)" },
  { key: "lose_coins", name: "Lose Coins", desc: "Cull yourself for X coins (penalties for any shortfall)" },
  { key: "armada_cost_reduction", name: "Ship Move Discount", desc: "Reduce the resource cost to move a ship by 1 (smart reduction, stacks)" },
  { key: "free_first_per_color", name: "Free First Per Color", desc: "Once per age, play your first card of a chosen color for free (no cost, no trade)" },
  { key: "edifice_patronage_choice", name: "Edifice Patronage (choose)", desc: "Wonder stage: gain a duplicate patronage token for any edifice (Edifice expansion)" },
  { key: "edifice_patronage_age", name: "Edifice Patronage (age)", desc: "Wonder stage: gain a duplicate patronage token for the edifice of a chosen age (Edifice expansion)" },
  { key: "cleanse", name: "Cleanse", desc: "When played: remove all your military loss tokens (not naval); optionally gain X coins per loss removed" },
  { key: "gain_island", name: "Gain Island", desc: "When played: draw & play an island card of age 1, 2, or 3 (like the green Armada track reward)" },
  { key: "naval_diplomacy", name: "Naval Diplomacy", desc: "Skip naval conflict resolution this age (the card's age); you get no naval victories or defeats" },
  { key: "coin_loss_immunity", name: "Coin Loss Immunity", desc: "Persistent: opponents' effects cannot make you lose coins (your own self-costs still apply)" },
  { key: "free_ship_on_build", name: "Free Ship on Wonder Build", desc: "Persistent: after building a wonder stage (and moving the badge track), move any one ship for free" },
  { key: "vp_per_island", name: "VP per Chosen Island", desc: "Choose which of your island cards count; gain X VP per chosen island" },
  { key: "unearth", name: "Unearth", desc: "When played: also play any card from the discard pile for free (no resource/coin cost, no trade)" },
  { key: "mirror", name: "Mirror", desc: "When played: choose a card in your city; this card copies that card's effects" },
  { key: "double_purple", name: "Double Purple", desc: "Your highest-scoring purple (guild) card scores twice" },
];

export const ARMADA_TRACK_COLORS = ["red", "yellow", "blue", "green"];

export const NAVAL_VICTORY_POINTS = { 0: 1, 1: 3, 2: 5, 3: 7 };
export const NAVAL_DEFEAT_POINTS = { 1: -1, 2: -2, 3: -3 };

export const NAVAL_SHIELD_IMAGE = "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/acc30a687_NavalShield.png";
export const ISLAND_IMAGE = "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/9ab4c8872_Island.png";

export const NAVAL_TOKEN_IMAGES = {
  victory: {
    "0": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/02364189a_Age0NavalVictory.png",
    "1": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/767901c38_Age1NavalVictory.png",
    "2": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/97a3fa27e_Age2NavalVictory.png",
    "3": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/a0c6a3363_Age3NavalVictory.png",
  },
  defeat: {
    "1": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/cfd17297f_Age1Navaldefeat.png",
    "2": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/abba9dff0_Age2Navaldefeat.png",
    "3": "https://media.base44.com/images/public/6a67f916b96089d055f69fd3/f425b84c4_Age3Navaldefeat.png",
  },
};

export const ARMADA_REWARDS = {
  red:    { 2:{navalShields:1}, 3:{navalShields:2}, 4:{navalShields:3}, 5:{navalShields:4}, 6:{navalShields:5}, 7:{navalShields:8} },
  yellow: { 2:{trade:1}, 3:{coins:2,trade:1,cull:1}, 4:{coins:3,trade:2}, 5:{coins:4,trade:2,cull:2}, 6:{coins:5,trade:3}, 7:{navalShields:2,trade:4,cull:4} },
  blue:   { 2:{vp:1}, 3:{vp:2}, 4:{vp:4}, 5:{vp:6}, 6:{vp:8}, 7:{vp:10,navalShields:1} },
  green:  { 3:{island:"1"}, 5:{island:"2"}, 7:{island:"3"} },
};

export const VP_COMPARE_METRICS = [
  ...["brown", "gray", "green", "blue", "yellow", "red", "purple", "black", "leader"].map((c) => ({ key: `color:${c}`, name: `${c} cards` })),
  { key: "coins", name: "Coins" },
  { key: "trophies", name: "Trophies" },
];

export const VP_NONE_METRICS = [
  ...["brown", "gray", "green", "blue", "yellow", "red", "purple", "black", "leader"].map((c) => ({ key: `color:${c}`, name: `${c} cards` })),
  { key: "losses", name: "Loss tokens" },
  { key: "coins", name: "Coins" },
];

export const TRIGGER_OPTIONS = [
  { key: "color", name: "Play a card of a color" },
  { key: "wonder_stage", name: "Build a wonder stage" },
  { key: "trophy", name: "Gain a trophy" },
  { key: "discard", name: "Discard a card for coins" },
];

export const SET_ITEM_OPTIONS = [
  ...["brown", "gray", "green", "blue", "yellow", "red", "purple", "black", "leader"].map((c) => ({ key: `color:${c}`, name: `${c} card` })),
  ...SCIENCE_SYMBOLS.map((s) => ({ key: `science:${s.key}`, name: `${s.name} science` })),
];

export const PER_METRICS = [
  { key: "brown_card", name: "Brown card (raw)" },
  { key: "gray_card", name: "Gray card (manufactured)" },
  { key: "blue_card", name: "Blue card (civilian)" },
  { key: "yellow_card", name: "Yellow card (commercial)" },
  { key: "red_card", name: "Red card (military)" },
  { key: "green_card", name: "Green card (science)" },
  { key: "purple_card", name: "Purple card (guild)" },
  { key: "black_card", name: "Black card (cities)" },
  { key: "wonder_stage", name: "Wonder stage built" },
  { key: "neighbor_wonder_stages", name: "Neighbors' wonder stages" },
  { key: "military_victory", name: "Military trophy" },
  { key: "trophy_age1", name: "Age 1 trophy" },
  { key: "trophy_age2", name: "Age 2 trophy" },
  { key: "trophy_age3", name: "Age 3 trophy" },
  { key: "military_defeat", name: "Military defeat" },
  { key: "raw_resource", name: "Raw resource produced" },
  { key: "manufactured_resource", name: "Manufactured resource produced" },
  { key: "science_symbol", name: "Science symbol owned" },
  { key: "chain_symbol", name: "Chain symbol owned" },
  { key: "coins", name: "Coins owned" },
  { key: "coins_third", name: "Coins (per 3)" },
  { key: "own_card_name", name: "Own cards of a specific name" },
  { key: "neighbor_brown", name: "Neighbor's brown cards" },
  { key: "neighbor_gray", name: "Neighbor's gray cards" },
  { key: "neighbor_guild", name: "Both neighbors' guild (purple) cards" },
  { key: "neighbor_green", name: "Neighbor's green cards" },
  { key: "neighbor_blue", name: "Neighbor's blue cards" },
  { key: "neighbor_yellow", name: "Neighbor's yellow cards" },
  { key: "neighbor_red", name: "Neighbor's red cards" },
  { key: "neighbor_black", name: "Neighbor's black cards" },
  { key: "neighbor_leader", name: "Neighbor's leader cards" },
  { key: "own_resources", name: "Own resources (count)" },
  { key: "trade_level", name: "Trade level (Armada)" },
  { key: "most_color", name: "Most-held color count" },
  { key: "islands", name: "Island cards owned" },
  { key: "leader_card", name: "Leader cards played" },
  { key: "naval_victory", name: "Naval victories" },
];

export const EFFECT_TARGETS = [
  { key: "self", name: "Self" },
  { key: "left", name: "Left Neighbor" },
  { key: "right", name: "Right Neighbor" },
  { key: "both", name: "Both Neighbors" },
  { key: "all", name: "Every Opponent" },
];