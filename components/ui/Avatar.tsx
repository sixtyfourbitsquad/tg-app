"use client";

import Image from "next/image";
import { useState } from "react";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  fallbackText?: string;
}

export function Avatar({
  src,
  alt = "Avatar",
  size = 36,
  className = "",
  fallbackText,
}: AvatarProps) {
  const [errored, setErrored] = useState(false);

  const initials = fallbackText
    ? fallbackText
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  if (!src || errored) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-accent/20 text-accent font-semibold select-none ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.38 }}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes={`${size}px`}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
