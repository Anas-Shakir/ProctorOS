"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Lock,
  Play,
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
  SegmentedTabs,
  useToast,
  type BadgeVariant,
} from "@/components/ui";
import type {
  CandidateAccessStatus,
  CandidateExamCard,
} from "@/lib/candidate";

const accessBadgeMap: Record<
  CandidateAccessStatus,
  { variant: BadgeVariant; label: string; icon: React.ReactNode }
> = {
  OPEN: {
    variant: "pine",
    label: "Open",
    icon: <Play className="h-3 w-3" aria-hidden="true" />,
  },
  IN_PROGRESS: {
    variant: "pine",
    label: "In Progress",
    icon: <Clock className="h-3 w-3" aria-hidden="true" />,
  },
  NOT_OPEN_YET: {
    variant: "outline",
    label: "Not open yet",
    icon: <CalendarClock className="h-3 w-3" aria-hidden="true" />,
  },
  SUBMITTED: {
    variant: "pine",
    label: "Submitted",
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
  },
  CLOSED: {
    variant: "terracotta",
    label: "Closed",
    icon: <Lock className="h-3 w-3" aria-hidden="true" />,
  },
};

function formatWindow(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${fmt(startIso)} → ${fmt(endIso)}`;
}

export function CandidateDashboard({
  initialExams,
}: {
  initialExams: CandidateExamCard[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [exams, setExams] = React.useState<CandidateExamCard[]>(initialExams);
  const [activeTab, setActiveTab] = React.useState("AVAILABLE");
  const [startingExamId, setStartingExamId] = React.useState<string | null>(
    null,
  );

  const grouped = React.useMemo(() => {
    const available = exams.filter(
      (e) => e.accessStatus === "OPEN" || e.accessStatus === "IN_PROGRESS",
    );
    const upcoming = exams.filter((e) => e.accessStatus === "NOT_OPEN_YET");
    const completed = exams.filter(
      (e) => e.accessStatus === "SUBMITTED" || e.accessStatus === "CLOSED",
    );
    return { available, upcoming, completed };
  }, [exams]);

  const tabs = [
    { id: "AVAILABLE", label: "Available now", count: grouped.available.length },
    { id: "UPCOMING", label: "Upcoming", count: grouped.upcoming.length },
    { id: "COMPLETED", label: "Completed", count: grouped.completed.length },
  ];

  const currentList =
    activeTab === "AVAILABLE"
      ? grouped.available
      : activeTab === "UPCOMING"
        ? grouped.upcoming
        : grouped.completed;

  const handleStartExam = async (examId: string, title: string) => {
    setStartingExamId(examId);
    try {
      const res = await fetch("/api/attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Entry refused", data.error ?? "Cannot start this exam");
        return;
      }

      setExams((prev) =>
        prev.map((item) =>
          item.examId === examId
            ? {
                ...item,
                accessStatus: "IN_PROGRESS",
                attemptId: data.attempt.id,
                attemptStatus: data.attempt.status,
                deadlineAt: data.attempt.deadlineAt,
              }
            : item,
        ),
      );

      toast.success(
        `Entering ${title}`,
        "Loading your frozen assessment paper...",
      );
      router.push(`/candidate/attempts/${data.attempt.id}`);
    } catch {
      toast.warning("Network error", "Could not start exam attempt.");
      setStartingExamId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
          Candidate Portal
        </p>
        <h1 className="mt-2 font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
          Scheduled Assessments
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Only published exams you are enrolled in are listed here. Entry windows
          are enforced by server time.
        </p>
      </div>

      <SegmentedTabs
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Candidate exam categories"
      />

      {currentList.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === "AVAILABLE"
                ? "No exams open right now"
                : activeTab === "UPCOMING"
                  ? "No upcoming exams"
                  : "No completed exams yet"}
            </CardTitle>
            <CardDescription>
              Check the other tabs above or return when your examiner opens an
              assessment window.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentList.map((exam) => {
            const badge = accessBadgeMap[exam.accessStatus];
            const canEnter =
              exam.accessStatus === "OPEN" ||
              exam.accessStatus === "IN_PROGRESS";

            return (
              <Card key={exam.examId} interactive>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={badge.variant} icon={badge.icon}>
                      {badge.label}
                    </Badge>
                    <span className="font-mono text-xs text-ink-muted tabular-nums">
                      {exam.durationMin} min · {exam.totalMarks} marks
                    </span>
                  </div>
                  <CardTitle className="mt-4 text-lg">{exam.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {exam.instructions || "No special instructions provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <p className="font-mono text-xs text-ink-muted tabular-nums">
                    Window: {formatWindow(exam.startTime, exam.endTime)}
                  </p>
                </CardContent>

                <CardFooter>
                  <span className="text-xs text-ink-muted">
                    {exam.accessStatus === "NOT_OPEN_YET"
                      ? "Opens at scheduled start time"
                      : exam.accessStatus === "CLOSED"
                        ? "Window closed"
                        : exam.accessStatus === "SUBMITTED"
                          ? "Attempt recorded"
                          : "Ready to enter"}
                  </span>

                  {canEnter && (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={startingExamId === exam.examId}
                      loadingLabel="Starting..."
                      onClick={() => handleStartExam(exam.examId, exam.title)}
                    >
                      <span>
                        {exam.accessStatus === "IN_PROGRESS"
                          ? "Resume Exam"
                          : "Start Exam"}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
