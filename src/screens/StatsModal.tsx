import { useGame } from "../game/store";
import { XIcon } from "../components/icons";
import { Countdown } from "../components/Countdown";

export function StatsModal() {
  const user = useGame((s) => s.user);
  const result = useGame((s) => s.result);
  const close = useGame((s) => s.closeStats);

  const winRate =
    user.played === 0 ? 0 : Math.round((user.wins / user.played) * 100);
  const todayWinScore =
    result.outcome === "won" ? result.remainingPoints : null;

  const hist = user.scoreHistogram;
  const max = Math.max(1, ...Object.values(hist));

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 bg-ink/[0.42] backdrop-blur-[2px] flex items-end md:items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-paper md:rounded-[34px] rounded-t-[34px] px-6 pt-6 pb-7 shadow-sheet text-ink"
      >
        <div className="flex justify-between items-center mb-[22px]">
          <div className="font-display text-[26px] text-ink">Statistics</div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="w-[34px] h-[34px] rounded-full bg-slot-empty flex items-center justify-center text-muted"
          >
            <XIcon width={16} height={16} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-[26px] text-center">
          <Stat value={user.streak} label="Current\nstreak" />
          <Stat value={user.maxStreak} label="Max\nstreak" />
          <Stat value={user.played} label="Played" />
          <Stat value={`${winRate}%`} label="Win rate" pct />
        </div>

        <div className="eyebrow mb-3.5">Guess distribution</div>
        <div className="flex flex-col gap-[9px] mb-[22px]">
          {([6, 5, 4, 3, 2, 1] as const).map((bucket) => {
            const count = hist[bucket];
            const pct = Math.max(8, Math.round((count / max) * 100));
            const isToday = todayWinScore === bucket;
            return (
              <div
                key={bucket}
                className="flex items-center gap-2.5 text-[13px]"
              >
                <span
                  className={`w-[14px] font-bold ${isToday ? "text-accent" : "text-muted"}`}
                >
                  {bucket}
                </span>
                <div
                  style={{ width: `${pct}%` }}
                  className={`h-[22px] rounded-[5px] flex items-center justify-end pr-2 ${isToday ? "bg-accent" : "bg-slot-empty"}`}
                >
                  {isToday && (
                    <span className="text-[12px] font-bold text-accent-ink">
                      {count} · today
                    </span>
                  )}
                </div>
                {!isToday && (
                  <span className="text-[12px] text-muted">{count}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center text-[13px] text-muted border-t border-line pt-4">
          Next movie in <b className="text-ink"><Countdown /></b>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, pct = false }: { value: number | string; label: string; pct?: boolean }) {
  const lines = label.split("\\n");
  return (
    <div>
      <div className="font-display text-[30px] text-accent leading-none">
        {pct ? (
          <>
            {String(value).replace("%", "")}
            <span className="text-[16px]">%</span>
          </>
        ) : (
          value
        )}
      </div>
      <div className="text-[11px] text-muted mt-1.5 leading-[1.2]">
        {lines.map((l, i) => (
          <span key={i}>
            {l}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}
