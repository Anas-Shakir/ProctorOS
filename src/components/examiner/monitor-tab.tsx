"use client";

import * as React from "react";
import {
  AlertCircle,
  Megaphone,
  Radio,
  RefreshCw,
  Send,
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
import type {
  AnnouncementItem,
  ExamMonitorState,
  MonitorAttemptRow,
} from "@/lib/monitor";

function formatRemaining(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MonitorTab({
  examId,
  initialState,
}: {
  examId: string;
  initialState: ExamMonitorState;
}) {
  const toast = useToast();
  const [state, setState] = React.useState<ExamMonitorState>(initialState);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = React.useState<
    string | null
  >(null);
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const selectedAttempt: MonitorAttemptRow | null = React.useMemo(
    () =>
      state.attempts.find((a) => a.attemptId === selectedAttemptId) ?? null,
    [state.attempts, selectedAttemptId],
  );

  const fetchLatest = React.useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const res = await fetch(`/api/examiner/exams/${examId}/monitor`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as ExamMonitorState;
          setState(data);
        }
      } catch {
        // Ignore transient polling hiccup
      } finally {
        if (manual) setRefreshing(false);
      }
    },
    [examId],
  );

  React.useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) {
        void fetchLatest(false);
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [fetchLatest]);

  const handleSendAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 2) {
      toast.warning("Message too short", "Enter at least 2 characters.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(
        `/api/examiner/exams/${examId}/announcements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Broadcast failed", data.error ?? "Could not send");
        return;
      }

      setState((prev) => ({
        ...prev,
        announcements: data.announcements as AnnouncementItem[],
      }));
      setMessage("");
      toast.success(
        "Announcement sent",
        "Active candidates will see it within 10 seconds.",
      );
    } catch {
      toast.warning("Network error", "Could not post announcement.");
    } finally {
      setSending(false);
    }
  };

  const activeCount = state.attempts.filter(
    (a) => a.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="space-y-8">
      {/* Live Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border-default bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={
              state.exam.derivedStatus === "ONGOING" ? "pine" : "outline"
            }
            icon={<Radio className="h-3 w-3" aria-hidden="true" />}
          >
            {state.exam.derivedStatus}
          </Badge>
          <span className="text-sm text-ink font-medium">
            {activeCount} active · {state.attempts.length} total real attempt(s)
          </span>
          <span className="font-mono text-xs text-ink-muted">
            Polling every 5s
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          loading={refreshing}
          loadingLabel="Refreshing..."
          onClick={() => void fetchLatest(true)}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Live Attempts Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Time Left</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Events</TableHead>
            <TableHead className="text-right">Timeline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.attempts.length === 0 ? (
            <TableEmpty
              colSpan={7}
              title="No candidate attempts yet"
              description="Live progress and recorded events appear here as soon as enrolled candidates begin."
            />
          ) : (
            state.attempts.map((row) => (
              <TableRow key={row.attemptId}>
                <TableCell>
                  <p className="font-medium text-ink">{row.candidateName}</p>
                  <p className="font-mono text-xs text-ink-muted">
                    {row.candidateEmail}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === "IN_PROGRESS" ? "pine" : "neutral"
                    }
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {row.answeredCount} / {row.totalQuestions}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {row.status === "IN_PROGRESS"
                    ? formatRemaining(row.remainingSeconds)
                    : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-ink-muted tabular-nums">
                  {new Date(row.lastActivityAt).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={row.incidentCount > 0 ? "terracotta" : "neutral"}
                  >
                    {row.incidentCount} event{row.incidentCount === 1 ? "" : "s"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedAttemptId(row.attemptId)}
                  >
                    View Events
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Announcements Broadcast Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-pine" aria-hidden="true" />
            <CardTitle>Exam Announcements</CardTitle>
          </div>
          <CardDescription>
            Broadcast clarifications to all candidates taking this exam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            onSubmit={handleSendAnnouncement}
            className="flex flex-col sm:flex-row gap-3 items-start sm:items-end"
          >
            <div className="flex-1 w-full">
              <Input
                label="Message"
                placeholder="Example: Question 3 asks for positive integers only."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={sending}
              loadingLabel="Sending..."
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Broadcast</span>
            </Button>
          </form>

          {state.announcements.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-border-default">
              {state.announcements.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border-default bg-canvas px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <p className="text-sm text-ink">{item.message}</p>
                  <span className="font-mono text-xs text-ink-muted shrink-0 tabular-nums">
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Timeline Modal / Drawer */}
      <Modal
        open={Boolean(selectedAttempt)}
        onClose={() => setSelectedAttemptId(null)}
        title={
          selectedAttempt
            ? `Recorded Events — ${selectedAttempt.candidateName}`
            : "Recorded Events"
        }
        description="Chronological client session telemetry captured during the attempt."
        size="lg"
        footer={
          <Button
            variant="secondary"
            onClick={() => setSelectedAttemptId(null)}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border-default bg-canvas px-4 py-3 flex items-start gap-2.5 text-xs text-ink-muted">
            <AlertCircle
              className="h-4 w-4 text-ink-muted shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>
              These are automated indicators and are not evidence of misconduct.
            </span>
          </div>

          {selectedAttempt && selectedAttempt.incidents.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              No automated events recorded for this attempt.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {selectedAttempt?.incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-lg border border-border-default bg-surface px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Badge variant="outline">{inc.type}</Badge>
                    <span className="text-ink">
                      {inc.detail ?? "Session event recorded"}
                    </span>
                  </div>
                  <span className="font-mono text-ink-muted tabular-nums">
                    {new Date(inc.at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
