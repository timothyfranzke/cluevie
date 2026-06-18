import type { PropsWithChildren } from "react";

export function Phone({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center md:py-10">
      <div className="w-full max-w-[480px] mx-auto bg-paper text-ink min-h-screen md:min-h-0 md:h-[844px] md:rounded-phone md:shadow-phone overflow-hidden flex flex-col relative">
        {children}
      </div>
    </div>
  );
}
