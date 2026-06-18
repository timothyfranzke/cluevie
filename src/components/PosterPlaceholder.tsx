import { useState } from "react";

interface Props {
  src?: string;
  width: number;
  height: number;
}

export function PosterPlaceholder({ src, width, height }: Props) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        style={{ width, height }}
        className="rounded-[6px] object-cover flex-none"
      />
    );
  }
  return (
    <div
      style={{
        width,
        height,
        background:
          "repeating-linear-gradient(135deg,#d8cab2,#d8cab2 6px,#e6d9c4 6px,#e6d9c4 12px)",
      }}
      className="rounded-[6px] flex-none flex items-end justify-center pb-2"
    >
      <span className="text-[9px] font-semibold text-[#7a6f5c] font-mono tracking-wider">
        POSTER
      </span>
    </div>
  );
}
