import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { getActiveSessionUser } from "@/lib/permissions";
import { getRoleHome } from "@/lib/session";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageShell,
} from "@/components/ui";
import { RoleHeaderActions } from "@/components/auth/role-header-actions";

export const dynamic = "force-dynamic";

export default async function CandidatePage() {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE") redirect(getRoleHome(user.role));

  return (
    <PageShell
      headerRight={<RoleHeaderActions name={user.name} role={user.role} />}
    >
      <div className="space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
            Candidate Portal
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
            Scheduled Assessments
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Only exams you are enrolled in appear here once published by your
            examiner.
          </p>
        </div>

        <Card>
          <CardHeader>
            <Badge
              variant="pine"
              icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Ready for Stage 4
            </Badge>
            <CardTitle className="mt-4">No enrolled exams yet</CardTitle>
            <CardDescription>
              Your candidate account is verified. Upcoming, Available now, and
              Completed exam tabs arrive once enrollment is wired in Stage 4.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs text-ink-muted">
              Signed in as {user.email}
            </p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
