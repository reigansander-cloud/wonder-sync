import React from "react";
import { CARD_COLORS } from "@/lib/game/constants";
import { cn } from "@/lib/utils";
import { ScienceIcon } from "./Icons";

export default function CardView({ card, size = "md", onClick, selected, disabled, status, banner, topCrop, hideName, scienceSymbol, displayCost }) {
  if (!card) {
    const ph = { sm: "w-14", md: "w-28", lg: "w-[461px]" }[size];
    return <div className={cn("rounded-lg border-2 border-white/10 bg-white/5", ph)} style={{ aspectRatio: banner ? (topCrop ? "461 / 177" : "461 / 283") : "461 / 709" }} />;
  }
  const color = (card.is_island || card.pack === "island")
    ? { key: "island", name: "Island", hex: "#2dd4bf" }
    : (CARD_COLORS.find((c) => c.key === card.color) || CARD_COLORS[0]);

  if (banner) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "relative rounded-md overflow-hidden border-2 cursor-pointer transition-all bg-black w-full",
          selected ? "ring-4 ring-amber-400" : "hover:opacity-90",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ borderColor: color.hex, aspectRatio: topCrop ? "461 / 177" : "461 / 283" }}
      >
        {card.image_url ? (
          <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" style={{ objectPosition: "center 2%" }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-1 text-center" style={{ background: color.hex }}>
            {!hideName && <span className="text-white text-[10px] font-semibold leading-tight">{card.name}</span>}
          </div>
        )}
        {!hideName && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent px-1 pt-2 pb-0.5">
            <p className="text-white text-[9px] font-semibold truncate">{card.name}</p>
          </div>
        )}
        {scienceSymbol && (
          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 bg-black/75 rounded-sm p-0.5 flex items-center">
            <ScienceIcon symbol={scienceSymbol} size={size === "sm" ? 14 : 18} />
          </div>
        )}
      </div>
    );
  }

  const widths = { sm: "w-14", md: "w-28", lg: "w-[461px]" };
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all bg-black",
        widths[size],
        selected
        ? "ring-4 ring-amber-400 scale-105"
        : status === "none"
          ? "opacity-40 grayscale"
          : status === "duplicate"
            ? "opacity-40"
            : status === "free_card"
              ? "shadow-[0_0_15px_3px_rgba(16,185,129,0.7)] ring-2 ring-emerald-400"
              : "hover:scale-105",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={{ borderColor: color.hex, aspectRatio: "461 / 709" }}
    >
      {card.image_url ? (
        <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2 text-center" style={{ background: color.hex }}>
          <span className="text-white text-xs font-semibold leading-tight">{card.name}</span>
        </div>
      )}
      {(status === "trade" || status === "duplicate") ? (
        <div className={cn("absolute bottom-0 inset-x-0 px-1 py-0.5 flex items-center justify-center", status === "trade" ? "bg-yellow-400" : "bg-red-600")}>
          <p className={cn("text-[10px] font-bold truncate leading-tight", status === "trade" ? "text-black" : "text-white")}>{card.name}</p>
        </div>
      ) : (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1">
          <p className="text-white text-[10px] font-semibold truncate">{card.name}</p>
        </div>
      )}
      {(card.cost_coins || 0) !== 0 && (
        <div className={`absolute top-1 right-1 text-black text-[10px] font-bold rounded-full px-1.5 ${displayCost != null && displayCost < (card.cost_coins > 0 ? card.cost_coins : 0) ? "bg-emerald-500" : "bg-amber-500"}`}>
          {(card.cost_coins || 0) < 0 ? "A" : `${displayCost != null ? displayCost : card.cost_coins}c`}
        </div>
      )}
    </div>
  );
}