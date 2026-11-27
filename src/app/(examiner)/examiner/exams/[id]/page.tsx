import { notFound, redirect } from "next/navigation";
import { getActiveSessionUser, HttpError, requireExamOwner } from "@/lib/permissions";
import { getRoleHome } from "@/lib/session";
import { getExamWorkspace } from "@/lib/exams";
import { listQuestions } from "@/lib/questions";
import { listExamEnrollments } from "@/lib/enrollments";
import { getExaminerGradingAndResults } from "@/lib/results";
import { PageShell } from "@/components/ui";
import { RoleHeaderActions } from "@/components/auth/role-header-actions";
import { ExamWorkspace } from "@/components/examiner/exam-workspace";

export const dynamic = "force-dynamic";

export default async function ExaminerExamWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "EXAMINER" && user.role !== "ADMIN") {
    redirect(getRoleHome(user.role));
  }

  const { id } = await params;

  try {
    await requireExamOwner(id);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      notFound();
    }
    redirect("/examiner");
  }

  const [workspace, bank, enrollments, gradingSummary] = await Promise.all([
    getExamWorkspace(id),
    listQuestions(user),
    listExamEnrollments(id),
    getExaminerGradingAndResults(id),
  ]);

  const serializedExam = {
    id: workspace.exam.id,
    title: workspace.exam.title,
    instructions: workspace.exam.instructions,
    startTime: workspace.exam.startTime.toISOString(),
    endTime: workspace.exam.endTime.toISOString(),
    durationMin: workspace.exam.durationMin,
    totalMarks: workspace.exam.totalMarks,
    assignedMarks: workspace.exam.assignedMarks,
    status: workspace.exam.status,
    derivedStatus: workspace.exam.derivedStatus,
    shuffleQuestions: workspace.exam.shuffleQuestions,
    shuffleOptions: workspace.exam.shuffleOptions,
    negativeMarking: workspace.exam.negativeMarking,
    enrollmentCount: workspace.exam.enrollmentCount,
    examQuestions: workspace.exam.examQuestions.map((eq) => ({
      id: eq.id,
      questionId: eq.questionId,
      order: eq.order,
      marksOverride: eq.marksOverride,
      effectiveMarks: eq.effectiveMarks,
      question: {
        id: eq.question.id,
        topic: eq.question.topic,
        difficulty: eq.question.difficulty,
        type: eq.question.type,
        text: eq.question.text,
        marks: eq.question.marks,
        version: eq.question.version,
      },
    })),
  };

  const serializedBank = bank.map((q) => ({
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
      <ExamWorkspace
        initialExam={serializedExam}
        initialChecklist={workspace.checklist}
        bankQuestions={serializedBank}
        initialEnrolled={enrollments.enrolled}
        initialAvailableCandidates={enrollments.availableCandidates}
        initialGradingState={{
          resultsPublished: gradingSummary.exam.resultsPublished,
          inProgressCount: gradingSummary.inProgressCount,
          pendingWrittenAttempts: gradingSummary.pendingWrittenAttempts,
          writtenItems: gradingSummary.writtenItems,
          results: gradingSummary.results,
        }}
      />
    </PageShell>
  );
}
