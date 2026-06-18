import { useState } from "react";
import { PersonGlyph } from "./icons";

interface Props {
  src?: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, size = 62, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };
  if (!src || failed) {
    return (
      <div
        style={dim}
        className={`rounded-full bg-slot-empty text-muted overflow-hidden flex items-end justify-center flex-none ${className}`}
      >
        <PersonGlyph />
      </div>
    );
  }
  return (
    <img
      src={src}
      onError={() => setFailed(true)}
      style={dim}
      className={`rounded-full object-cover bg-slot-empty flex-none ${className}`}
      alt=""
    />
  );
}
