"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Lock,
  Plus,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  SegmentedTabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { updateExamSchema } from "@/lib/validators/exam";
import type { DerivedExamStatus, PublishChecklist } from "@/lib/time";
import type { QuestionItem } from "@/components/examiner/question-bank";
import { CandidatesTab } from "@/components/examiner/candidates-tab";
import type {
  AvailableCandidateItem,
  EnrolledCandidateItem,
} from "@/lib/enrollments";

export interface ExamWorkspaceData {
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
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  negativeMarking: number;
  enrollmentCount: number;
  examQuestions: Array<{
    id: string;
    questionId: string;
    order: number;
    marksOverride: number | null;
    effectiveMarks: number;
    question: {
      id: string;
      topic: string;
      difficulty: "EASY" | "MEDIUM" | "HARD";
      type: "SINGLE" | "MULTI" | "WRITTEN";
      text: string;
      marks: number;
      version: number;
    };
  }>;
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ExamWorkspace({
  initialExam,
  initialChecklist,
  bankQuestions,
  initialEnrolled,
  initialAvailableCandidates,
}: {
  initialExam: ExamWorkspaceData;
  initialChecklist: PublishChecklist;
  bankQuestions: QuestionItem[];
  initialEnrolled: EnrolledCandidateItem[];
  initialAvailableCandidates: AvailableCandidateItem[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [exam, setExam] = React.useState<ExamWorkspaceData>(initialExam);
  const [checklist, setChecklist] =
    React.useState<PublishChecklist>(initialChecklist);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [enrolledCount, setEnrolledCount] = React.useState(
    initialEnrolled.length,
  );

  // Overview form state
  const [title, setTitle] = React.useState(initialExam.title);
  const [instructions, setInstructions] = React.useState(
    initialExam.instructions,
  );
  const [startTime, setStartTime] = React.useState(
    toLocalInputValue(initialExam.startTime),
  );
  const [endTime, setEndTime] = React.useState(
    toLocalInputValue(initialExam.endTime),
  );
  const [durationMin, setDurationMin] = React.useState(
    String(initialExam.durationMin),
  );
  const [totalMarks, setTotalMarks] = React.useState(
    String(initialExam.totalMarks),
  );
  const [negativeMarking, setNegativeMarking] = React.useState(
    String(initialExam.negativeMarking),
  );
  const [shuffleQuestions, setShuffleQuestions] = React.useState(
    initialExam.shuffleQuestions,
  );
  const [shuffleOptions, setShuffleOptions] = React.useState(
    initialExam.shuffleOptions,
  );
  const [savingSettings, setSavingSettings] = React.useState(false);

  // Publish modal
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  // Question picker modal
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [mutatingQuestions, setMutatingQuestions] = React.useState(false);

  const isPublished = exam.status === "PUBLISHED";
  const isLockedCompletely =
    exam.derivedStatus === "ONGOING" || exam.derivedStatus === "COMPLETED";

  const assignedQuestionIds = React.useMemo(
    () => new Set(exam.examQuestions.map((eq) => eq.questionId)),
    [exam.examQuestions],
  );

  const availableBankQuestions = React.useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return bankQuestions.filter((item) => {
      if (assignedQuestionIds.has(item.id)) return false;
      if (!q) return true;
      return (
        item.text.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q)
      );
    });
  }, [bankQuestions, assignedQuestionIds, pickerSearch]);

