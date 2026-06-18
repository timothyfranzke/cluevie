import type { Clue } from "../game/types";
import { Avatar } from "./Avatar";

interface Props {
  clue: Clue;
  ordinal: number;
  total: number;
  reveal?: boolean;
}

export function ClueCard({ clue, ordinal, total, reveal = false }: Props) {
  return (
    <div
      className={`flex gap-3.5 items-center p-[15px] bg-surface border border-line rounded-card shadow-card ${reveal ? "animate-iris-once" : ""}`}
    >
      <Avatar src={clue.avatar} size={62} />
      <div className="flex-1">
        <div className="eyebrow-accent mb-[3px]">
          Clue {ordinal} of {total}
        </div>
        <div className="text-[18px] font-bold leading-[1.15]">{clue.name}</div>
        {clue.character && (
          <div className="text-[13.5px] text-muted">as {clue.character}</div>
        )}
      </div>
    </div>
  );
}
