// Presentational helpers extracted from GameRoom for the queue-based flow.
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Users, MapPin, X } from "lucide-react";
import CardView from "@/components/game/CardView";
import WonderBanner from "@/components/game/WonderBanner";
import WonderStartBanner, { wonderStartColumn } from "@/components/game/WonderStartBanner";
import TokenInventory from "@/components/game/TokenInventory";
import PatronageBadges from "@/components/game/PatronageBadges";
import ShipyardPanel from "@/components/game/ShipyardPanel";
import LeadersHandButton from "@/components/game/LeadersHandButton";
import NotificationsRow from "@/components/game/NotificationsRow";
import CardDetailModal from "@/components/game/CardDetailModal";
import { describeEffect } from "@/components/game/EffectEditor";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { getWonder } from "@/lib/game/constants";
import { getProducibleResources, getScienceCardAssignments, hasEffect,
  canAfford, canFreeCard, hasDuplicateName, playerHasDiplomacy,
  getIslands, leaderCoinCost, isCostFree, nextAge,
} from "@/lib/game/rules";
import { ResourceIcon, CoinIcon, VPIcon, ShieldIcon, DiplomacyIcon, NavalShieldIcon } from "@/components/game/Icons";
import CoinDisplay from "@/components/game/CoinDisplay";

export function cardStatus(card, me, neighbors, allCardsById, farNeighbors, game) {
  if (hasDuplicateName(me, card, allCardsById)) return "duplicate";
  if (card.chain_cost && (me.played_cards || []).some((pc) => (allCardsById[pc.id] || pc).chain_symbols?.includes(card.chain_cost))) return "free";
  const res = canAfford(me, card, neighbors.left, neighbors.right, allCardsById, farNeighbors);
  if (!res.ok) return canFreeCard(me, card, game, allCardsById) ? "free_card" : "none";
  if (res.tradePairs.length > 0) return "trade";
  return "free";
}

// Leader affordability with Rome's coin reduction applied (own + neighbor).
// Returns { status, displayCost } where status is "free" (affordable, incl.
// via discount), "none" (unaffordable even with discount), or "duplicate".
export function leaderStatus(card, me, allPlayers, allCardsById, game) {
  if (hasDuplicateName(me, card, allCardsById)) return { status: "duplicate", displayCost: null };
  const freeChain = card.chain_cost && (me.played_cards || []).some((pc) => (allCardsById[pc.id] || pc).chain_symbols?.includes(card.chain_cost));
  if (freeChain) return { status: "free", displayCost: 0 };
  if (isCostFree(me, card, allCardsById)) return { status: "free", displayCost: 0 };
  const gameAge = game?.age === "leader" ? Number(nextAge(game.age)) : Number(game?.age) || 0;
  const cost = leaderCoinCost(me, card, allPlayers, gameAge);
  if (cost > (me.coins || 0)) return { status: "none", displayCost: cost };
  return { status: "free", displayCost: cost };
}

