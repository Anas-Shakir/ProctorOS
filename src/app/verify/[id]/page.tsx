import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageShell,
} from "@/components/ui";
import { verifyReportToken } from "@/lib/verify";

export const dynamic = "force-dynamic";

export default async function PublicVerifyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await verifyReportToken(id);

  return (
    <PageShell
      maxWidth="narrow"
      headerRight={
        <Link
          href="/login"
          className="pressable focus-ring inline-flex items-center h-9 px-3.5 rounded-lg border border-border-default bg-surface text-sm font-medium text-ink hover:border-border-strong"
        >
          Sign In
        </Link>
      }
    >
      <div className="mx-auto max-w-lg py-6 sm:py-12">
        <Card className="stagger-in">
          <CardHeader>
            {result.status === "VALID" ? (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-pine-tint text-pine mb-3">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
            ) : result.status === "SUPERSEDED" ? (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta-tint text-terracotta mb-3">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
            ) : (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta-tint text-terracotta mb-3">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </div>
            )}

            <div>
              <Badge
                variant={result.status === "VALID" ? "pine" : "terracotta"}
              >
                {result.status === "VALID"
                  ? "Valid Report"
                  : result.status === "SUPERSEDED"
                    ? "Superseded"
                    : "Not Found"}
              </Badge>
            </div>

            <CardTitle className="mt-4 font-serif text-2xl font-medium">
              {result.status === "VALID"
                ? "Verified Examination Report"
                : result.status === "SUPERSEDED"
                  ? "Report Superseded by Regrade"
                  : "Verification Token Not Found"}
            </CardTitle>

            <CardDescription>
              {result.status === "VALID"
                ? "This report token matches an authentic ProctorOS transcript."
                : result.status === "SUPERSEDED"
                  ? "A newer score or ruling was issued after this PDF was generated. Request an updated report from the candidate or examiner."
                  : "No authentic report matches this verification identifier."}
            </CardDescription>
          </CardHeader>

          {result.status !== "NOT_FOUND" && (
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border-default bg-canvas p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-muted">Examination</span>
                  <span className="font-medium text-ink text-right">
                    {result.examTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-muted">Candidate</span>
                  <span className="font-mono text-xs text-ink">
                    {result.maskedName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink-muted">Score Band</span>
                  <span className="font-mono text-xs font-medium text-pine">
                    {result.scoreBand}
                  </span>
                </div>
                {result.issuedAt && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-ink-muted">Issued</span>
                    <span className="font-mono text-xs text-ink tabular-nums">
                      {new Date(result.issuedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-ink-muted">
                Privacy notice: public verification exposes only report status,
                exam title, issue date, score band, and masked name.
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
