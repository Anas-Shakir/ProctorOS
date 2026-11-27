import { redirect } from "next/navigation";
import { getActiveSessionUser } from "@/lib/permissions";
import { getRoleHome } from "@/lib/session";
import { listQuestions } from "@/lib/questions";
import { PageShell } from "@/components/ui";
import { RoleHeaderActions } from "@/components/auth/role-header-actions";
import { QuestionBank } from "@/components/examiner/question-bank";

export const dynamic = "force-dynamic";

export default async function ExaminerQuestionsPage() {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "EXAMINER" && user.role !== "ADMIN") {
    redirect(getRoleHome(user.role));
  }

  const questions = await listQuestions(user);

  const serialized = questions.map((q) => ({
    id: q.id,
    topic: q.topic,
    difficulty: q.difficulty,
    type: q.type,
    text: q.text,
    marks: q.marks,
    multiMode: q.multiMode,
    version: q.version,
    options: q.options.map((opt) => ({
      id: opt.id,
      text: opt.text,
      isCorrect: opt.isCorrect,
      order: opt.order,
    })),
    usedInExamsCount: q._count.examQuestions,
  }));

  return (
    <PageShell
      headerRight={<RoleHeaderActions name={user.name} role={user.role} />}
    >
      <QuestionBank initialQuestions={serialized} />
    </PageShell>
  );
}
