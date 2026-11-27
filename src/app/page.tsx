import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingShowcase } from "@/components/landing/landing-showcase";
import { BrandLogo } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink overflow-x-clip">
      <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur-sm border-b border-border-default">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2.5 rounded-md py-1 shrink-0"
          >
            <BrandLogo size="md" />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
              ProctorOS
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <nav
              aria-label="Landing sections"
              className="hidden md:flex items-center gap-1 mr-2"
            >
              <a
                href="#architecture"
                className="focus-ring px-3 py-1.5 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-subtle transition-colors"
              >
                Architecture
              </a>
              <a
                href="#disputes"
                className="focus-ring px-3 py-1.5 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-subtle transition-colors"
              >
                Disputes &amp; Audit
              </a>
              <a
                href="#workspaces"
                className="focus-ring px-3 py-1.5 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-subtle transition-colors"
              >
                Workspaces
              </a>
            </nav>

            <Link
              href="/login"
              className="pressable focus-ring inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-hover"
            >
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <LandingShowcase />
      </main>
    </div>
  );
}
