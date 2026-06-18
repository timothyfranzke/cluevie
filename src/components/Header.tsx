import { ChartIcon } from "./icons";

interface Props {
  onOpenRules: () => void;
  onOpenStats: () => void;
  size?: "lg" | "sm";
}

export function Header({ onOpenRules, onOpenStats, size = "lg" }: Props) {
  const logo = size === "lg" ? "text-[27px]" : "text-[23px]";
  const btn = size === "lg" ? "w-[38px] h-[38px]" : "w-9 h-9";
  return (
    <div className="flex justify-between items-center px-[18px] pt-2 pb-[6px]">
      <span className={`font-display text-accent leading-none ${logo}`}>Cluevie</span>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onOpenRules}
          aria-label="How to play"
          className={`${btn} rounded-full border-[1.6px] border-line flex items-center justify-center font-extrabold text-[16px] text-muted hover:text-ink transition`}
        >
          ?
        </button>
        <button
          type="button"
          onClick={onOpenStats}
          aria-label="Statistics"
          className={`${btn} rounded-full border-[1.6px] border-line flex items-center justify-center text-muted hover:text-ink transition`}
        >
          <ChartIcon />
        </button>
      </div>
    </div>
  );
}
