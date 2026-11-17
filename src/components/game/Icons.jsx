import React from "react";
import { RESOURCE_ICONS, ICONS, SCIENCE_SYMBOLS, NAVAL_SHIELD_IMAGE } from "@/lib/game/constants";
import { cn } from "@/lib/utils";

export function ResourceIcon({ resource, size = 24, className }) {
  const src = RESOURCE_ICONS[resource];
  if (!src) return null;
  return <img src={src} alt={resource} style={{ width: size, height: size }} className={cn("object-contain drop-shadow", className)} />;
}

export function CoinIcon({ size = 20, className }) {
  return <img src={ICONS.coin} alt="coin" style={{ width: size, height: size }} className={cn("object-contain drop-shadow", className)} />;
}

export function VPIcon({ size = 20, className }) {
  return <img src={ICONS.vp} alt="vp" style={{ width: size, height: size }} className={cn("object-contain drop-shadow", className)} />;
}

export function ShieldIcon({ size = 20, className }) {
  return <img src={ICONS.shield} alt="shield" style={{ width: size, height: size }} className={cn("object-contain drop-shadow", className)} />;
}

export function ScienceIcon({ symbol, size = 20, className }) {
  const s = SCIENCE_SYMBOLS.find((x) => x.key === symbol);
  if (!s) return null;
  return <img src={s.icon} alt={s.name} style={{ width: size, height: size }} className={cn("object-contain drop-shadow", className)} />;
}

const DIPLOMACY_ICON = "https://pcfxwugndktkomxgfauc.supabase.co/storage/v1/object/public/uploads/imported/aa771d6231_e7ceb3f6d_Diplomacy.png";
export function DiplomacyIcon({ size = 20, className }) {
  return <img src={DIPLOMACY_ICON} alt="diplomacy" style={{ width: size, height: size }} className={cn("object-contain drop-shadow", className)} />;
}

export function NavalShieldIcon({ size = 20, className }) {
  return <img src={NAVAL_SHIELD_IMAGE} alt="naval shields" style={{ width: size, height: size }} className={cn("object-contain drop-shadow", className)} />;
}