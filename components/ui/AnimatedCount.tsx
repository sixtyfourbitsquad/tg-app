"use client";

import { AnimatePresence, motion } from "framer-motion";

interface AnimatedCountProps {
  value: number;
  className?: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Animates vertically when the count changes.
 * Uses `key` to trigger AnimatePresence exit/enter.
 */
export function AnimatedCount({ value, className = "" }: AnimatedCountProps) {
  return (
    <span className={`relative overflow-hidden inline-block h-4 ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="inline-block text-xs leading-4"
        >
          {fmt(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
