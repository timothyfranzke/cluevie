import type { Clue } from "../game/types";
import { Avatar } from "./Avatar";

interface Props {
  clues: Clue[];
}

export function CastRecap({ clues }: Props) {
  return (
    <div
      className={`grid gap-3 ${clues.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
    >
      {clues.map((c) => (
        <div
          key={c.index}
          className="flex flex-col items-center text-center gap-2 bg-surface border border-line rounded-card shadow-card p-3.5"
        >
          <Avatar src={c.avatar} size={48} />
          <div>
            <div className="text-[14px] font-bold leading-tight">{c.name}</div>
            {c.character && (
              <div className="text-[12.5px] text-muted">as {c.character}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
