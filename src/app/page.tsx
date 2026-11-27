import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Flag } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageShell,
} from "@/components/ui";

export default function HomePage() {
  return (
    <PageShell
      headerRight={
        <div className="flex items-center gap-3">
          <Link
            href="/design"
            className="pressable focus-ring inline-flex items-center h-9 px-3.5 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-subtle"
          >
            UI Kit
          </Link>
          <Link
            href="/login"
            className="pressable focus-ring inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-hover"
          >
            <span>Sign In</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      }
    >
      {/* Spacious Editorial Hero */}
      <section className="max-w-2xl py-8 sm:py-14">
        <div
          className="stagger-in"
          style={{ "--stagger-index": 0 } as React.CSSProperties}
        >
          <Badge
            variant="pine"
            icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Verifiable Examination &amp; Dispute Platform
          </Badge>
        </div>

        <h1
          className="stagger-in mt-6 font-serif text-4xl sm:text-5xl font-medium text-ink tracking-[-0.025em] leading-[1.12]"
          style={{ "--stagger-index": 1 } as React.CSSProperties}
        >
          An examination platform where every grade can be defended.
        </h1>

        <p
          className="stagger-in mt-5 text-base sm:text-lg text-ink-muted leading-relaxed"
          style={{ "--stagger-index": 2 } as React.CSSProperties}
        >
          Server-authoritative timing, snapshot-frozen papers, offline-resilient
          autosave, SHA-256 hash-chained audit logs, and transparent question
          rulings on calm warm paper.
        </p>

        <div
          className="stagger-in mt-9 flex flex-wrap items-center gap-4"
          style={{ "--stagger-index": 3 } as React.CSSProperties}
        >
          <Link
            href="/login"
            className="pressable focus-ring inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-hover"
          >
            <span>Launch Demo &amp; Sign In</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="text-xs font-mono text-ink-muted">
            Admin · Examiner · Candidate workspaces · QR Verification
          </span>
        </div>
      </section>

      {/* Breathing-room 3-column summary */}
      <section
        aria-label="Core workspace pillars"
        className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Card
          interactive
          className="stagger-in"
          style={{ "--stagger-index": 4 } as React.CSSProperties}
        >
          <CardHeader>
            <Badge
              variant="pine"
              icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Attempt Engine
            </Badge>
            <CardTitle className="mt-4">Server-Authoritative Timing</CardTitle>
            <CardDescription>
              Countdown offsets sync with server deadlines and autosave through
              a local outbox without losing a keystroke.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs text-ink-muted tabular-nums">
              00:45:00 · 3s grace window
            </p>
          </CardContent>
        </Card>

        <Card
          interactive
          className="stagger-in"
          style={{ "--stagger-index": 5 } as React.CSSProperties}
        >
          <CardHeader>
            <Badge
              variant="terracotta"
              icon={<Flag className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Review &amp; Rulings
            </Badge>
            <CardTitle className="mt-4">Append-Only Grade History</CardTitle>
            <CardDescription>
              Rulings act as an immutable overlay on frozen snapshots, keeping
              every regrade diff transparent and auditable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs text-ink-muted tabular-nums">
              SHA-256 chain · Zero silent edits
            </p>
          </CardContent>
        </Card>

        <Card
          interactive
          className="stagger-in"
          style={{ "--stagger-index": 6 } as React.CSSProperties}
        >
          <CardHeader>
            <Badge variant="neutral">Verifiable Reports</Badge>
            <CardTitle className="mt-4">Calm, Accessible Reading</CardTitle>
            <CardDescription>
              Built for sustained focus with #FAF9F4 paper contrast, keyboard
              navigation, and crisp 1px structural borders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs text-ink-muted tabular-nums">
              WCAG contrast · Reduced-motion safe
            </p>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
