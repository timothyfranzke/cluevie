import { useGame, buildShareGrid } from "../game/store";
import { Header } from "../components/Header";
import { ScoreGrid } from "../components/ScoreSlot";
import { PosterPlaceholder } from "../components/PosterPlaceholder";
import { Countdown } from "../components/Countdown";
import { ClockIcon, ShareIcon } from "../components/icons";

interface Props {
  onShare: (text: string) => void;
}

export function AlreadyPlayedToday({ onShare }: Props) {
  const quiz = useGame((s) => s.quiz)!;
  const result = useGame((s) => s.result);
  const openHowToPlay = useGame((s) => s.openHowToPlay);
  const openStats = useGame((s) => s.openStats);
  const won = result.outcome === "won";

  return (
    <div className="flex flex-col min-h-screen md:min-h-0 md:h-full">
      <Header size="sm" onOpenRules={openHowToPlay} onOpenStats={openStats} />
      <div className="px-6 pt-[18px] pb-6 flex flex-col items-center">
        <div className="w-full bg-accent text-accent-ink rounded-card px-[18px] py-4 flex items-center gap-3 mb-6">
          <ClockIcon width={22} height={22} />
          <div className="flex-1">
            <div className="font-extrabold text-[15px]">You've played today</div>
            <div className="text-[13px] opacity-85">
              Next movie in <Countdown />
            </div>
          </div>
        </div>

        <div className="font-display text-[36px] leading-[0.95] text-accent mb-1.5">
          {won ? "Got it!" : "Out of points"}
        </div>
        <div className="text-[14px] text-muted text-center mb-5">
          {won ? (
            <>
              Solved with{" "}
              <b className="text-ink">
                {result.remainingPoints} point{result.remainingPoints === 1 ? "" : "s"}
              </b>{" "}
              to spare.
            </>
          ) : (
            "Better luck next time."
          )}
        </div>

        <div className="mb-1.5 w-full">
          <ScoreGrid slots={result.slots} size="sm" />
        </div>
        <div className={`text-[13px] font-bold mb-[22px] ${won ? "text-muted" : "text-incorrect"}`}>
          {won ? `${result.remainingPoints} / 6` : "X / 6"}
        </div>

        <div className="flex gap-4 items-center w-full bg-surface border border-line rounded-card p-3.5 mb-[22px]">
          <PosterPlaceholder src={quiz.image} width={70} height={100} />
          <div className="flex-1">
            <div className="font-display text-[24px] leading-[1.02] mb-1.5">{quiz.title}</div>
            <div className="text-[13px] text-muted">
              {quiz.year}
              {quiz.genre && <> · {quiz.genre}</>}
            </div>
          </div>
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
