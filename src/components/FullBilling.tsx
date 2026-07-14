import type { Clue } from "../game/types";
import { revealedClues } from "../game/clues";
import { PersonGlyph } from "./icons";

interface Props {
  clues: Clue[];
  revealedCount: number;
}

export function FullBilling({ clues, revealedCount }: Props) {
  const ordered = [...clues].sort((a, b) => b.index - a.index);
  const revealedIdx = new Set(
    revealedClues(clues, revealedCount).map((c) => c.index),
  );
  return (
    <div className="w-full">
      <div className="eyebrow mb-2.5">The full billing</div>
      <div className="flex flex-col gap-[7px]">
        {ordered.map((c, i) => {
          const wasRevealed = revealedIdx.has(c.index);
          return (
            <div
              key={c.index}
              className={`flex items-center gap-2.5 text-[14px] ${wasRevealed ? "opacity-60" : ""}`}
            >
              <span className="w-[26px] text-muted text-[11px] font-bold">
                {String(ordered.length - i).padStart(2, "0")}
              </span>
              <span
                className={`w-[30px] h-[30px] rounded-full overflow-hidden flex items-end justify-center flex-none ${wasRevealed ? "bg-clue text-white" : "bg-slot-empty text-muted"}`}
              >
                {c.avatar ? (
                  <img
                    src={c.avatar}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <PersonGlyph />
                )}
              </span>
              <span className="font-bold">{c.name}</span>
              {c.character && <span className="text-muted">{c.character}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
