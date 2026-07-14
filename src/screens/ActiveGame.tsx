import { useGame } from "../game/store";
import { revealedClues } from "../game/clues";
import { ScoreGrid } from "../components/ScoreSlot";
import { ClueCard } from "../components/ClueCard";
import { Header } from "../components/Header";
import { GuessInput } from "../components/GuessInput";
import { FinalGuess } from "./FinalGuess";

function formatDate(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return fmt.format(new Date());
}

export function ActiveGame() {
  const quiz = useGame((s) => s.quiz)!;
  const result = useGame((s) => s.result);
  const revealNextClue = useGame((s) => s.revealNextClue);
  const openHowToPlay = useGame((s) => s.openHowToPlay);
  const openStats = useGame((s) => s.openStats);

  if (result.remainingPoints === 1) return <FinalGuess />;

  const visibleClues = revealedClues(quiz.clues, result.revealedClues).reverse();

  const noMoreClues = result.revealedClues >= quiz.clues.length - 1;
  const noMorePoints = result.remainingPoints <= 1;

  return (
    <div className="flex flex-col h-full min-h-screen md:min-h-0 md:h-full">
      <Header onOpenRules={openHowToPlay} onOpenStats={openStats} />

      <div className="text-center text-[12.5px] text-muted px-5 pb-4">
        {formatDate()}
        {typeof quiz.quizNumber === "number" && (
          <>&nbsp;·&nbsp;&nbsp;No. {quiz.quizNumber}</>
        )}
      </div>

      {(quiz.year || quiz.genre) && (
        <div className="px-6 pb-4">
          <div className="flex gap-8 items-start">
            {quiz.year && (
              <div className="flex-none">
                <div className="eyebrow mb-1">Year</div>
                <div className="font-display text-[34px] leading-none text-ink">
                  {quiz.year}
                </div>
              </div>
            )}
            {quiz.genre && (
              <div className="flex-1 min-w-0">
                <div className="eyebrow mb-1">Genre</div>
                <div className="text-[22px] font-extrabold uppercase leading-tight text-ink tracking-tight">
                  {quiz.genre.toUpperCase()}
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-line mt-4" />
        </div>
      )}

      <div className="px-[22px] pb-4">
        <ScoreGrid slots={result.slots} size="lg" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-1 flex flex-col gap-3 pb-2">
        {visibleClues.length === 0 && (
          <div className="text-center text-muted text-[14px] mt-6">
            Reveal your first clue to begin.
          </div>
        )}
        {visibleClues.map((c, i) => (
          <ClueCard
            key={c.index}
            clue={c}
            ordinal={result.revealedClues - i}
            total={quiz.clues.length - 1}
            reveal={i === 0}
          />
        ))}
      </div>

      <div className="px-[18px] pt-3.5 pb-6 border-t border-line bg-paper">
        <button
          type="button"
          onClick={revealNextClue}
          disabled={noMoreClues || noMorePoints}
          className="btn-primary mb-3"
        >
          Reveal next clue
          <span className="text-[12px] font-bold bg-accent-ink/[0.18] rounded-full px-2.5 py-[3px]">
            −1 point
          </span>
        </button>
        <GuessInput />
      </div>
    </div>
  );
}
