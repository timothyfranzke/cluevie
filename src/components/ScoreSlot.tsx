import type { SlotState } from "../game/types";
import { CheckIcon, TicketIcon, XIcon } from "./icons";

interface Props {
  state: SlotState;
  size?: "lg" | "sm";
}

export function ScoreSlot({ state, size = "lg" }: Props) {
  const base =
    size === "lg"
      ? "aspect-square rounded-[11px]"
      : "aspect-square rounded-slot";
  if (state === "empty") {
    return <div className={`${base} bg-slot-empty border-[1.5px] border-line`} />;
  }
  if (state === "clue") {
    return (
      <div className={`${base} bg-clue flex items-center justify-center text-clue`}>
        <TicketIcon width={size === "lg" ? 22 : 20} height={size === "lg" ? 22 : 20} />
      </div>
    );
  }
  if (state === "correct") {
    return (
      <div className={`${base} bg-correct flex items-center justify-center`}>
        <CheckIcon width={size === "lg" ? 17 : 17} height={size === "lg" ? 17 : 17} />
      </div>
    );
  }
  return (
    <div className={`${base} bg-incorrect flex items-center justify-center text-white`}>
      <XIcon width={size === "lg" ? 18 : 16} height={size === "lg" ? 18 : 16} />
    </div>
  );
}

interface GridProps {
  slots: SlotState[];
  size?: "lg" | "sm";
}

export function ScoreGrid({ slots, size = "lg" }: GridProps) {
  const gap = size === "lg" ? "gap-2" : "gap-[7px]";
  return (
    <div className={`grid grid-cols-6 ${gap} w-full`}>
      {slots.map((s, i) => (
        <ScoreSlot key={i} state={s} size={size} />
      ))}
    </div>
  );
}
