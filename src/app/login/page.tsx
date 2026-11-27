"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";
import {
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

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
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

  return (
    <PageShell
      maxWidth="narrow"
      headerRight={
        <Link
          href="/"
          className="pressable focus-ring inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-subtle"
        >
          Home
        </Link>
      }
    >
      <div className="mx-auto max-w-md py-8 sm:py-14">
        <Card className="stagger-in">
          <CardHeader>
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-pine-tint text-pine mb-3">
              <Lock className="h-4 w-4" aria-hidden="true" />
            </div>
            <CardTitle className="font-serif text-2xl font-medium">
              Sign in to ProctorOS
            </CardTitle>
            <CardDescription>
              Use the credentials assigned by your administrator. Public
              registration is disabled.
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
    </PageShell>
  );
}
