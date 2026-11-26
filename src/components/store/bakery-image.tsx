"use client";

import Image from "next/image";
import { useState } from "react";
import { Wheat } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Placeholder shown while the photo is missing. */
  placeholderClassName?: string;
};

/** Photo that falls back to a warm placeholder tile if the file is missing. */
export function BakeryImage({
  src,
  alt,
  sizes,
  className = "",
  priority,
  placeholderClassName = "bg-chip text-ink-muted/60",
}: Props) {
  const [failed, setFailed] = useState<string | null>(null);

  if (!src || failed === src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center ${placeholderClassName} ${className}`}
      >
        <Wheat className="size-1/4 max-h-12 min-h-6" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(src)}
      className={`object-cover ${className}`}
    />
  );
}
