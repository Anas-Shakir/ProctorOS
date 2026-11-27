"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  Lock,
  Shield,
} from "lucide-react";
import {
  Badge,
  BrandLogo,
  Button,
  Input,
  useToast,
} from "@/components/ui";
import { loginSchema } from "@/lib/validators/auth";

const DEMO_ACCOUNTS = [
  {
    role: "Examiner",
    name: "Dr. Nadia Hassan",
    email: "examiner1@proctoros.local",
    password: "Examiner123!",
    hint: "Monitor, grade & rule on disputes",
    badgeVariant: "pine" as const,
    icon: BookOpenCheck,
  },
  {
    role: "Candidate · Results",
    name: "Candidate 01",
    email: "candidate1@proctoros.local",
    password: "Candidate123!",
    hint: "Published CS-401 score, PDF & dispute",
    badgeVariant: "outline" as const,
    icon: GraduationCap,
  },
  {
    role: "Candidate · Live",
    name: "Candidate 03",
    email: "candidate3@proctoros.local",
    password: "Candidate123!",
    hint: "Take ongoing CS-412 exam",
    badgeVariant: "neutral" as const,
    icon: GraduationCap,
  },
  {
    role: "Admin",
    name: "System Admin",
    email: "admin@proctoros.local",
    password: "Admin123!",
    hint: "User accounts & role access",
    badgeVariant: "terracotta" as const,
    icon: Shield,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const performLogin = async (creds: { email: string; password: string }) => {
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? "Unable to sign in");
        setSubmitting(false);
        return;
      }

      toast.success("Signed in", `Welcome back, ${data.user.name}.`);
      router.push(data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setFormError("Network error while signing in. Please try again.");
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email") nextErrors.email = issue.message;
        if (issue.path[0] === "password") nextErrors.password = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    await performLogin(parsed.data);
  };

  return (
    <div className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-12 bg-canvas text-ink overflow-x-clip">
      {/* LEFT PANE: Primary Sign-In Form (Warm Paper) */}
      <section className="lg:col-span-5 flex flex-col justify-between px-6 sm:px-10 py-6 sm:py-8 bg-canvas">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2.5 rounded-md py-1"
          >
            <BrandLogo size="md" />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
              ProctorOS
            </span>
          </Link>

          <Link
            href="/"
            className="pressable focus-ring inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-subtle"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Home</span>
          </Link>
        </header>

        <div className="mx-auto w-full max-w-sm py-8 lg:py-0">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-pine-tint text-pine mb-4">
            <Lock className="h-4 w-4" aria-hidden="true" />
          </div>

          <h1 className="font-serif text-3xl sm:text-[2rem] font-medium text-ink tracking-[-0.02em] leading-tight">
            Sign in to ProctorOS
          </h1>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">
            Enter your credentials or choose a demo role.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-terracotta/30 bg-terracotta-tint px-3.5 py-2.5 text-sm text-terracotta"
              >
                {formError}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              autoComplete="email"
              placeholder="you@proctoros.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              disabled={submitting}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              disabled={submitting}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-1"
              loading={submitting}
              loadingLabel="Signing in..."
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>

          <div className="mt-5 lg:hidden">
            <a
              href="#demo-accounts"
              className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium text-pine hover:underline"
            >
              <span>Or choose a demo role below</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        <p className="hidden lg:block text-xs text-ink-muted">
          HTTP-only JWT session authentication
        </p>
      </section>

      {/* RIGHT PANE: Soft Botanical Sage Background with Minimal Role Cards */}
      <section
        id="demo-accounts"
        aria-label="Quick demo sign-in"
        className="lg:col-span-7 bg-pine-tint border-t lg:border-t-0 lg:border-l border-pine/15 px-6 sm:px-10 py-10 lg:py-8 flex flex-col justify-center"
      >
        <div className="mx-auto w-full max-w-xl space-y-6">
          <div className="space-y-2">
            <span className="inline-block rounded-md bg-ochre-tint px-2.5 py-0.5 font-mono text-[11px] font-medium text-ink">
              Demo Access
            </span>
            <h2 className="font-serif text-2xl sm:text-[1.75rem] font-medium text-ink tracking-[-0.02em]">
              Quick sign-in by role
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DEMO_ACCOUNTS.map((acct) => {
              const Icon = acct.icon;
              return (
                <div
                  key={acct.email}
                  className="surface-hover rounded-xl border border-pine/15 bg-surface p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <Badge
                      variant={acct.badgeVariant}
                      icon={<Icon className="h-3 w-3" aria-hidden="true" />}
                    >
                      {acct.role}
                    </Badge>

                    <div>
                      <p className="text-base font-semibold text-ink">
                        {acct.name}
                      </p>
                      <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                        {acct.hint}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      disabled={submitting}
                      onClick={() => {
                        setEmail(acct.email);
                        setPassword(acct.password);
                        void performLogin({
                          email: acct.email,
                          password: acct.password,
                        });
                      }}
                    >
                      <span>Sign in</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={submitting}
                      onClick={() => {
                        setEmail(acct.email);
                        setPassword(acct.password);
                      }}
                    >
                      Fill
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
