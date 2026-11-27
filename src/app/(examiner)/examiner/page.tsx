import { redirect } from "next/navigation";
import { getActiveSessionUser } from "@/lib/permissions";
import { getRoleHome } from "@/lib/session";
import { listExaminerExams } from "@/lib/exams";
import { PageShell } from "@/components/ui";
import { RoleHeaderActions } from "@/components/auth/role-header-actions";
import { ExamDashboard } from "@/components/examiner/exam-dashboard";

export const dynamic = "force-dynamic";

export default async function ExaminerPage() {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "EXAMINER" && user.role !== "ADMIN") {
    redirect(getRoleHome(user.role));
  }

  const { exams } = await listExaminerExams(user);

  const serialized = exams.map((exam) => ({
    id: exam.id,
    title: exam.title,
    instructions: exam.instructions,
    startTime: exam.startTime.toISOString(),
    endTime: exam.endTime.toISOString(),
    durationMin: exam.durationMin,
    totalMarks: exam.totalMarks,
    assignedMarks: exam.assignedMarks,
    status: exam.status,
    derivedStatus: exam.derivedStatus,
    questionCount: exam.questionCount,
    enrollmentCount: exam.enrollmentCount,
  }));

  return (
    <PageShell
      headerRight={<RoleHeaderActions name={user.name} role={user.role} />}
    >
      <ExamDashboard initialExams={serialized} />
    </PageShell>
  );
}