export function HandCard({ card, mode, me, neighbors, allCardsById, farNeighbors, game, onChoose, players }) {
  const [hover, setHover] = useState(false);
  const leaderInfo = mode === "leader" && players ? leaderStatus(card, me, players, allCardsById, game) : null;
  const status = mode === "play" ? cardStatus(card, me, neighbors, allCardsById, farNeighbors, game)
    : mode === "leader" ? (leaderInfo?.status || "free") : undefined;
  const displayCost = leaderInfo?.displayCost;
  const primary = mode === "play" ? "play" : mode === "pick" ? "pick" : mode === "leader" ? "play_leader" : "build";
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <CardView card={card} size="md" status={status} displayCost={displayCost} selected={me.chosen_card_id === card.id} onClick={() => onChoose(card.id, primary)} />
        {mode === "build" && (
          <div className="absolute inset-0 rounded-lg bg-red-600/40 border-2 border-red-500 flex items-center justify-center pointer-events-none">
            <X className="h-10 w-10 text-red-200 drop-shadow-lg" />
          </div>
        )}
        {hover && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 rounded-lg bg-stone-800 border border-white/20 shadow-xl z-50 text-xs space-y-1 pointer-events-none">
            <p className="font-semibold">{card.name}</p>
            {card.description && <p className="text-stone-300 italic">{card.description}</p>}
            {(card.effects || []).map((e, i) => <p key={i} className="text-stone-300">• {describeEffect(e)}</p>)}
            {(card.cost_coins || 0) < 0 && <p className="text-amber-300">Costs A coins (the current age)</p>}
            {(card.cost_coins || 0) > 0 && <p className="text-amber-300">Costs {card.cost_coins} coins</p>}
            {displayCost != null && displayCost < Math.max(0, card.cost_coins || 0) && <p className="text-emerald-300">Reduced to {displayCost} coins (Rome)</p>}
          </div>
        )}
      </div>
      {mode !== "pick" && (
        <div className="flex gap-1">
          {mode === "play" && (
            <div className="flex gap-1 w-full">
              <Button size="sm" className="h-7 text-xs flex-1 bg-amber-400 hover:bg-amber-500 text-black font-semibold" onClick={() => onChoose(card.id, "discard")}>
                <CoinIcon size={12} className="mr-0.5" />3
              </Button>
              {game?.armada_expansion && (
                <Button size="sm" className="h-7 text-xs flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold" onClick={() => onChoose(card.id, "discard_armada")}>
                  ⛵
                </Button>
              )}
            </div>
          )}
          {mode === "build" && (
            <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700" onClick={() => onChoose(card.id, "build")}>Build Wonder</Button>
          )}
          {mode === "leader" && (
            <div className="flex gap-1 w-full">
              <Button size="sm" className="h-7 text-xs flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => onChoose(card.id, "play_leader")}>Play Leader</Button>
              <Button size="sm" className="h-7 text-xs flex-1 bg-amber-400 hover:bg-amber-500 text-black font-semibold" onClick={() => onChoose(card.id, "discard")}>
                <CoinIcon size={12} className="mr-0.5" />3
              </Button>
              {game?.armada_expansion && (
                <Button size="sm" className="h-7 text-xs flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold" onClick={() => onChoose(card.id, "discard_armada")}>
                  ⛵
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StageCost({ cost, coins = 0 }) {
  const entries = Object.entries(cost || {});
  if (!entries.length && !coins) return <span className="text-[10px] text-stone-400">Free</span>;
  return (
    <span className="flex items-center gap-1">
      {entries.map(([r, n]) => (
        <span key={r} className="flex items-center gap-0.5">
          <ResourceIcon resource={r} size={14} />
          <span className="text-[10px] font-semibold">×{n}</span>
        </span>
      ))}
      {coins > 0 && (
        <span className="flex items-center gap-0.5">
          <CoinIcon size={14} />
          <span className="text-[10px] font-semibold">×{coins}</span>
        </span>
      )}
    </span>
  );
}

export function MyBoard({ me, allPlayers, allCardsById, myScore, producible, canBuildWonder, buildMode, onStartBuild, age, game, armadaOn, onSetBoardingSide, onOpenIslandVp, onOpenCoinLog, onOpenVpBreakdown }) {
  const [viewCard, setViewCard] = useState(null);
  const wonder = getWonder(me.wonder, me.wonder_side);
  const peaceful = playerHasDiplomacy(me, allCardsById, age);
  const played = (me.played_cards || []);
  const byColor = { brown: [], gray: [], green: [], blue: [], yellow: [], red: [], purple: [], black: [], leader: [], island: [] };
  for (const c of played) { const full = allCardsById[c.id] || c; const key = (full.is_island || full.pack === "island") ? "island" : full.color; if (byColor[key]) byColor[key].push(full); }
  byColor[wonderStartColumn(wonder)].unshift({ is_wonder_banner: true, wonder });
  const leadersHeld = me.leaders_hand || [];
  const presentColors = ["brown", "gray", "green", "blue", "yellow", "red", "purple", "black", "leader", "island"].filter((col) => byColor[col].length > 0);
  const scienceAssign = getScienceCardAssignments(me, allPlayers, allCardsById);
  const canBoard = allPlayers.length > 3 && hasEffect(me, "boarding", allCardsById);
  const hasIslandVp = (played.some((c) => (allCardsById[c.id] || c).effects?.some((e) => e.kind === "vp_per_island")));
  const myIslands = getIslands(me, allCardsById);

  return (
    <UICard className="bg-white/5 border-white/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full" style={{ background: me.player_color }} />
                {me.is_ai && <Bot className="h-4 w-4 text-blue-400" />}
                <span className="font-semibold text-lg">{me.player_name} (You)</span>
              </div>
              <CoinDisplay coins={me.coins} size={22} onClick={onOpenCoinLog} title="Click to view coin history" />
              <button type="button" onClick={onOpenVpBreakdown} className="flex items-center gap-1.5 hover:opacity-70 transition" title="Click to view VP breakdown"><VPIcon size={22} /><span className="text-lg font-bold text-amber-300">{myScore?.total ?? 0}</span></button>
              <div className="flex items-center gap-1.5">{peaceful ? <span className="text-emerald-300" title="Diplomacy — skips military AND naval this age"><DiplomacyIcon size={22} /></span> : <><ShieldIcon size={22} /><span className="text-lg font-semibold">{me.shields}</span></>}</div>
              {armadaOn && !peaceful && <div className="flex items-center gap-1.5"><NavalShieldIcon size={22} /><span className="text-lg font-semibold">{me.naval_shields || 0}</span></div>}
              <TokenInventory player={me} size={22} />
              <PatronageBadges player={me} game={game} />
              <span className="text-sm text-stone-400">{wonder.name}</span>
            </div>

            {wonder.image_url ? null : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-stone-500 uppercase">Wonder stages:</span>
                <TooltipProvider delayDuration={150}>
                  {wonder.stages.map((st, i) => {
                    const built = i < me.wonder_stages_built;
                    const isNext = i === me.wonder_stages_built;
                    const clickable = isNext && canBuildWonder;
                    const cls = built ? "bg-amber-500/20 border-amber-500 text-amber-300" : clickable ? (buildMode ? "bg-purple-600 border-purple-400 text-white animate-pulse" : "bg-white/10 border-white/30 text-white hover:bg-white/20 cursor-pointer") : "bg-white/5 border-white/10 text-stone-500";
                    const effectText = (st.effects || []).map(describeEffect).filter(Boolean).join(" ");
                    return (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <button type="button" disabled={!clickable} onClick={clickable ? onStartBuild : undefined} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors disabled:cursor-not-allowed ${cls}`}>
                            <span className="font-semibold">{built ? "✓" : i + 1}</span>
                            <StageCost cost={st.cost} coins={st.cost_coins || 0} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px]">
                          <p className="font-semibold mb-0.5">Stage {i + 1}{built ? " — built" : ""}</p>
                          <p className="text-[11px] leading-snug">{effectText || "No effect."}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
                {buildMode && <span className="text-[10px] text-purple-300 ml-1">Pick a card from hand to remove…</span>}
                {!buildMode && canBuildWonder && <span className="text-[10px] text-stone-400 ml-1">Click stage {me.wonder_stages_built + 1} to build</span>}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <LeadersHandButton leaders={leadersHeld} />
              <NotificationsRow player={me} />
              {canBoard && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-900/30 border border-red-500/40">
                  <span className="text-[10px] text-red-300 uppercase font-semibold">Board</span>
                  <button type="button" onClick={() => onSetBoardingSide("right2")} className={`px-1.5 py-0.5 rounded text-xs ${me.boarding_side === "right2" ? "bg-red-500 text-white" : "bg-white/10 text-stone-300 hover:bg-white/20"}`} title="Board the player 2 seats to your right">◄ 2R</button>
                  <button type="button" onClick={() => onSetBoardingSide("left2")} className={`px-1.5 py-0.5 rounded text-xs ${me.boarding_side === "left2" ? "bg-red-500 text-white" : "bg-white/10 text-stone-300 hover:bg-white/20"}`} title="Board the player 2 seats to your left">2L ►</button>
                </div>
              )}
              {hasIslandVp && myIslands.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/50 text-amber-300" onClick={onOpenIslandVp}>
                  <MapPin className="h-3.5 w-3.5 mr-1" />Islands {(me.island_vp_choices || []).length}/{myIslands.length}
                </Button>
              )}
            </div>
          </div>
          {wonder.image_url && (
            <div className="w-full lg:w-[450px] shrink-0 space-y-1 self-start">
              <WonderBanner wonder={wonder} built={me.wonder_stages_built || 0} canBuild={canBuildWonder} onBuild={onStartBuild} />
              {buildMode && <p className="text-[10px] text-purple-300">Pick a card from hand to remove…</p>}
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase text-stone-500 mb-1">Played</div>
          <div className="grid grid-cols-3 md:flex md:flex-wrap md:items-end gap-2 md:gap-3">
            {presentColors.length === 0 ? (
              <span className="text-stone-600 text-xs italic col-span-3 md:col-span-1">No cards played yet</span>
            ) : presentColors.map((color) => (
              <div key={color} className="w-full md:w-28 space-y-1">
                <div className="text-[10px] uppercase text-stone-500">{color}</div>
                <div className="space-y-1">
                  {byColor[color].map((c, i) => c.is_wonder_banner ? <WonderStartBanner key="wonder-banner" wonder={c.wonder} column={color} /> : <CardView key={i} card={c} size="sm" banner topCrop hideName scienceSymbol={scienceAssign[c.id]?.[0]} onClick={() => setViewCard(c)} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
        {viewCard && <CardDetailModal card={viewCard} onClose={() => setViewCard(null)} />}
      </CardContent>
    </UICard>
  );
}

export function NeighborPanel({ player, label, allCardsById, onInspect, age, armadaOn }) {
  if (!player) return <UICard className="bg-white/5 border-white/10"><CardContent className="p-1.5 md:p-4 text-stone-500 text-xs md:text-sm">—</CardContent></UICard>;
  const wonder = getWonder(player.wonder, player.wonder_side);
  const resources = getProducibleResources(player, allCardsById);
  const peaceful = playerHasDiplomacy(player, allCardsById, age);
  return (
    <UICard onClick={onInspect} className="bg-white/5 border-white/10 cursor-pointer hover:bg-white/[0.07] transition" style={{ boxShadow: `inset 0 0 0 1px ${player.player_color}40` }}>
      <CardContent className="p-1.5 md:p-3 space-y-1 md:space-y-2">
        <div className="flex items-center gap-1 md:gap-2 min-w-0">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shrink-0" style={{ background: player.player_color }} />
          {player.is_ai && <Bot className="h-3 w-3 md:h-3.5 md:w-3.5 text-blue-400 shrink-0" />}
          <span className="font-semibold text-xs md:text-base truncate">{player.player_name}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-3 text-[10px] md:text-sm text-stone-200 flex-wrap">
          <span className="flex items-center gap-0.5"><CoinIcon size={14} /><span className="font-semibold">{player.coins}</span></span>
          {peaceful ? <span className="flex items-center gap-0.5 text-emerald-300" title="Diplomacy — skips military AND naval this age"><DiplomacyIcon size={14} /></span> : <span className="flex items-center gap-0.5"><ShieldIcon size={14} /><span className="font-semibold">{player.shields}</span></span>}
          {armadaOn && !peaceful && <span className="flex items-center gap-0.5"><NavalShieldIcon size={14} /><span className="font-semibold">{player.naval_shields || 0}</span></span>}
          <span className="text-stone-400 hidden md:inline">{wonder.name.split(" (")[0]} ({player.wonder_stages_built}/{wonder.stages.length})</span>
          <span className="text-stone-400 md:hidden">{player.wonder_stages_built}/{wonder.stages.length}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-wrap">
          {Object.entries(resources.tradeableFixed).filter(([, v]) => v > 0).map(([r, v]) => Array.from({ length: v }).map((_, i) => <ResourceIcon key={r + i} resource={r} size={14} />))}
          {resources.tradeableChoices.map((ch, i) => <div key={i} className="flex items-center gap-0.5">{ch.map((r) => <ResourceIcon key={r} resource={r} size={12} />)}</div>)}
        </div>
      </CardContent>
    </UICard>
  );
}

export function OtherPlayersButton({ players, myId, neighbors, onPick }) {
  const [open, setOpen] = useState(false);
  const me = players.find((p) => p.id === myId);
  const n = players.length;
  const others = players
    .filter((p) => p.id !== myId && p.id !== neighbors.left?.id && p.id !== neighbors.right?.id)
    .sort((a, b) => (((a.seat - me.seat + n) % n) - ((b.seat - me.seat + n) % n)));
  if (others.length === 0) return null;
  return (
    <div className="relative flex-1 flex flex-col">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 min-h-[56px] md:min-h-[80px] rounded-xl border bg-white/5 border-white/10 hover:bg-white/[0.07] transition p-1.5 md:p-4 flex flex-col items-center justify-center gap-0.5 md:gap-1 text-stone-200">
        <Users className="h-5 w-5 md:h-6 md:w-6 text-amber-400" />
        <span className="font-medium text-[11px] md:text-sm">Other Players</span>
        <span className="text-[9px] md:text-[10px] text-stone-400">{others.length} more</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-2 left-0 right-0 rounded-lg border border-white/10 bg-stone-900 shadow-xl p-2 flex gap-1.5 flex-wrap justify-center">
            {others.map((p) => (
              <button key={p.id} onClick={() => { setOpen(false); onPick(p.id); }} className="flex flex-col items-center gap-1 px-2 py-1.5 rounded hover:bg-white/10 min-w-[64px]">
                <div className="w-3 h-3 rounded-full" style={{ background: p.player_color }} />
                {p.is_ai && <Bot className="h-3 w-3 text-blue-400" />}
                <span className="text-xs max-w-[72px] truncate text-center">{p.player_name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function InspectOverlay({ player, allPlayers, allCardsById, score, onClose, isSelf, age, game, armadaOn }) {
  const [showShipyard, setShowShipyard] = useState(false);
  const wonder = getWonder(player.wonder, player.wonder_side);
  const played = (player.played_cards || []);
  const leaders = player.leaders_hand || [];
  const peaceful = playerHasDiplomacy(player, allCardsById, age);
  const scienceAssign = getScienceCardAssignments(player, allPlayers, allCardsById);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16" style={{ background: `rgba(0,0,0,0.85)` }}>
      <div className="absolute inset-0" style={{ background: `${player.player_color}15` }} onClick={onClose} />
      <UICard className="relative max-w-3xl w-full max-h-[75vh] overflow-y-auto bg-stone-900 border-white/20" style={{ boxShadow: `0 0 60px ${player.player_color}60` }}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: player.player_color }} />
              {player.is_ai && <Bot className="h-4 w-4 text-blue-400" />}
              <h2 className="text-xl font-bold">{player.player_name}</h2>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1"><CoinIcon size={16} />{player.coins} coins</span>
            <span className="flex items-center gap-1"><VPIcon size={16} />{score.total} VP</span>
            {peaceful ? <span className="flex items-center gap-1 text-emerald-300" title="Diplomacy — skips military AND naval this age"><DiplomacyIcon size={16} /> Diplomacy</span> : <span className="flex items-center gap-1"><ShieldIcon size={16} />{player.shields} shields</span>}
            {armadaOn && !peaceful && <span className="flex items-center gap-1"><NavalShieldIcon size={16} />{player.naval_shields || 0} naval</span>}
            <TokenInventory player={player} size={20} />
            <PatronageBadges player={player} game={game} />
            <span>Wonder: {wonder.name} ({player.wonder_stages_built}/{wonder.stages.length})</span>
          </div>
          {isSelf && leaders.length > 0 && (
            <div>
              <p className="text-xs text-stone-500 uppercase mb-2">Leaders in hand ({leaders.length})</p>
              <div className="flex flex-wrap gap-2">
                {leaders.map((c, i) => <div key={i} className="w-40"><CardView card={c} banner /></div>)}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-stone-500 uppercase mb-2">Cards in Play ({played.length})</p>
            <div className="flex flex-wrap gap-2">
              <div className="w-40"><WonderStartBanner wonder={wonder} column={wonderStartColumn(wonder)} /></div>
              {played.map((c, i) => <div key={i} className="w-40"><CardView card={allCardsById[c.id] || c} banner scienceSymbol={scienceAssign[(allCardsById[c.id] || c).id]?.[0]} /></div>)}
            </div>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase mb-2">Wonder — {wonder.name} ({player.wonder_stages_built || 0}/{wonder.stages.length})</p>
            {wonder.image_url ? (
              <div className="max-w-[450px]"><WonderBanner wonder={wonder} built={player.wonder_stages_built || 0} /></div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {(wonder.stages || []).map((stage, i) => {
                  const built = i < (player.wonder_stages_built || 0);
                  return (
                    <div key={i} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${built ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/5 opacity-70"}`}>
                      <span className={`text-xs font-bold w-6 text-center ${built ? "text-emerald-400" : "text-stone-500"}`}>{built ? "✓" : i + 1}</span>
                      <StageCost cost={stage.cost} coins={stage.cost_coins || 0} />
                      <span className="text-[11px] text-stone-400 ml-auto text-right">{(stage.effects || []).map((e) => describeEffect(e)).join(", ")}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {armadaOn && player.armada_board && Object.keys(player.armada_board || {}).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-stone-500 uppercase">Shipyard</p>
                <button type="button" onClick={() => setShowShipyard((v) => !v)} className="text-xs text-cyan-300 hover:underline">{showShipyard ? "Hide" : "View"} Shipyard</button>
              </div>
              {showShipyard && <ShipyardPanel player={player} />}
            </div>
          )}
        </CardContent>
      </UICard>
    </div>
  );
}

export async function writeNotifs(ctx, playerList) {
  if (!ctx?.notifs || !Object.keys(ctx.notifs).length) return;
  const patches = [];
  for (const p of playerList) {
    const inc = ctx.notifs[p.id] || [];
    if (!inc.length) continue;
    patches.push({ id: p.id, notifications: [...(p.notifications || []), ...inc].slice(-50) });
  }
  if (patches.length) await base44.entities.PlayerState.bulkUpdate(patches);
}