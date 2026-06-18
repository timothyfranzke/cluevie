import { useEffect, useState } from "react";
import { useGame } from "./game/store";
import { Phone } from "./components/Phone";
import { ActiveGame } from "./screens/ActiveGame";
import { Win } from "./screens/Win";
import { Lose } from "./screens/Lose";
import { AlreadyPlayedToday } from "./screens/AlreadyPlayedToday";
import { StatsModal } from "./screens/StatsModal";
import { HowToPlayModal } from "./screens/HowToPlayModal";
import { Toast } from "./components/Toast";

export function App() {
  const status = useGame((s) => s.status);
  const result = useGame((s) => s.result);
  const showStats = useGame((s) => s.showStats);
  const showHowToPlay = useGame((s) => s.showHowToPlay);
  const init = useGame((s) => s.init);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  async function handleShare(text: string) {
    try {
      if (navigator.share) {
        await navigator.share({ text });
        setToast("Shared");
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard");
    } catch {
      setToast("Couldn't copy — long-press to select");
    }
  }

  let screen: React.ReactNode;
  if (status === "loading") {
    screen = (
      <div className="flex-1 flex items-center justify-center text-muted">
        Loading today's quiz…
      </div>
    );
  } else if (status === "error") {
    screen = (
      <div className="flex-1 flex items-center justify-center text-center px-6 text-muted">
        Couldn't load today's quiz. Try again later.
      </div>
    );
  } else if (result.outcome === "won" || result.outcome === "lost") {
    const finishedToday =
      result.completedOn &&
      Date.now() - result.completedOn > 1000 * 60 * 60;
    if (finishedToday) {
      screen = <AlreadyPlayedToday onShare={handleShare} />;
    } else {
      screen =
        result.outcome === "won" ? (
          <Win onShare={handleShare} />
        ) : (
          <Lose onShare={handleShare} />
        );
    }
  } else {
    screen = <ActiveGame />;
  }

  return (
    <>
      <Phone>{screen}</Phone>
      {showHowToPlay && <HowToPlayModal />}
      {showStats && <StatsModal />}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
