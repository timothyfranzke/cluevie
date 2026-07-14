import { useState } from "react";
import { useGame } from "../game/store";
import { revealedClues } from "../game/clues";
import { Header } from "../components/Header";
import { ScoreGrid } from "../components/ScoreSlot";
import { CastRecap } from "../components/CastRecap";
import { GuessInput } from "../components/GuessInput";

export function FinalGuess() {
  const quiz = useGame((s) => s.quiz)!;
  const result = useGame((s) => s.result);
  const giveUp = useGame((s) => s.giveUp);
  const openHowToPlay = useGame((s) => s.openHowToPlay);
  const openStats = useGame((s) => s.openStats);
  const [confirming, setConfirming] = useState(false);

  const cast = revealedClues(quiz.clues, result.revealedClues);

  return (
    <div className="flex flex-col h-full min-h-screen md:min-h-0 md:h-full">
      <Header size="sm" onOpenRules={openHowToPlay} onOpenStats={openStats} />

      <div className="flex-1 overflow-y-auto px-6 pt-2 pb-2 flex flex-col">
        <div className="text-center mb-4">
          <div className="text-[12px] font-bold tracking-[0.2em] uppercase text-muted mb-1.5">
            Last chance
          </div>
          <div className="font-display text-[34px] leading-[0.98] text-ink mb-3">
            Make your final guess
          </div>
          <ScoreGrid slots={result.slots} size="sm" />
        </div>

        {(quiz.year || quiz.genre) && (
          <div className="pb-4">
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

        {cast.length > 0 ? (
          <>
            <div className="eyebrow mb-2.5">The cast so far</div>
            <CastRecap clues={cast} />
          </>
        ) : (
          <div className="text-center text-muted text-[14px] mt-6">
            You went in blind — no clues revealed.
          </div>
        )}
      </div>

      <div className="px-[18px] pt-3.5 pb-6 border-t border-line bg-paper">
        <GuessInput />
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="btn-outline mt-3"
        >
          I give up
        </button>
      </div>

      {confirming && (
        <div
          onClick={() => setConfirming(false)}
          className="fixed inset-0 z-50 bg-ink/[0.42] backdrop-blur-[2px] flex items-end md:items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] bg-paper md:rounded-[34px] rounded-t-[34px] px-6 pt-7 pb-7 shadow-sheet text-ink"
          >
            <div className="font-display text-[30px] text-accent leading-none mb-1.5">
              Are you sure?
            </div>
            <div className="text-[14px] text-muted mb-6">
              There's no going back after this!
            </div>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn-primary mb-2.5"
            >
              Keep playing
            </button>
            <button type="button" onClick={giveUp} className="btn-outline text-incorrect">
              Show me the answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
