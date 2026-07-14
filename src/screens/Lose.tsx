import { useGame, buildShareGrid } from "../game/store";
import { Header } from "../components/Header";
import { ScoreGrid } from "../components/ScoreSlot";
import { FullBilling } from "../components/FullBilling";
import { PosterPlaceholder } from "../components/PosterPlaceholder";
import { ShareIcon } from "../components/icons";

interface Props {
  onShare: (text: string) => void;
}

export function Lose({ onShare }: Props) {
  const quiz = useGame((s) => s.quiz)!;
  const result = useGame((s) => s.result);
  const openHowToPlay = useGame((s) => s.openHowToPlay);
  const openStats = useGame((s) => s.openStats);

  // A give-up fills a slot without recording a guess.
  const filledSlots = result.slots.filter((s) => s !== "empty").length;
  const gaveUp = filledSlots > result.revealedClues + result.guesses.length;

  return (
    <div className="flex flex-col min-h-screen md:min-h-0 md:h-full">
      <Header size="sm" onOpenRules={openHowToPlay} onOpenStats={openStats} />
      <div className="px-6 pt-3.5 pb-7 flex flex-col items-center">
        <div className="text-[12px] font-bold tracking-[0.2em] uppercase text-muted mb-1.5">
          Better luck
        </div>
        <div className="font-display text-[38px] leading-[0.98] text-ink text-center mb-2">
          {gaveUp ? "Tomorrow's another day" : "Out of points"}
        </div>
        <div className="text-[14px] text-muted text-center mb-5">
          No worries — a fresh one lands tomorrow.
        </div>

        <div className="mb-1.5 w-full">
          <ScoreGrid slots={result.slots} size="sm" />
        </div>
        <div className="text-[13px] font-bold text-incorrect mb-[22px]">X / 6</div>

        <div className="flex gap-4 items-center w-full bg-surface border border-line rounded-card p-3.5 mb-[18px]">
          <PosterPlaceholder src={quiz.image} width={84} height={120} />
          <div className="flex-1">
            <div className="eyebrow mb-1.5">It was</div>
            <div className="font-display text-[25px] leading-[1.02] mb-2">{quiz.title}</div>
            <div className="text-[13.5px] text-muted">
              {quiz.year}
              {quiz.genre && <> · {quiz.genre}</>}
            </div>
          </div>
        </div>

        <div className="mb-5 w-full">
          <FullBilling clues={quiz.clues} revealedCount={result.revealedClues} />
        </div>

        <button
          type="button"
          onClick={() => onShare(buildShareGrid(result, quiz.cluevieQuizId ?? quiz.id))}
          className="btn-outline mb-3.5"
        >
          <ShareIcon width={18} height={18} />
          Share result
        </button>
        <button
          type="button"
          onClick={openStats}
          className="text-[14.5px] font-bold text-accent no-underline"
        >
          See your stats →
        </button>
      </div>
    </div>
  );
}
