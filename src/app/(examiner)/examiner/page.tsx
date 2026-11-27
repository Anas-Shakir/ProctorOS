import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
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

export default async function ExaminerPage() {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "EXAMINER") redirect(getRoleHome(user.role));

  return (
    <PageShell
      headerRight={<RoleHeaderActions name={user.name} role={user.role} />}
    >
      <div className="space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
            Examiner Workspace
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
            Your Examinations
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Create assessments, assemble question banks, monitor live attempts,
            and review disputes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <Badge
              variant="pine"
              icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Ready for Stage 2
            </Badge>
            <CardTitle className="mt-4">No examinations created yet</CardTitle>
            <CardDescription>
              Your examiner workspace is authenticated and isolated to your
              owned exams. Exam creation and lifecycle controls arrive in Stage
              2.
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
