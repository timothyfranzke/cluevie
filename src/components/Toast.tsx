import { useEffect } from "react";

interface Props {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 2400);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-ink text-paper px-5 py-3 rounded-full text-[14px] font-semibold shadow-card">
      {message}
    </div>
  );
}
