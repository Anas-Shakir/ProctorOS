"use client";

import * as React from "react";
import {
  Download,
  KeyRound,
  Plus,
  Trash2,
  Upload,
  UserCheck,
  UserX,
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
  useToast,
} from "@/components/ui";
import { SAMPLE_CANDIDATES_CSV, type ImportFailure } from "@/lib/importer";
import type {
  AvailableCandidateItem,
  EnrolledCandidateItem,
  GeneratedCredential,
} from "@/lib/enrollments";

interface CandidateImportResponse {
  createdAccounts: number;
  enrolledCount: number;
  createdCredentials: GeneratedCredential[];
  failed: ImportFailure[];
  enrolled?: EnrolledCandidateItem[];
  availableCandidates?: AvailableCandidateItem[];
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCredentialsCsv(rows: GeneratedCredential[]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const header = "name,email,one_time_password";
  const lines = rows.map(
    (r) => `${escape(r.name)},${escape(r.email)},${escape(r.oneTimePassword)}`,
  );
  return [header, ...lines].join("\n");
}

export function CandidatesTab({
  examId,
  initialEnrolled,
  initialAvailable,
  onCountChange,
}: {
  examId: string;
  initialEnrolled: EnrolledCandidateItem[];
  initialAvailable: AvailableCandidateItem[];
  onCountChange: (nextCount: number) => void;
}) {
  const toast = useToast();
  const [enrolled, setEnrolled] =
    React.useState<EnrolledCandidateItem[]>(initialEnrolled);
  const [available, setAvailable] =
    React.useState<AvailableCandidateItem[]>(initialAvailable);

  // Add existing candidates modal
  const [addOpen, setAddOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [adding, setAdding] = React.useState(false);

  // Bulk import modal
  const [importOpen, setImportOpen] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{
    createdAccounts: number;
    enrolled: number;
    createdCredentials: GeneratedCredential[];
    failed: ImportFailure[];
  } | null>(null);

  const filteredAvailable = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [available, search]);

  const applyListState = (data: {
    enrolled: EnrolledCandidateItem[];
    availableCandidates: AvailableCandidateItem[];
  }) => {
    setEnrolled(data.enrolled);
    setAvailable(data.availableCandidates);
    onCountChange(data.enrolled.length);
  };

  const handleEnrollSelected = async () => {
    if (selectedIds.length === 0) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/examiner/exams/${examId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Enrollment failed", data.error ?? "Could not enroll");
        return;
      }
      applyListState(data);
      toast.success(
        `Enrolled ${selectedIds.length} candidate(s)`,
        "They can view this exam once published.",
      );
      setSelectedIds([]);
      setAddOpen(false);
    } catch {
      toast.warning("Network error", "Could not enroll candidates.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (candidateId: string, name: string) => {
    try {
      const res = await fetch(`/api/examiner/exams/${examId}/enrollments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Remove refused", data.error ?? "Could not unenroll");
        return;
      }
      applyListState(data);
      toast.info("Enrollment removed", `${name} was unenrolled.`);
    } catch {
      toast.warning("Network error", "Could not remove enrollment.");
    }
  };

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/examiner/exams/${examId}/enrollments/import`,
        {
          method: "POST",
          body: form,
        },
      );
      const data = (await res.json()) as CandidateImportResponse & {
        error?: string;
      };

      if (!res.ok) {
        toast.warning("Import error", data.error ?? "Could not parse CSV");
        return;
      }

      setImportResult({
        createdAccounts: data.createdAccounts,
        enrolled: data.enrolledCount ?? 0,
        createdCredentials: data.createdCredentials ?? [],
        failed: data.failed ?? [],
      });

      if (data.enrolled && data.availableCandidates) {
        applyListState({
          enrolled: data.enrolled,
          availableCandidates: data.availableCandidates,
        });
      }

      if (data.createdAccounts > 0 || data.enrolledCount > 0) {
        toast.success(
          `Enrolled ${data.enrolledCount} candidate(s)`,
          data.createdAccounts > 0
            ? `Created ${data.createdAccounts} new account(s) with one-time passwords.`
            : "Existing accounts enrolled.",
        );
      } else {
        toast.warning(
          "No candidates enrolled",
          `${data.failed.length} row(s) had errors.`,
        );
      }
    } catch {
      toast.warning("Upload failed", "Network error while importing CSV.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border-default bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink">
            Enrolled Candidates:
          </span>
          <Badge variant={enrolled.length > 0 ? "pine" : "terracotta"}>
            {enrolled.length} enrolled
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setImportResult(null);
              setImportOpen(true);
            }}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Import CSV</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedIds([]);
              setSearch("");
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Enroll Existing</span>
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Attempt</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enrolled.length === 0 ? (
            <TableEmpty
              colSpan={5}
              title="No candidates enrolled yet"
              description="Enroll existing candidates or upload a name,email CSV to create accounts automatically."
            />
          ) : (
            enrolled.map((item) => (
              <TableRow key={item.enrollmentId}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="font-mono text-xs text-ink-muted">
                  {item.email}
                </TableCell>
                <TableCell>
                  {item.isActive ? (
                    <Badge
                      variant="pine"
                      icon={
                        <UserCheck className="h-3 w-3" aria-hidden="true" />
                      }
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="terracotta"
                      icon={<UserX className="h-3 w-3" aria-hidden="true" />}
                    >
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {item.attemptStatus ? (
                    <Badge variant="outline">{item.attemptStatus}</Badge>
                  ) : (
                    <span className="text-xs text-ink-muted">Not started</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(item.attemptStatus)}
                    aria-label={`Unenroll ${item.name}`}
                    onClick={() => handleRemove(item.candidateId, item.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-terracotta" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Add Existing Candidates Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Enroll Existing Candidates"
        description="Select active candidate accounts to grant access to this exam."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAddOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={selectedIds.length === 0 || adding}
              loading={adding}
              loadingLabel="Enrolling..."
              onClick={handleEnrollSelected}
            >
              Enroll {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            aria-label="Search candidates"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {filteredAvailable.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-muted">
                All matching active candidates are already enrolled.
              </p>
            ) : (
              filteredAvailable.map((c) => {
                const checked = selectedIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-canvas/60 px-4 py-3 cursor-pointer hover:border-border-strong"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id],
                          )
                        }
                        className="accent-pine h-4 w-4 rounded"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {c.name}
                        </p>
                        <p className="font-mono text-xs text-ink-muted truncate">
                          {c.email}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Bulk Candidate CSV Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Bulk Import & Enroll Candidates"
        description="Upload a CSV with name,email columns. Missing candidate accounts are created automatically with one-time passwords."
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
                downloadCsv("sample-candidates.csv", SAMPLE_CANDIDATES_CSV)
              }
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sample CSV</span>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upload CSV (`name,email`)</CardTitle>
              <CardDescription>
                Invalid or duplicate rows are listed with reasons; valid rows
                enroll right away.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={importing}
                onChange={handleCsvUpload}
                className="block w-full text-sm text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-border-default file:text-sm file:font-medium file:bg-canvas file:text-ink hover:file:bg-subtle cursor-pointer"
              />
            </CardContent>
          </Card>

          {importResult && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="pine">
                  Enrolled: {importResult.enrolled}
                </Badge>
                <Badge variant="outline">
                  New Accounts: {importResult.createdAccounts}
                </Badge>
                <Badge
                  variant={
                    importResult.failed.length > 0 ? "terracotta" : "neutral"
                  }
                >
                  Rejected: {importResult.failed.length}
                </Badge>
              </div>

              {importResult.createdCredentials.length > 0 && (
                <div className="rounded-xl border border-pine/30 bg-pine-tint p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <KeyRound
                        className="h-4 w-4 text-pine shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-medium text-ink">
                          One-time passwords generated (shown once)
                        </p>
                        <p className="text-xs text-ink-muted">
                          Download this credentials CSV now. Plaintext
                          passwords are not stored on the server.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        downloadCsv(
                          `exam-${examId}-credentials.csv`,
                          toCredentialsCsv(importResult.createdCredentials),
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Download Credentials</span>
                    </Button>
                  </div>
                </div>
              )}

              {importResult.failed.length > 0 && (
                <div className="max-h-52 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.failed.map((err, idx) => (
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
