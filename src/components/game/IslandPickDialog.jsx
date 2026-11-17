import React, { useState } from "react";
import GainIslandDialog from "./GainIslandDialog";

// Wraps GainIslandDialog with a stable set of 4 random islands from the pool.
// The 4 choices are picked once (on mount) so they don't reshuffle on re-render.
export default function IslandPickDialog({ pool, onConfirm, onCancel }) {
  const [choices] = useState(() => [...pool].sort(() => Math.random() - 0.5).slice(0, 4));
  return <GainIslandDialog islands={choices} onConfirm={onConfirm} onCancel={onCancel} />;
}