"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  FileCheck2,
  Flag,
  GraduationCap,
  KeyRound,
  NotebookPen,
  QrCode,
  Radio,
  Shield,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SegmentedTabs,
  StatusPill,
  type NetworkSyncState,
} from "@/components/ui";
import { cn } from "@/lib/cn";

gsap.registerPlugin(ScrollTrigger);

const ROLE_TABS = [
  { id: "candidate", label: "Candidate" },
  { id: "examiner", label: "Examiner" },
  { id: "admin", label: "Admin" },
];

const CORE_PILLARS = [
  {
    title: "Frozen Papers, Zero Leaks",
    description:
      "Questions, mark weights, and shuffled options lock at attempt start. Answer keys never leave the server.",
    meta: "Immutable AttemptQuestion snapshots",
    icon: KeyRound,
  },
  {
    title: "Server-Locked Countdown",
    description:
      "Clients track a monotonic server offset with a 3-second grace window and automatic server expiry.",
    meta: "Immune to device clock changes",
    icon: Clock,
  },
  {
    title: "Offline Autosave Outbox",
    description:
      "Every answer writes locally first with revision ordering and replays cleanly when connection returns.",
    meta: "Zero lost keystrokes",
    icon: WifiOff,
  },
  {
    title: "Sandbox & Batch Import",
    description:
      "Examiners dry-run live exams with zero analytics side effects and import CSV or JSON rosters.",
    meta: "Isolated preview engine",
    icon: FileCheck2,
  },
];

const DISPUTE_STEPS = [
  {
    step: "01",
    title: "File Dispute with Evidence Pack",
    description:
      "Automatically bundles the frozen prompt, recorded answer, grade ledger, and event timeline.",
    highlighted: false,
  },
  {
    step: "02",
    title: "Suspect Analytics Signal",
    description:
      "Flags questions under 15% accuracy or where a distractor draws more picks than the keyed answer.",
    highlighted: true,
  },
  {
    step: "03",
    title: "Ruling Overlay & Cohort Regrade",
    description:
      "Accept alternate answers or void items in one atomic transaction without altering snapshots.",
    highlighted: false,
  },
  {
    step: "04",
    title: "SHA-256 Audit & QR Supersession",
    description:
      "Appends a locked hash entry from GENESIS and marks outdated PDF tokens superseded on scan.",
    highlighted: false,
  },
];

const ROLE_DETAILS: Record<
  string,
  {
    subtitle: string;
    items: Array<{
      title: string;
      description: string;
      meta: string;
      icon: React.ComponentType<{ className?: string }>;
    }>;
  }
> = {
  candidate: {
    subtitle:
      "Distraction-free exam delivery, personal scratchpad, and transparent result breakdowns.",
    items: [
      {
        title: "Exam Workspace & Scratchpad",
        description:
          "Keyboard navigation (N / P), paper contrast themes, and an ungraded server-synced scratchpad.",
        meta: "Responsive down to 390px",
        icon: NotebookPen,
      },
      {
        title: "Live Broadcasts & Neutral Events",
        description:
          "Examiner notices appear as calm toasts while tab or offline events log strictly as indicators.",
        meta: "Zero automatic penalties",
        icon: GraduationCap,
      },
      {
        title: "Grade History & Disputes",
        description:
          "Inspect published breakdowns, download QR-signed PDFs, and challenge ambiguous items.",
        meta: "Unlocked after publication",
        icon: Flag,
      },
    ],
  },
  examiner: {
    subtitle:
      "Author versioned banks, monitor cohorts live, gate results, and issue fair rulings.",
    items: [
      {
        title: "Question Bank & Sandbox",
        description:
          "Versioned single, multi-select, and written items with pre-publish checklists and dry runs.",
        meta: "Isolated from real scores",
        icon: BookOpenCheck,
      },
      {
        title: "Live Monitor & Publication Gate",
        description:
          "Track progress and server timers every 5 seconds; hold release until manual grading finishes.",
        meta: "Controlled score release",
        icon: Radio,
      },
      {
        title: "Cohort Analytics & Rulings",
        description:
          "Inspect score distributions, distractor patterns, and atomic Before/After regrade diffs.",
        meta: "Append-only grade ledger",
        icon: BarChart3,
      },
    ],
  },
  admin: {
    subtitle:
      "Zero-trust access control, cryptographic chain verification, and minimal-exposure QR checks.",
    items: [
      {
        title: "Instant Session Revocation",
        description:
          "Every privileged request verifies the signed cookie and re-checks account status in Postgres.",
        meta: "Immediate deactivation effect",
        icon: Shield,
      },
      {
        title: "Audit Chain Verifier",
        description:
          "Recomputes SHA-256 digests from GENESIS and pinpoints the exact row if any record changes.",
        meta: "Advisory-locked writes",
        icon: ShieldCheck,
      },
      {
        title: "Zero-PII QR Verification",
        description:
          "Public scan pages reveal only validity, exam title, score band, and masked candidate name.",
        meta: "No emails or IDs exposed",
        icon: QrCode,
      },
    ],
  },
};

