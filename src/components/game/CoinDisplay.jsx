import React, { useState, useEffect, useRef } from "react";
import { CoinIcon } from "@/components/game/Icons";

// Shows the player's coin balance with a floating "+X" / "-X" animation
// whenever the value changes. Green for gains, red for losses.
export default function CoinDisplay({ coins, size = 22, onClick, title }) {
  const [floats, setFloats] = useState([]);
  const prevRef = useRef(coins);
  const idRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    if (coins !== prev) {
      const delta = coins - prev;
      const id = idRef.current++;
      setFloats((f) => [...f, { id, delta }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1400);
    }
    prevRef.current = coins;
  }, [coins]);

  return (
    <button type="button" onClick={onClick} className="relative flex items-center gap-1.5 hover:opacity-70 transition" title={title}>
      <CoinIcon size={size} />
      <span className="text-lg font-semibold">{coins}</span>
      {floats.map((f) => (
        <span
          key={f.id}
          className="absolute left-1/2 -translate-x-1/2 -top-2 pointer-events-none flex items-center gap-0.5 font-bold coin-float"
        >
          <CoinIcon size={14} className={f.delta > 0 ? "coin-glow-green" : "coin-glow-red"} />
          <span className={f.delta > 0 ? "text-emerald-400" : "text-red-400"}>
            {f.delta > 0 ? "+" : ""}{f.delta}
          </span>
        </span>
      ))}
    </button>
  );
}