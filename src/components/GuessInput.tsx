import { useEffect, useRef, useState } from "react";
import { useGame } from "../game/store";
import type { MovieSummary } from "../game/types";
import { ArrowRightIcon, SearchIcon } from "./icons";
import { PosterPlaceholder } from "./PosterPlaceholder";

export function GuessInput() {
  const term = useGame((s) => s.searchTerm);
  const results = useGame((s) => s.searchResults);
  const setTerm = useGame((s) => s.setSearchTerm);
  const submitGuess = useGame((s) => s.submitGuess);
  const shakeKey = useGame((s) => s.shakeKey);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<MovieSummary | null>(null);

  useEffect(() => {
    if (shakeKey === 0) return;
    const el = wrapRef.current;
    if (!el) return;
    el.classList.remove("animate-shake");
    void el.offsetWidth;
    el.classList.add("animate-shake");
  }, [shakeKey]);

  // If the store wipes the search term (after submit), drop the local selection too.
  useEffect(() => {
    if (term === "") setSelected(null);
  }, [term]);

  const trimmed = term.trim();
  const showDropdown = !selected && trimmed.length > 0;
  const noMatch = showDropdown && results.length === 0;
  const canSubmit = !!selected;

  function pick(movie: MovieSummary) {
    setSelected(movie);
    setTerm(movie.name);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (selected) setSelected(null);
    setTerm(e.target.value);
  }

  function submit() {
    if (!selected) return;
    submitGuess(selected);
    setSelected(null);
  }

  return (
    <div ref={wrapRef} className="relative">
      {showDropdown && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 bg-surface border border-line rounded-[14px] shadow-dropdown overflow-hidden">
          {results.length > 0 ? (
            results.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pick(m)}
                className={`w-full flex items-center gap-[11px] px-3.5 py-[11px] text-left ${i === 0 ? "bg-accent/[0.06]" : ""} ${i > 0 ? "border-t border-line" : ""}`}
              >
                <PosterPlaceholder src={m.image} width={26} height={37} />
                <div className="flex-1">
                  <div className="text-[15px] font-semibold">{m.name}</div>
                </div>
              </button>
            ))
          ) : (
            <div className="flex items-center gap-2.5 px-3.5 py-3 text-[13.5px] text-muted border border-dashed border-[#d8cab2] rounded-[12px] m-2 bg-paper">
              <SearchIcon width={16} height={16} className="flex-none" />
              Hmm, that's not in our film list — check the spelling?
            </div>
          )}
        </div>
      )}
      <div className="flex items-center bg-surface border-[1.5px] border-accent rounded-[14px] pl-4 pr-1.5">
        <input
          value={term}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Name the movie"
          aria-label="Movie guess"
          className="flex-1 bg-transparent outline-none text-[16px] text-ink py-[15px] placeholder:text-muted"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || noMatch}
          aria-label="Submit guess"
          className="w-10 h-10 rounded-[11px] bg-accent text-accent-ink flex items-center justify-center flex-none disabled:opacity-50"
        >
          <ArrowRightIcon width={20} height={20} />
        </button>
      </div>
    </div>
  );
}