export function LandingShowcase() {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const reconnectTimerRef = React.useRef<number | null>(null);
  const [activeRole, setActiveRole] = React.useState("candidate");
  const [simNetwork, setSimNetwork] = React.useState<NetworkSyncState>("saved");
  const [simOptionC, setSimOptionC] = React.useState(true);

  React.useEffect(() => {
    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.from(".hero-anim", {
        y: 18,
        opacity: 0,
        duration: 0.65,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });

      gsap.from(".hero-card-anim", {
        y: 22,
        scale: 0.985,
        opacity: 0,
        duration: 0.72,
        delay: 0.14,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });

      const sections = gsap.utils.toArray<HTMLElement>(".gsap-section");
      for (const section of sections) {
        const items = section.querySelectorAll(".gsap-reveal");
        if (items.length === 0) continue;

        gsap.from(items, {
          y: 20,
          opacity: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: section,
            start: "top 85%",
            once: true,
          },
        });
      }
    }, root);

    return () => ctx.revert();
  }, []);

  const handleCycleNetworkSim = (nextState: NetworkSyncState) => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (nextState === "offline") {
      setSimNetwork("offline");
      return;
    }
    if (nextState === "saved") {
      setSimNetwork("reconnecting");
      reconnectTimerRef.current = window.setTimeout(() => {
        setSimNetwork("saved");
        reconnectTimerRef.current = null;
      }, 600);
      return;
    }
    setSimNetwork(nextState);
  };

  const rolePanel = ROLE_DETAILS[activeRole];

  return (
    <div ref={rootRef} className="overflow-x-clip">
      {/* BAND 1: HERO (Warm Paper Canvas) */}
      <section className="bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 py-14 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-7 min-w-0">
              <div className="hero-anim">
                <Badge
                  variant="pine"
                  icon={
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                >
                  Verifiable Examination Platform
                </Badge>
              </div>

              <h1 className="hero-anim mt-6 font-serif text-[2.35rem] sm:text-5xl lg:text-[3.6rem] font-medium text-ink tracking-[-0.025em] leading-[1.1]">
                An examination platform where every grade can be{" "}
                <mark className="bg-ochre-tint text-ink px-2 py-0.5 rounded-md">
                  defended.
                </mark>
              </h1>

              <p className="hero-anim mt-6 text-base sm:text-lg text-ink-muted leading-relaxed max-w-[50ch]">
                Server-locked timing, frozen question snapshots, offline-safe
                autosave, and transparent dispute rulings on calm warm paper.
              </p>

              <div className="hero-anim mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="pressable focus-ring inline-flex items-center gap-2 h-12 px-6 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-hover"
                >
                  <span>Launch Demo &amp; Sign In</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#architecture"
                  className="pressable focus-ring inline-flex items-center h-12 px-5 rounded-lg border border-border-default bg-surface text-ink text-sm font-medium hover:border-border-strong hover:bg-subtle/60"
                >
                  How It Works
                </a>
              </div>

              <div className="hero-anim mt-12 pt-6 border-t border-border-default flex flex-wrap items-center gap-x-7 gap-y-2.5 text-xs font-mono text-ink-muted/85">
                <span>3 Role Workspaces</span>
                <span>Frozen Snapshots</span>
                <span>SHA-256 Audit Chain</span>
                <span>QR Verification</span>
              </div>
            </div>

            {/* Interactive Live Session Preview */}
            <div className="lg:col-span-5 min-w-0 hero-card-anim">
              <Card className="overflow-hidden border-border-strong/75">
                <div className="bg-subtle/65 border-b border-border-default px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      CS-412 · Distributed Systems
                    </p>
                    <p className="text-xs font-mono text-ink-muted mt-0.5">
                      Snapshot frozen · rev 4
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill state={simNetwork} />
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface px-3 py-1 text-xs font-mono font-medium text-ink tabular-nums">
                      <Clock
                        className="h-3.5 w-3.5 text-pine"
                        aria-hidden="true"
                      />
                      00:42:18
                    </span>
                  </div>
                </div>

                <CardContent className="p-5 sm:p-6 space-y-5">
                  <div className="rounded-xl border border-border-default bg-canvas p-4 sm:p-5 space-y-3.5">
                    <p className="text-sm font-medium text-ink leading-snug">
                      Q4. Which guarantees hold when a partitioned Raft follower
                      rejoins?
                    </p>
                    <button
                      type="button"
                      onClick={() => setSimOptionC((prev) => !prev)}
                      className={cn(
                        "w-full text-left flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors cursor-pointer focus-ring",
                        simOptionC
                          ? "border-pine/40 bg-pine-tint/70 text-ink"
                          : "border-border-default bg-surface text-ink-muted hover:border-border-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "h-4 w-4 rounded flex items-center justify-center shrink-0 font-mono text-[10px]",
                          simOptionC
                            ? "bg-pine text-white"
                            : "border border-border-strong bg-surface",
                        )}
                      >
                        {simOptionC ? "✓" : ""}
                      </span>
                      <span>Stale leader steps down upon higher term RPC</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-ink-muted">Test local outbox</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCycleNetworkSim("offline")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors focus-ring",
                          simNetwork === "offline"
                            ? "bg-terracotta-tint border-terracotta/40 text-terracotta"
                            : "bg-canvas border-border-default text-ink-muted hover:text-ink",
                        )}
                      >
                        Drop Wi-Fi
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCycleNetworkSim("saved")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors focus-ring",
                          simNetwork !== "offline"
                            ? "bg-pine-tint border-pine/30 text-pine"
                            : "bg-canvas border-border-default text-ink-muted hover:text-ink",
                        )}
                      >
                        Reconnect
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-ochre-tint px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-ink">
                    <span className="font-medium inline-flex items-center gap-2">
                      <ShieldCheck
                        className="h-4 w-4 text-ochre"
                        aria-hidden="true"
                      />
                      AuditHead #4 Verified
                    </span>
                    <span className="font-mono text-ink-muted">
                      Append-only ledger
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* BAND 2: CORE ARCHITECTURE (Warm Subtle Surface, spacious 2x2 grid) */}
      <section
        id="architecture"
        className="gsap-section bg-subtle/75 border-y border-border-default"
      >
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 py-20 sm:py-24 lg:py-28">
          <div className="gsap-reveal max-w-2xl space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest text-pine">
              Core Architecture
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink tracking-[-0.02em] leading-[1.15]">
              Built for integrity under real exam conditions.
            </h2>
            <p className="text-base text-ink-muted leading-relaxed">
              Every timing, snapshot, and persistence boundary is enforced on
              the server.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {CORE_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card key={pillar.title} interactive className="gsap-reveal">
                  <CardHeader className="p-7 sm:p-8 space-y-4">
                    <span className="h-10 w-10 rounded-xl bg-pine-tint text-pine flex items-center justify-center">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-2">
                      <CardTitle className="text-lg sm:text-xl">
                        {pillar.title}
                      </CardTitle>
                      <CardDescription className="text-sm sm:text-[15px] leading-relaxed">
                        {pillar.description}
                      </CardDescription>
                    </div>
                    <p className="pt-2 font-mono text-xs text-ink-muted/80">
                      {pillar.meta}
                    </p>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* BAND 3: TRUST & DISPUTE RESOLUTION (Warm Paper Canvas, editorial split) */}
      <section id="disputes" className="gsap-section bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 py-20 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left narrative + compact Regrade Diff */}
            <div className="lg:col-span-5 space-y-8 gsap-reveal min-w-0">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-ochre-tint px-3.5 py-1 text-xs font-medium text-ink">
                  <Flag className="h-3.5 w-3.5 text-ochre" aria-hidden="true" />
                  Core Innovation · Disputes &amp; Rulings
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink tracking-[-0.02em] leading-[1.15]">
                  Fix a flawed question once—regrade fairly for everyone.
                </h2>
                <p className="text-base text-ink-muted leading-relaxed">
                  Rulings overlay frozen snapshots without rewriting history.
                  Every adjustment appends a new Grade row and seals into the
                  SHA-256 chain.
                </p>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">
                      Ruling #3 · Accept Alternate
                    </span>
                    <span className="rounded-md bg-ochre-tint px-2.5 py-0.5 font-mono text-[11px] font-medium text-ink">
                      Atomic Diff
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-border-default overflow-hidden text-xs sm:text-sm font-mono tabular-nums">
                    <div className="grid grid-cols-4 bg-subtle/70 px-3.5 py-2 font-sans text-xs font-medium text-ink-muted">
                      <span>Candidate</span>
                      <span className="text-right">Before</span>
                      <span className="text-right">After</span>
                      <span className="text-right">Delta</span>
                    </div>
                    <div className="grid grid-cols-4 px-3.5 py-2.5 border-t border-border-default text-ink">
                      <span className="font-sans">Candidate 01</span>
                      <span className="text-right text-ink-muted">42.0</span>
                      <span className="text-right">45.0</span>
                      <span className="text-right font-semibold text-pine">
                        +3.0
                      </span>
                    </div>
                    <div className="grid grid-cols-4 px-3.5 py-2.5 border-t border-border-default bg-ochre-tint/70 text-ink">
                      <span className="font-sans">Candidate 07</span>
                      <span className="text-right text-ink-muted">38.0</span>
                      <span className="text-right">41.0</span>
                      <span className="text-right font-semibold text-pine">
                        +3.0
                      </span>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-ink-muted">
                    Outdated PDF tokens automatically show SUPERSEDED
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Right calm numbered editorial flow (no crammed boxes) */}
            <div className="lg:col-span-7 min-w-0">
              <div className="divide-y divide-border-default border-t border-b border-border-default">
                {DISPUTE_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className={cn(
                      "gsap-reveal py-7 sm:py-8 flex items-start gap-5 sm:gap-7",
                      item.highlighted &&
                        "bg-ochre-tint/45 px-5 sm:px-6 -mx-5 sm:-mx-6 rounded-xl border-y-0",
                    )}
                  >
                    <span className="font-mono text-sm font-semibold text-ink-muted pt-1 shrink-0">
                      {item.step}
                    </span>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-ink tracking-[-0.015em]">
                          {item.title}
                        </h3>
                        {item.highlighted && (
                          <span className="rounded-md bg-ochre-tint px-2 py-0.5 text-[11px] font-mono font-medium text-ink">
                            Auto-Flagged
                          </span>
                        )}
                      </div>
                      <p className="text-sm sm:text-[15px] text-ink-muted leading-relaxed max-w-[54ch]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BAND 4: ROLE WORKSPACES (Warm Subtle Surface, roomy 3-col cards) */}
      <section
        id="workspaces"
        className="gsap-section bg-subtle/75 border-y border-border-default"
      >
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 py-20 sm:py-24 lg:py-28">
          <div className="gsap-reveal flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-xl space-y-3">
              <p className="font-mono text-xs uppercase tracking-widest text-pine">
                Role Workspaces
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-medium text-ink tracking-[-0.02em] leading-[1.15]">
                Dedicated tools for every participant.
              </h2>
              <p className="text-base text-ink-muted leading-relaxed">
                {rolePanel.subtitle}
              </p>
            </div>

            <div className="shrink-0 max-w-full">
              <SegmentedTabs
                tabs={ROLE_TABS}
                value={activeRole}
                onChange={setActiveRole}
                ariaLabel="ProctorOS role workspaces"
              />
            </div>
          </div>

          <div className="gsap-reveal mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {rolePanel.items.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} interactive>
                  <CardHeader className="p-7 space-y-4">
                    <span className="h-10 w-10 rounded-xl bg-pine-tint text-pine flex items-center justify-center">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-2">
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </div>
                    <p className="pt-2 font-mono text-xs text-ink-muted/80">
                      {item.meta}
                    </p>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* BAND 5: DISTINCT DEMO LAUNCHPAD & FOOTER */}
      <section className="gsap-section bg-canvas">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 py-20 sm:py-24">
          <div className="gsap-reveal rounded-2xl bg-pine text-white p-8 sm:p-12 lg:p-14 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-xl space-y-3">
              <span className="inline-block rounded-md bg-ochre-tint px-3 py-1 font-mono text-xs font-medium text-ink">
                4 Pre-Seeded Demo Accounts Ready
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium tracking-[-0.02em] leading-[1.15]">
                Walk through Examiner, Candidate, and Admin live.
              </h2>
              <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                Explore live proctoring, offline recovery, question rulings, and
                QR verification with zero setup.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 shrink-0">
              <Link
                href="/design"
                className="pressable focus-ring inline-flex items-center h-11 px-5 rounded-lg border border-white/25 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                UI Kit
              </Link>
              <Link
                href="/login"
                className="pressable focus-ring inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-canvas text-ink text-sm font-medium hover:bg-subtle transition-colors"
              >
                <span>Open Demo Sign In</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <footer className="mt-14 pt-8 border-t border-border-default flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-ink-muted">
            <span className="font-medium text-ink">
              ProctorOS · Verifiable Examination Management
            </span>
            <span className="font-mono">
              Server timing · Immutable snapshots · SHA-256 audit chain
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
}
