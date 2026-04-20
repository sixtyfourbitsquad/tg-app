"use client";

import { useEffect } from "react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 bg-[#0a0a0a] text-white text-center pt-16">
      <p className="text-sm text-white/80">Something went wrong.</p>
      <p className="text-xs text-white/40 break-all max-w-full">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-[#ff3b5c] px-5 py-2 text-sm font-semibold text-black"
      >
        Try again
      </button>
    </div>
  );
}