  const refreshWorkspace = async () => {
    const res = await fetch(`/api/examiner/exams/${exam.id}`);
    if (res.ok) {
      const data = await res.json();
      setExam(data.exam);
      setChecklist(data.checklist);
    }
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = isPublished
      ? { title, instructions }
      : {
          title,
          instructions,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          durationMin: Number(durationMin),
          totalMarks: Number(totalMarks),
          negativeMarking: Number(negativeMarking),
          shuffleQuestions,
          shuffleOptions,
        };

    const parsed = updateExamSchema.safeParse(payload);
    if (!parsed.success) {
      toast.warning(
        "Check exam settings",
        parsed.error.issues[0]?.message ?? "Invalid settings",
      );
      return;
    }

    setSavingSettings(true);
    try {
      const res = await fetch(`/api/examiner/exams/${exam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isPublished
            ? { title, instructions }
            : {
                ...parsed.data,
                startTime: parsed.data.startTime?.toISOString(),
                endTime: parsed.data.endTime?.toISOString(),
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Save failed", data.error ?? "Could not update exam");
        return;
      }

      await refreshWorkspace();
      toast.success("Exam settings saved", "Changes recorded on the server.");
    } catch {
      toast.warning("Network error", "Could not save exam settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMutateQuestions = async (body: unknown) => {
    setMutatingQuestions(true);
    try {
      const res = await fetch(`/api/examiner/exams/${exam.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Update refused", data.error ?? "Could not update exam");
        return false;
      }
      setExam(data.exam);
      setChecklist(data.checklist);
      return true;
    } catch {
      toast.warning("Network error", "Could not update exam questions.");
      return false;
    } finally {
      setMutatingQuestions(false);
    }
  };

  const handleAddSelected = async () => {
    if (selectedIds.length === 0) return;
    const ok = await handleMutateQuestions({
      action: "add",
      questionIds: selectedIds,
    });
    if (ok) {
      toast.success(
        `Added ${selectedIds.length} question(s)`,
        "Exam marks summary updated.",
      );
      setSelectedIds([]);
      setPickerOpen(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= exam.examQuestions.length) return;
    const ids = exam.examQuestions.map((eq) => eq.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(nextIndex, 0, moved);
    await handleMutateQuestions({ action: "reorder", orderedIds: ids });
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/examiner/exams/${exam.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning(
          "Cannot publish exam",
          data.error ?? "Review checklist items first.",
        );
        return;
      }
      await refreshWorkspace();
      setPublishOpen(false);
      toast.success(
        "Exam published",
        `Status is now ${data.derivedStatus} based on server time.`,
      );
      router.refresh();
    } catch {
      toast.warning("Network error", "Could not publish exam.");
    } finally {
      setPublishing(false);
    }
  };

  const marksMatched =
    exam.examQuestions.length > 0 &&
    Math.abs(exam.assignedMarks - exam.totalMarks) < 0.001;

  const tabs = [
    { id: "overview", label: "Overview & Publish" },
    {
      id: "questions",
      label: "Questions",
      count: exam.examQuestions.length,
    },
    {
      id: "candidates",
      label: "Candidates",
      count: enrolledCount,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Link
            href="/examiner"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Examinations</span>
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
              {exam.title}
            </h1>
            <Badge
              variant={exam.status === "PUBLISHED" ? "pine" : "neutral"}
            >
              {exam.derivedStatus}
            </Badge>
          </div>
          <p className="mt-2 font-mono text-xs text-ink-muted tabular-nums">
            Assigned marks: {exam.assignedMarks} / {exam.totalMarks} ·{" "}
            {exam.durationMin} min · {enrolledCount} enrolled
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isPublished && (
            <Button
              variant="primary"
              onClick={async () => {
                await refreshWorkspace();
                setPublishOpen(true);
              }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Review &amp; Publish</span>
            </Button>
          )}
        </div>
      </div>

      <SegmentedTabs
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Exam workspace tabs"
      />

      {activeTab === "overview" && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Exam Settings</CardTitle>
            <CardDescription>
              {isPublished
                ? "Marks, time window, duration, and shuffling are locked once published."
                : "Configure schedule and grading parameters before publishing."}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSaveSettings}>
            <CardContent className="space-y-5">
              {isPublished && (
                <div className="rounded-lg border border-pine/25 bg-pine-tint px-4 py-3 flex items-center gap-2.5 text-xs text-pine font-medium">
                  <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Published exam lock active.{" "}
                    {isLockedCompletely
                      ? "The exam window has started, so all edits are disabled."
                      : "Only title and instructions may be adjusted before start time."}
                  </span>
                </div>
              )}

              <Input
                label="Exam Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLockedCompletely || savingSettings}
              />

              <Textarea
                label="Candidate Instructions"
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={isLockedCompletely || savingSettings}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Window Opens"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isPublished || savingSettings}
                />
                <Input
                  label="Window Closes"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isPublished || savingSettings}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Duration (min)"
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  disabled={isPublished || savingSettings}
                />
                <Input
                  label="Total Marks"
                  type="number"
                  step="0.5"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(e.target.value)}
                  disabled={isPublished || savingSettings}
                />
                <Input
                  label="Single MCQ Negative Mark"
                  type="number"
                  step="0.25"
                  value={negativeMarking}
                  onChange={(e) => setNegativeMarking(e.target.value)}
                  disabled={isPublished || savingSettings}
                />
              </div>

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    disabled={isPublished || savingSettings}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="accent-pine h-4 w-4 rounded"
                  />
                  <span>Shuffle questions</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    disabled={isPublished || savingSettings}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="accent-pine h-4 w-4 rounded"
                  />
                  <span>Shuffle options</span>
                </label>
              </div>
            </CardContent>

            {!isLockedCompletely && (
              <CardFooter>
                <span className="text-xs text-ink-muted">
                  Status: {exam.derivedStatus}
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  loading={savingSettings}
                  loadingLabel="Saving..."
                >
                  Save Changes
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>
      )}

      {activeTab === "questions" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border-default bg-surface px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-ink">
                Marks Total:
              </span>
              <Badge variant={marksMatched ? "pine" : "terracotta"}>
                {exam.assignedMarks} / {exam.totalMarks} marks
              </Badge>
              {!marksMatched && (
                <span className="text-xs text-terracotta">
                  Must equal {exam.totalMarks} before publishing.
                </span>
              )}
            </div>

            {!isPublished && (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/examiner/questions"
                  className="pressable focus-ring inline-flex items-center h-9 px-3.5 rounded-lg border border-border-default bg-surface text-xs font-medium text-ink hover:border-border-strong"
                >
                  Manage Bank
                </Link>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedIds([]);
                    setPickerOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Questions</span>
                </Button>
              </div>
            )}
          </div>

          {exam.examQuestions.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No questions assigned yet</CardTitle>
                <CardDescription>
                  Select questions from your bank or bulk import them first.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-3">
              {exam.examQuestions.map((eq, index) => (
                <Card key={eq.id}>
                  <CardContent className="pt-5 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-pine tabular-nums">
                          Q{index + 1}
                        </span>
                        <Badge variant="outline">{eq.question.type}</Badge>
                        <Badge variant="neutral">{eq.question.topic}</Badge>
                        <span className="font-mono text-[11px] text-ink-muted">
                          v{eq.question.version}
                        </span>
                      </div>
                      <p className="text-sm text-ink leading-relaxed">
                        {eq.question.text}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                        <span>Marks</span>
                        <input
                          type="number"
                          step="0.5"
                          min={0.5}
                          disabled={isPublished || mutatingQuestions}
                          defaultValue={eq.effectiveMarks}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (
                              Number.isFinite(val) &&
                              val > 0 &&
                              val !== eq.effectiveMarks
                            ) {
                              handleMutateQuestions({
                                action: "setMarks",
                                examQuestionId: eq.id,
                                marksOverride:
                                  val === eq.question.marks ? null : val,
                              });
                            }
                          }}
                          className="focus-ring w-16 h-8 px-2 rounded-md border border-border-default bg-surface font-mono text-xs text-ink tabular-nums disabled:opacity-60"
                        />
                      </label>

                      {!isPublished && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Move up"
                            disabled={index === 0 || mutatingQuestions}
                            onClick={() => handleMove(index, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Move down"
                            disabled={
                              index === exam.examQuestions.length - 1 ||
                              mutatingQuestions
                            }
                            onClick={() => handleMove(index, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Remove from exam"
                            disabled={mutatingQuestions}
                            onClick={() =>
                              handleMutateQuestions({
                                action: "remove",
                                examQuestionId: eq.id,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5 text-terracotta" aria-hidden="true" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "candidates" && (
        <CandidatesTab
          examId={exam.id}
          initialEnrolled={initialEnrolled}
          initialAvailable={initialAvailableCandidates}
          onCountChange={setEnrolledCount}
        />
      )}

      {/* Pre-Publish Review Modal */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Pre-Publish Review"
        description="Verify all requirements before locking marks, time window, and question list."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPublishOpen(false)}
              disabled={publishing}
            >
              Back to Draft
            </Button>
            <Button
              variant="primary"
              disabled={!checklist.canPublish || publishing}
              loading={publishing}
              loadingLabel="Publishing..."
              onClick={handlePublish}
            >
              Publish Exam
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-canvas p-4 space-y-3">
            {checklist.checks.map((item) => (
              <div key={item.key} className="flex items-start gap-3">
                {item.ok ? (
                  <CheckCircle2
                    className="h-4 w-4 text-pine shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    className="h-4 w-4 text-terracotta shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-ink">{item.label}</p>
                  {item.message && (
                    <p className="text-xs text-ink-muted mt-0.5">
                      {item.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {checklist.warnings.map((warn, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-terracotta/30 bg-terracotta-tint px-4 py-3 flex items-start gap-2.5 text-xs text-terracotta"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Question Picker Modal */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add Questions from Bank"
        description="Select questions to append to this draft exam."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPickerOpen(false)}
              disabled={mutatingQuestions}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={selectedIds.length === 0 || mutatingQuestions}
              loading={mutatingQuestions}
              loadingLabel="Adding..."
              onClick={handleAddSelected}
            >
              Add {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            aria-label="Search bank questions"
            placeholder="Search by topic or prompt..."
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
          />

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {availableBankQuestions.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-muted">
                No unassigned questions match your search.
              </p>
            ) : (
              availableBankQuestions.map((q) => {
                const checked = selectedIds.includes(q.id);
                return (
                  <label
                    key={q.id}
                    className="flex items-start gap-3 rounded-lg border border-border-default bg-canvas/60 px-4 py-3 cursor-pointer hover:border-border-strong"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          checked
                            ? prev.filter((id) => id !== q.id)
                            : [...prev, q.id],
                        )
                      }
                      className="mt-1 accent-pine h-4 w-4 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{q.type}</Badge>
                        <Badge variant="neutral">{q.topic}</Badge>
                        <span className="font-mono text-xs text-ink-muted tabular-nums">
                          {q.marks} marks
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-ink line-clamp-2">
                        {q.text}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
