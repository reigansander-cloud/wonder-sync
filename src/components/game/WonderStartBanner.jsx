import React from "react";
import { CARD_COLORS } from "@/lib/game/constants";

// Determines which city column the wonder's starting-resource banner goes in:
//   brown  — stone, wood, clay, ore (raw materials)
//   gray   — papyrus, loom, glass (manufactured)
//   leader — no start resource (Rome)
export function wonderStartColumn(wonder) {
  const sr = wonder?.start_resource;
  if (["stone", "wood", "clay", "ore"].includes(sr)) return "brown";
  if (["papyrus", "loom", "glass"].includes(sr)) return "gray";
  return "leader";
}

// A banner showing the top-left corner of the player's wonder board, zoomed
// in so most of the artwork is cropped out. Uses background-image with
// background-size: 500% auto to show only the left 1/5 of the image, anchored
// to the top-left corner. The container has a 461/177 aspect ratio (matching
// card banners). Placed in the city column matching the wonder's starting
// resource. Purely visual — does NOT count as a card of that color.
export default function WonderStartBanner({ wonder, column }) {
  const color = CARD_COLORS.find((c) => c.key === column) || CARD_COLORS[0];
  const hasImg = !!wonder?.image_url;
  return (
    <div
      className="relative rounded-md overflow-hidden border-2 w-full"
      style={{
        borderColor: color.hex,
        aspectRatio: "461 / 177",
        ...(hasImg
          ? {
              backgroundImage: `url(${wonder.image_url})`,
              backgroundSize: "440% auto",
              backgroundPosition: "0% 6%",
              backgroundRepeat: "no-repeat",
            }
          : { background: color.hex }),
      }}
    >
      {!hasImg && (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-white text-[10px] font-semibold leading-tight text-center px-1">{wonder.name}</span>
        </div>
      )}
    </div>
  );
}