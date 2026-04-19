"use client";

import { motion } from "framer-motion";

interface TagProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}

export function Tag({ label, active = false, onClick, size = "md" }: TagProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`
        inline-flex items-center rounded-full font-medium
        border transition-all duration-150 select-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${sizeClass}
        ${
          active
            ? "bg-accent border-accent text-white"
            : "bg-bg-card border-white/10 text-text-muted hover:border-white/20 hover:text-text-primary"
        }
      `}
    >
      {label}
    </motion.button>
  );
}
