"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  Lock,
  Shield,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageShell,
  useToast,
} from "@/components/ui";
import { loginSchema } from "@/lib/validators/auth";

const DEMO_ACCOUNTS = [
  {
    role: "Examiner",
    name: "Dr. Nadia Hassan",
    email: "examiner1@proctoros.local",
    password: "Examiner123!",
    hint: "Live monitor, analytics, dispute queue, question rulings & audit verify",
    badgeVariant: "pine" as const,
    icon: BookOpenCheck,
  },
  {
    role: "Candidate (Results & Dispute)",
    name: "Candidate 01",
    email: "candidate1@proctoros.local",
    password: "Candidate123!",
    hint: "Published CS-401 report PDF, QR verify & open ambiguity dispute",
    badgeVariant: "outline" as const,
    icon: GraduationCap,
  },
  {
    role: "Candidate (Fresh Live Exam)",
    name: "Candidate 03",
    email: "candidate3@proctoros.local",
    password: "Candidate123!",
    hint: "Start ongoing CS-412 quiz, test offline autosave, scratchpad & shortcuts",
    badgeVariant: "neutral" as const,
    icon: GraduationCap,
  },
  {
    role: "Administrator",
    name: "System Administrator",
    email: "admin@proctoros.local",
    password: "Admin123!",
    hint: "User provisioning, role assignment, and account access control",
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
    <PageShell
      headerRight={
        <Link
          href="/"
          className="pressable focus-ring inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-subtle"
        >
          Home
        </Link>
      }
    >
      <div className="mx-auto max-w-5xl py-6 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5">
          <Card className="stagger-in">
            <CardHeader>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-pine-tint text-pine mb-3">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </div>
              <CardTitle className="font-serif text-2xl font-medium">
                Sign in to ProctorOS
              </CardTitle>
              <CardDescription>
                Use your assigned credentials or select a demo persona on the
                right to explore the live platform.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
                  className="w-full"
                  loading={submitting}
                  loadingLabel="Signing in..."
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.06em] text-pine">
              Judge &amp; Evaluator Quick Access
            </p>
            <h2 className="font-serif text-2xl font-medium text-ink">
              One-click demo personas
            </h2>
            <p className="text-sm text-ink-muted">
              Each button authenticates a real seeded account with server-enforced
              role permissions. Open separate browser profiles to test candidate
              and examiner views side by side.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DEMO_ACCOUNTS.map((acct) => {
              const Icon = acct.icon;
              return (
                <Card key={acct.email} interactive>
                  <CardContent className="pt-5 pb-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={acct.badgeVariant}
                        icon={<Icon className="h-3 w-3" aria-hidden="true" />}
                      >
                        {acct.role}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-ink">{acct.name}</p>
                      <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                        {acct.hint}
                      </p>
                    </div>
                    <p className="font-mono text-[11px] text-ink-muted bg-canvas rounded-md border border-border-default px-2.5 py-1.5 break-all">
                      {acct.email} · {acct.password}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
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
                        <span>Enter as {acct.name.split(" ")[0]}</span>
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
