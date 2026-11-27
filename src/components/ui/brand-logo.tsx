import * as React from "react";
import { cn } from "@/lib/cn";

export interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

/**
 * ProctorOS architectural crest mark: Botanical Pine tile, Warm Paper folded
 * ledger shield, Terracotta corner seal, and Pine verification check.
 */
export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", sizeClasses[size], className)}
    >
      <rect width="32" height="32" rx="8" fill="#3A5A40" />
      <path
        d="M8.5 7.2C8.5 6.53726 9.03726 6 9.7 6H19L23.5 10.5V20.1C23.5 23.25 20.1 25.4 16 26.6C11.9 25.4 8.5 23.25 8.5 20.1V7.2Z"
        fill="#FAF9F4"
      />
      <path
        d="M19 6L23.5 10.5H20.2C19.5373 10.5 19 9.96274 19 9.3V6Z"
        fill="#AE4F2F"
      />
      <path
        d="M12.1 16.3L14.9 19.1L20.2 13.5"
        stroke="#3A5A40"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
