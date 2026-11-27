"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  useToast,
} from "@/components/ui";
import {
  DifficultyValues,
  MultiModeValues,
  questionInputSchema,
  QuestionTypeValues,
  type AppDifficulty,
  type AppMultiMode,
  type AppQuestionType,
} from "@/lib/validators/question";
import {
  SAMPLE_QUESTIONS_CSV,
  SAMPLE_QUESTIONS_JSON,
  type ImportReport,
} from "@/lib/importer";

export interface QuestionItem {
  id: string;
  topic: string;
  difficulty: AppDifficulty;
  type: AppQuestionType;
  text: string;
  marks: number;
  multiMode: AppMultiMode;
  version: number;
  options: Array<{ id: string; text: string; isCorrect: boolean; order: number }>;
  usedInExamsCount: number;
}

interface DraftOption {
  text: string;
  isCorrect: boolean;
}

const DEFAULT_OPTIONS: DraftOption[] = [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function QuestionBank({
  initialQuestions,
}: {
  initialQuestions: QuestionItem[];
}) {
  const toast = useToast();
  const [questions, setQuestions] =
    React.useState<QuestionItem[]>(initialQuestions);
  const [search, setSearch] = React.useState("");
  const [topicFilter, setTopicFilter] = React.useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = React.useState("ALL");

  // Create/Edit modal
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [topic, setTopic] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<AppDifficulty>("MEDIUM");
  const [type, setType] = React.useState<AppQuestionType>("SINGLE");
  const [multiMode, setMultiMode] =
    React.useState<AppMultiMode>("PARTIAL_PENALTY");
  const [text, setText] = React.useState("");
  const [marks, setMarks] = React.useState("2");
  const [options, setOptions] = React.useState<DraftOption[]>(DEFAULT_OPTIONS);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Import modal
  const [importOpen, setImportOpen] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importReport, setImportReport] = React.useState<ImportReport | null>(
    null,
  );

  const topics = React.useMemo(
    () =>
      Array.from(new Set(questions.map((q) => q.topic))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [questions],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (topicFilter !== "ALL" && item.topic !== topicFilter) return false;
      if (difficultyFilter !== "ALL" && item.difficulty !== difficultyFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.text.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q)
      );
    });
  }, [questions, search, topicFilter, difficultyFilter]);

  const openCreateModal = () => {
    setEditingId(null);
    setTopic("");
    setDifficulty("MEDIUM");
    setType("SINGLE");
    setMultiMode("PARTIAL_PENALTY");
    setText("");
    setMarks("2");
    setOptions(DEFAULT_OPTIONS.map((o) => ({ ...o })));
    setFormError(null);
    setEditorOpen(true);
  };

  const openEditModal = (item: QuestionItem) => {
    setEditingId(item.id);
    setTopic(item.topic);
    setDifficulty(item.difficulty);
    setType(item.type);
    setMultiMode(item.multiMode);
    setText(item.text);
    setMarks(String(item.marks));
    setOptions(
      item.options.length > 0
        ? item.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
        : DEFAULT_OPTIONS.map((o) => ({ ...o })),
    );
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSaveQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const payload = {
      topic,
      difficulty,
      type,
      text,
      marks: Number(marks),
      multiMode,
      options:
        type === "WRITTEN"
          ? []
          : options.filter((o) => o.text.trim().length > 0),
    };

    const parsed = questionInputSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check question fields");
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/examiner/questions/${editingId}`
        : "/api/examiner/questions";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to save question");
        setSaving(false);
        return;
      }

      const saved: QuestionItem = {
        ...data.question,
        usedInExamsCount: data.question._count?.examQuestions ?? 0,
      };

      setQuestions((prev) =>
        editingId
          ? prev.map((q) => (q.id === editingId ? saved : q))
          : [saved, ...prev],
      );
      toast.success(
        editingId ? `Question updated (v${saved.version})` : "Question added",
        editingId
          ? "Active exam snapshots remain isolated."
          : "Added to your question bank.",
      );
      setEditorOpen(false);
    } catch {
      setFormError("Network error while saving question");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/examiner/questions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Delete refused", data.error ?? "Cannot delete question");
        return;
      }
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast.info("Question deleted", "Removed from your question bank.");
    } catch {
      toast.warning("Network error", "Could not delete question.");
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/examiner/questions/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Import error", data.error ?? "Could not process file");
        return;
      }
      setImportReport(data);

      // Refresh bank list if any rows imported
      if (data.imported > 0) {
        const listRes = await fetch("/api/examiner/questions");
        if (listRes.ok) {
          const listData = await listRes.json();
          setQuestions(
            listData.questions.map(
              (q: QuestionItem & { _count?: { examQuestions: number } }) => ({
                ...q,
                usedInExamsCount: q._count?.examQuestions ?? 0,
              }),
            ),
          );
        }
        toast.success(
          `Imported ${data.imported} question(s)`,
          data.failed.length > 0
            ? `${data.failed.length} row(s) had validation errors.`
            : "All rows validated cleanly.",
        );
      } else {
        toast.warning(
          "No valid rows imported",
          `${data.failed.length} row(s) failed validation.`,
        );
      }
    } catch {
      toast.warning("Upload failed", "Network error while importing questions.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

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
          <h1 className="mt-2 font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
            Question Bank
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Edits increment the question version and never alter active exam
            snapshots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setImportReport(null);
              setImportOpen(true);
            }}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Bulk Import</span>
          </Button>
          <Button variant="primary" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Question</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <Input
            aria-label="Search questions"
            placeholder="Search question text or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by topic"
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="focus-ring h-10 px-3 rounded-lg border border-border-default bg-surface text-sm text-ink"
        >
          <option value="ALL">All Topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by difficulty"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          className="focus-ring h-10 px-3 rounded-lg border border-border-default bg-surface text-sm text-ink"
        >
          <option value="ALL">All Difficulties</option>
          {DifficultyValues.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Question</TableHead>
            <TableHead>Topic</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Marks</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableEmpty
              colSpan={6}
              title="No questions found"
              description="Create a question manually or import a CSV / JSON file."
            />
          ) : (
            filtered.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="max-w-md">
                  <p className="text-sm font-medium text-ink line-clamp-2">
                    {q.text}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-ink-muted">
                    v{q.version}
                    {q.type !== "WRITTEN" &&
                      ` · ${q.options.length} options (${q.options.filter((o) => o.isCorrect).length} correct)`}
                  </p>
                </TableCell>
                <TableCell className="text-xs text-ink-muted">{q.topic}</TableCell>
                <TableCell>
                  <Badge variant="outline">{q.type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      q.difficulty === "HARD"
                        ? "terracotta"
                        : q.difficulty === "EASY"
                          ? "pine"
                          : "neutral"
                    }
                  >
                    {q.difficulty}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {q.marks}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Edit question"
                      onClick={() => openEditModal(q)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete question"
                      onClick={() => handleDelete(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Create / Edit Question Modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? "Edit Question" : "New Question"}
        description={
          editingId
            ? "Saving increments the version without altering active exam attempts."
            : "Add a Single MCQ, Multi-Select, or Written question."
        }
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditorOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="question-editor-form"
              variant="primary"
              loading={saving}
              loadingLabel="Saving..."
            >
              Save Question
            </Button>
          </>
        }
      >
        <form
          id="question-editor-form"
          onSubmit={handleSaveQuestion}
          className="space-y-4 max-h-[65vh] overflow-y-auto pr-1"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Topic"
              placeholder="Transactions"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={saving}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as AppDifficulty)
                }
                disabled={saving}
                className="focus-ring h-10 px-3 rounded-lg border border-border-default bg-surface text-sm text-ink"
              >
                {DifficultyValues.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Default Marks"
              type="number"
              step="0.5"
              min={0.5}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">
                Question Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AppQuestionType)}
                disabled={saving}
                className="focus-ring h-10 px-3 rounded-lg border border-border-default bg-surface text-sm text-ink"
              >
                {QuestionTypeValues.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {type === "MULTI" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink">
                  Multi-Select Scoring
                </label>
                <select
                  value={multiMode}
                  onChange={(e) => setMultiMode(e.target.value as AppMultiMode)}
                  disabled={saving}
                  className="focus-ring h-10 px-3 rounded-lg border border-border-default bg-surface text-sm text-ink"
                >
                  {MultiModeValues.map((m) => (
                    <option key={m} value={m}>
                      {m === "PARTIAL_PENALTY"
                        ? "Partial Credit with Penalty"
                        : "All or Nothing"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <Textarea
            label="Question Prompt"
            rows={3}
            placeholder="Write the complete question stem..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={saving}
          />

          {type !== "WRITTEN" && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">
                  Options ({type === "SINGLE" ? "pick 1 correct" : "pick 1+ correct"})
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setOptions((prev) => [
                      ...prev,
                      { text: "", isCorrect: false },
                    ])
                  }
                >
                  Add Option
                </Button>
              </div>

              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    aria-label={`Mark option ${idx + 1} as correct`}
                    onClick={() => {
                      setOptions((prev) =>
                        prev.map((item, i) => {
                          if (type === "SINGLE") {
                            return { ...item, isCorrect: i === idx };
                          }
                          return i === idx
                            ? { ...item, isCorrect: !item.isCorrect }
                            : item;
                        }),
                      );
                    }}
                    className={
                      opt.isCorrect
                        ? "pressable h-9 w-9 rounded-lg bg-pine text-white flex items-center justify-center shrink-0 cursor-pointer"
                        : "pressable h-9 w-9 rounded-lg border border-border-default bg-surface text-ink-muted hover:border-border-strong flex items-center justify-center shrink-0 cursor-pointer"
                    }
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <input
                    type="text"
                    value={opt.text}
                    placeholder={`Option ${idx + 1}`}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOptions((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, text: val } : item,
                        ),
                      );
                    }}
                    className="focus-ring flex-1 h-9 px-3 rounded-lg border border-border-default bg-surface text-sm text-ink"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setOptions((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Bulk Import Questions"
        description="Upload a CSV or JSON file. Valid rows import immediately while invalid rows are listed below with reasons."
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setImportOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadTextFile(
                  "sample-questions.csv",
                  SAMPLE_QUESTIONS_CSV,
                  "text/csv",
                )
              }
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sample CSV</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadTextFile(
                  "sample-questions.json",
                  SAMPLE_QUESTIONS_JSON,
                  "application/json",
                )
              }
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sample JSON</span>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Choose File (.csv or .json)</CardTitle>
              <CardDescription>
                CSV columns: topic, difficulty, type, text, marks, multiMode,
                options (pipe-separated), correct (1-based index or list).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                disabled={importing}
                onChange={handleFileUpload}
                className="block w-full text-sm text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-border-default file:text-sm file:font-medium file:bg-canvas file:text-ink hover:file:bg-subtle cursor-pointer"
              />
            </CardContent>
          </Card>

          {importReport && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="pine">
                  Imported: {importReport.imported}
                </Badge>
                <Badge
                  variant={
                    importReport.failed.length > 0 ? "terracotta" : "neutral"
                  }
                >
                  Rejected: {importReport.failed.length}
                </Badge>
              </div>

              {importReport.failed.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importReport.failed.map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {err.row}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-terracotta">
                            {err.field}
                          </TableCell>
                          <TableCell className="text-xs text-ink">
                            {err.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
