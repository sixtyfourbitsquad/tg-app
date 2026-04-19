"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface IconButtonProps extends HTMLMotionProps<"button"> {
  label: string;
  active?: boolean;
  activeColor?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { label, active = false, activeColor = "#ff3b5c", size = "md", className = "", children, ...props },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        aria-label={label}
        whileTap={{ scale: 0.82 }}
        whileHover={{ scale: 1.08 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={`
          inline-flex items-center justify-center rounded-full
          transition-colors duration-150 select-none
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
          ${SIZE_MAP[size]}
          ${active ? "text-accent" : "text-text-muted hover:text-text-primary"}
          ${className}
        `}
        style={active ? { color: activeColor } : undefined}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

IconButton.displayName = "IconButton";
