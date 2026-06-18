import { useEffect, useState } from "react";
import { nextMidnightUtcMs } from "../game/store";

function format(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h} : ${m} : ${s}`;
}

export function Countdown() {
  const [text, setText] = useState(format(nextMidnightUtcMs()));
  useEffect(() => {
    const id = window.setInterval(() => setText(format(nextMidnightUtcMs())), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="font-mono tabular-nums">{text}</span>;
}
