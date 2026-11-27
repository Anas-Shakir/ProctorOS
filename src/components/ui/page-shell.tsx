import * as React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { cn } from "@/lib/cn";

export interface PageShellProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  maxWidth?: "narrow" | "default" | "wide";
  className?: string;
}

const widthClasses: Record<NonNullable<PageShellProps["maxWidth"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-6xl",
};

/**
 * Calm, spacious Warm Paper shell with generous breathing room around content.
 */
export function PageShell({
  children,
  headerRight,
  maxWidth = "default",
  className,
}: PageShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 bg-canvas/95 border-b border-border-default">
        <div
          className={cn(
            "mx-auto w-full px-6 sm:px-8 h-16 flex items-center justify-between gap-4",
            widthClasses[maxWidth],
          )}
        >
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2.5 rounded-md py-1"
          >
            <BrandLogo size="md" />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
              ProctorOS
            </span>
          </Link>

          {headerRight && (
            <div className="flex items-center gap-3">{headerRight}</div>
          )}
        </div>
      </header>

      <main
        className={cn(
          "flex-1 mx-auto w-full px-6 sm:px-8 py-12 sm:py-16",
          widthClasses[maxWidth],
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
