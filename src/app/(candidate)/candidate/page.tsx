import { redirect } from "next/navigation";
import { getActiveSessionUser } from "@/lib/permissions";
import { getRoleHome } from "@/lib/session";
import { listCandidateExams } from "@/lib/candidate";
import { PageShell } from "@/components/ui";
import { RoleHeaderActions } from "@/components/auth/role-header-actions";
import { CandidateDashboard } from "@/components/candidate/candidate-dashboard";

export const dynamic = "force-dynamic";

export default async function CandidatePage() {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE") redirect(getRoleHome(user.role));

  const { exams } = await listCandidateExams(user.id);

  return (
    <PageShell
      headerRight={<RoleHeaderActions name={user.name} role={user.role} />}
    >
      <CandidateDashboard initialExams={exams} />
    </PageShell>
  );
}
