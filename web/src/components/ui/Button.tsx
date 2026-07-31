"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "truth" | "dare";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[linear-gradient(135deg,#ff4d6d,#7c5cff)] text-white shadow-[0_10px_40px_rgba(255,77,109,0.25)] hover:brightness-110",
  secondary: "glass text-cream hover:bg-white/10",
  ghost: "bg-transparent text-muted hover:text-cream hover:bg-white/5",
  danger: "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25",
  truth:
    "bg-[linear-gradient(135deg,#0ea5e9,#38bdf8)] text-ink font-semibold shadow-[0_10px_40px_rgba(56,189,248,0.3)]",
  dare:
    "bg-[linear-gradient(135deg,#e11d48,#fb7185)] text-white font-semibold shadow-[0_10px_40px_rgba(251,113,133,0.3)]",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-5 text-sm rounded-2xl",
  lg: "h-14 px-7 text-base rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}
