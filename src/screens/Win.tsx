import { useGame, buildShareGrid } from "../game/store";
import { Header } from "../components/Header";
import { ScoreGrid } from "../components/ScoreSlot";
import { FullBilling } from "../components/FullBilling";
import { PosterPlaceholder } from "../components/PosterPlaceholder";
import { ShareIcon } from "../components/icons";

interface Props {
  onShare: (text: string) => void;
}

export function Win({ onShare }: Props) {
  const quiz = useGame((s) => s.quiz)!;
  const result = useGame((s) => s.result);
  const openHowToPlay = useGame((s) => s.openHowToPlay);
  const openStats = useGame((s) => s.openStats);

  return (
    <div className="flex flex-col min-h-screen md:min-h-0 md:h-full">
      <Header size="sm" onOpenRules={openHowToPlay} onOpenStats={openStats} />
      <div className="px-6 pt-3.5 pb-7 flex flex-col items-center">
        <div className="text-[12px] font-bold tracking-[0.2em] uppercase text-correct mb-1.5">
          Solved
        </div>
        <div className="font-display text-[46px] leading-[0.95] text-accent mb-2">
          Got it!
        </div>
        <div className="text-[14px] text-muted text-center mb-5">
          Nailed it with{" "}
          <b className="text-ink">
            {result.remainingPoints} point{result.remainingPoints === 1 ? "" : "s"}
          </b>{" "}
          to spare.
        </div>

        <div className="mb-1.5 w-full">
          <ScoreGrid slots={result.slots} size="sm" />
        </div>
        <div className="text-[13px] font-bold text-muted mb-[22px]">
          {result.remainingPoints} / 6
        </div>

        <div className="flex gap-4 items-center w-full bg-surface border border-line rounded-card p-3.5 mb-5">
          <PosterPlaceholder src={quiz.image} width={84} height={120} />
          <div className="flex-1">
            <div className="font-display text-[25px] leading-[1.02] mb-2">{quiz.title}</div>
            <div className="text-[13.5px] text-muted">{quiz.year}</div>
            {quiz.genre && <div className="text-[13.5px] text-muted">{quiz.genre}</div>}
          </div>
        </div>

        <div className="mb-[22px] w-full">
          <FullBilling clues={quiz.clues} revealedCount={result.revealedClues} />
        </div>

        <button
          type="button"
          onClick={() => onShare(buildShareGrid(result, quiz.cluevieQuizId ?? quiz.id))}
          className="btn-primary mb-3.5"
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
