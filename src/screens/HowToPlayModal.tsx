import { useGame } from "../game/store";

export function HowToPlayModal() {
  const close = useGame((s) => s.closeHowToPlay);
  const accept = useGame((s) => s.acceptRules);

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 bg-ink/[0.42] backdrop-blur-[2px] flex items-end md:items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-paper md:rounded-[34px] rounded-t-[34px] px-6 pt-7 pb-7 shadow-sheet text-ink"
      >
        <div className="font-display text-[30px] text-accent leading-none mb-1.5">How to play</div>
        <div className="text-[14px] text-muted mb-6">
          One mystery movie. Every day. Everyone gets the same one.
        </div>

        <div className="flex flex-col gap-[18px] mb-[22px]">
          <Rule num={1}>
            <b>Five clues, reverse billing.</b> The cast reveals from an obscure character
            actor up to the headliner.
          </Rule>
          <Rule num={2}>
            <b>You start with six points.</b> Revealing a clue costs one. A wrong guess costs one.
          </Rule>
          <Rule num={3}>
            <b>Guess any time.</b> Name the film right and your remaining points are your score. The
            fewer clues, the better.
          </Rule>
        </div>

        <div className="bg-surface border border-line rounded-card p-3.5 mb-6">
          <div className="eyebrow mb-3">Your grid</div>
          <div className="flex flex-col gap-2.5 text-[13px]">
            <Legend color="bg-clue">Clue revealed</Legend>
            <Legend color="bg-correct">The winning guess</Legend>
            <Legend color="bg-incorrect">A wrong guess</Legend>
            <Legend color="bg-slot-empty border-[1.5px] border-line">Points to spare</Legend>
          </div>
        </div>

        <button type="button" onClick={accept} className="btn-primary mb-2.5">
          Got it — let's play
        </button>
        <div className="text-center">
          <button
            type="button"
            onClick={close}
            className="text-[14px] font-semibold text-muted"
          >
            I'll wait for tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}

function Rule({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 items-start">
      <span className="w-[30px] h-[30px] rounded-full bg-accent text-accent-ink font-extrabold text-[14px] flex items-center justify-center flex-none">
        {num}
      </span>
      <div className="text-[14.5px] leading-[1.45]">{children}</div>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-[22px] h-[22px] rounded-[6px] flex-none ${color}`} />
      {children}
    </div>
  );
}
