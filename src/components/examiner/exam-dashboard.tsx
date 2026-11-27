"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileEdit,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Modal,
  SegmentedTabs,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  useToast,
  type BadgeVariant,
} from "@/components/ui";
import { createExamSchema } from "@/lib/validators/exam";
import type { DerivedExamStatus } from "@/lib/time";

export interface ExaminerExamRow {
  id: string;
  title: string;
  instructions: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  totalMarks: number;
  assignedMarks: number;
  status: "DRAFT" | "PUBLISHED";
  derivedStatus: DerivedExamStatus;
  questionCount: number;
  enrollmentCount: number;
}

const statusBadgeMap: Record<
  DerivedExamStatus,
  { variant: BadgeVariant; label: string; icon: React.ReactNode }
> = {
  DRAFT: {
    variant: "neutral",
    label: "Draft",
    icon: <FileEdit className="h-3 w-3" aria-hidden="true" />,
  },
  UPCOMING: {
    variant: "outline",
    label: "Upcoming",
    icon: <CalendarClock className="h-3 w-3" aria-hidden="true" />,
  },
  ONGOING: {
    variant: "pine",
    label: "Ongoing",
    icon: <Clock className="h-3 w-3" aria-hidden="true" />,
  },
  COMPLETED: {
    variant: "pine",
    label: "Completed",
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
  },
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExamDashboard({
  initialExams,
}: {
  initialExams: ExaminerExamRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [exams, setExams] = React.useState<ExaminerExamRow[]>(initialExams);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [durationMin, setDurationMin] = React.useState("60");
  const [totalMarks, setTotalMarks] = React.useState("25");
  const [negativeMarking, setNegativeMarking] = React.useState("0");
  const [shuffleQuestions, setShuffleQuestions] = React.useState(true);
  const [shuffleOptions, setShuffleOptions] = React.useState(true);

  const openCreateModal = () => {
    const now = Date.now();
    setStartTime(toLocalInputValue(new Date(now + 30 * 60000)));
    setEndTime(toLocalInputValue(new Date(now + 150 * 60000)));
    setFormError(null);
    setCreateOpen(true);
  };

  const filtered = React.useMemo(() => {
    if (statusFilter === "ALL") return exams;
    return exams.filter((e) => e.derivedStatus === statusFilter);
  }, [exams, statusFilter]);

  const tabs = [
    { id: "ALL", label: "All", count: exams.length },
    {
      id: "DRAFT",
      label: "Drafts",
      count: exams.filter((e) => e.derivedStatus === "DRAFT").length,
    },
    {
      id: "UPCOMING",
      label: "Upcoming",
      count: exams.filter((e) => e.derivedStatus === "UPCOMING").length,
    },
    {
      id: "ONGOING",
      label: "Ongoing",
      count: exams.filter((e) => e.derivedStatus === "ONGOING").length,
    },
  ];

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = createExamSchema.safeParse({
      title,
      instructions,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      durationMin: Number(durationMin),
      totalMarks: Number(totalMarks),
      negativeMarking: Number(negativeMarking),
      shuffleQuestions,
      shuffleOptions,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check exam settings");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/examiner/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          startTime: parsed.data.startTime.toISOString(),
          endTime: parsed.data.endTime.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create exam");
        setCreating(false);
        return;
      }

      toast.success("Exam draft created", "Add questions and review before publishing.");
      setCreateOpen(false);
      router.push(`/examiner/exams/${data.exam.id}`);
      router.refresh();
    } catch {
      setFormError("Network error while creating exam");
      setCreating(false);
    }
  };

  const handleDeleteDraft = async (examId: string, examTitle: string) => {
    try {
      const res = await fetch(`/api/examiner/exams/${examId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Delete failed", data.error ?? "Could not delete draft");
        return;
      }
      setExams((prev) => prev.filter((e) => e.id !== examId));
      toast.info("Draft removed", `"${examTitle}" was deleted.`);
    } catch {
      toast.warning("Network error", "Could not delete exam draft.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
            Examiner Workspace
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
            Examinations
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Status windows are evaluated exclusively from server time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/examiner/questions"
            className="pressable focus-ring inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border-default bg-surface text-sm font-medium text-ink hover:border-border-strong"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Question Bank</span>
          </Link>
          <Button variant="primary" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Exam</span>
          </Button>
        </div>
      </div>

      <SegmentedTabs
        tabs={tabs}
        value={statusFilter}
        onChange={setStatusFilter}
        ariaLabel="Filter exams by lifecycle status"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Exam</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Marks</TableHead>
            <TableHead className="text-right">Workspace</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableEmpty
              colSpan={5}
              title="No exams in this view"
              description="Create a new draft exam or switch status filters above."
            />
          ) : (
            filtered.map((exam) => {
              const badge = statusBadgeMap[exam.derivedStatus];
              const marksMatched =
                exam.questionCount > 0 &&
                Math.abs(exam.assignedMarks - exam.totalMarks) < 0.001;

              return (
                <TableRow key={exam.id}>
                  <TableCell>
                    <Link
                      href={`/examiner/exams/${exam.id}`}
                      className="font-medium text-ink hover:text-pine transition-colors"
                    >
                      {exam.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-muted font-mono tabular-nums">
                      {exam.questionCount} questions · {exam.durationMin} min ·{" "}
                      {exam.enrollmentCount} enrolled
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant} icon={badge.icon}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-ink-muted font-mono tabular-nums whitespace-nowrap">
                    {formatDateTime(exam.startTime)} →{" "}
                    {formatDateTime(exam.endTime)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        marksMatched
                          ? "font-mono text-xs font-medium text-pine tabular-nums"
                          : "font-mono text-xs font-medium text-terracotta tabular-nums"
                      }
                    >
                      {exam.assignedMarks} / {exam.totalMarks}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      {exam.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${exam.title}`}
                          onClick={() => handleDeleteDraft(exam.id, exam.title)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                        </Button>
                      )}
                      <Link
                        href={`/examiner/exams/${exam.id}`}
                        className="pressable focus-ring inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border-default bg-surface text-xs font-medium text-ink hover:border-border-strong"
                      >
                        <span>Open</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Draft Examination"
        description="Configure the assessment window, timing, and grading rules. You can add questions next."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-exam-form"
              variant="primary"
              loading={creating}
              loadingLabel="Creating..."
            >
              Create Draft
            </Button>
          </>
        }
      >
        <form
          id="create-exam-form"
          onSubmit={handleCreate}
          className="space-y-4"
          noValidate
        >
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-terracotta/30 bg-terracotta-tint px-3.5 py-2.5 text-sm text-terracotta"
            >
              {formError}
            </div>
          )}

          <Input
            label="Exam Title"
            placeholder="CS-301 Midterm Assessment"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={creating}
          />

          <Textarea
            label="Candidate Instructions"
            rows={3}
            placeholder="Read every question carefully. Your scratchpad saves automatically and is not graded."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={creating}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Window Opens"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={creating}
            />
            <Input
              label="Window Closes"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={creating}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Duration (minutes)"
              type="number"
              min={1}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              disabled={creating}
            />
            <Input
              label="Total Marks"
              type="number"
              step="0.5"
              min={0.5}
              value={totalMarks}
              onChange={(e) => setTotalMarks(e.target.value)}
              disabled={creating}
            />
            <Input
              label="Single MCQ Negative Mark"
              type="number"
              step="0.25"
              min={0}
              value={negativeMarking}
              onChange={(e) => setNegativeMarking(e.target.value)}
              disabled={creating}
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="accent-pine h-4 w-4 rounded"
              />
              <span>Shuffle question order per attempt</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="accent-pine h-4 w-4 rounded"
              />
              <span>Shuffle MCQ options per attempt</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
