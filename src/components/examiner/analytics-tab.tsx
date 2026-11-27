"use client";

import * as React from "react";
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import type { ExamAnalyticsPayload } from "@/lib/analytics";

export function AnalyticsTab({
  examId,
  initialAnalytics,
}: {
  examId: string;
  initialAnalytics: ExamAnalyticsPayload;
}) {
  const [data, setData] =
    React.useState<ExamAnalyticsPayload>(initialAnalytics);
  const [refreshing, setRefreshing] = React.useState(false);
  const [chartReady, setChartReady] = React.useState(false);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setChartReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/examiner/exams/${examId}/analytics`, {
        cache: "no-store",
      });
      if (res.ok) {
        const next = (await res.json()) as ExamAnalyticsPayload;
        setData(next);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const { summary, histogram, questions, exam } = data;
  const suspectCount = questions.filter((q) => q.isSuspect).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border-default bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <BarChart3 className="h-4 w-4 text-pine" aria-hidden="true" />
          <span className="text-sm font-medium text-ink">
            Computed from {summary.attemptCount} finalized real attempt(s)
          </span>
          {suspectCount > 0 && (
            <Badge
              variant="terracotta"
              icon={<AlertTriangle className="h-3 w-3" aria-hidden="true" />}
            >
              {suspectCount} suspect question{suspectCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          loading={refreshing}
          loadingLabel="Refreshing..."
          onClick={() => void handleRefresh()}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Refresh Analytics</span>
        </Button>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Score</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {summary.averageScore} / {exam.totalMarks}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ink-muted">
              Mean across finalized attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Median Score</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {summary.medianScore} / {exam.totalMarks}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ink-muted">
              50th percentile score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Range (High / Low)</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {summary.highestScore} / {summary.lowestScore}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ink-muted">
              Highest and lowest observed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pass Rate &amp; Avg Time</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {summary.passRate}% · {summary.averageTimeMinutes}m
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ink-muted">
              Pass threshold: 50% of total marks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Score Distribution Histogram */}
      <Card>
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
          <CardDescription>
            Candidate attempts grouped by percentage band (sandbox attempts
            excluded).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            {chartReady && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={histogram}
                  margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E5DF"
                  />
                  <XAxis
                    dataKey="range"
                    tick={{ fill: "#5C665F", fontSize: 12 }}
                    axisLine={{ stroke: "#E5E5DF" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#5C665F", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#F2F0E8" }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E5DF",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#1F2922",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Candidates"
                    fill="#3A5A40"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Analytics Table */}
      <div className="space-y-3">
        <div>
          <h2 className="font-serif text-xl font-medium text-ink">
            Question &amp; Distractor Analytics
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Questions under 15% correct or with a distractor chosen more than
            the key are flagged for review.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Difficulty (Stated → Observed)</TableHead>
              <TableHead>Correct %</TableHead>
              <TableHead>Skip Rate</TableHead>
              <TableHead>Top Wrong Distractor</TableHead>
              <TableHead>Signal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length === 0 ? (
              <TableEmpty
                colSpan={6}
                title="No finalized question data yet"
                description="Analytics populate automatically once candidates submit."
              />
            ) : (
              questions.map((q) => (
                <TableRow key={q.sourceQuestionId}>
                  <TableCell className="max-w-sm">
                    <p className="font-medium text-ink line-clamp-2">
                      {q.text}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-ink-muted">
                      {q.topic} · {q.type} · {q.attemptsSeen} seen
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <Badge variant="outline">{q.statedDifficulty}</Badge>
                      <span className="text-ink-muted">→</span>
                      <Badge
                        variant={
                          q.observedDifficulty === "HARD"
                            ? "terracotta"
                            : q.observedDifficulty === "EASY"
                              ? "pine"
                              : "neutral"
                        }
                      >
                        {q.observedDifficulty}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium tabular-nums">
                    {q.correctPercent}%
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink-muted tabular-nums">
                    {q.skipRate}%
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-ink-muted">
                    {q.topWrongDistractor ? (
                      <span>
                        <strong className="text-ink">
                          {q.topWrongDistractor.text}
                        </strong>{" "}
                        ({q.topWrongDistractor.count}× ·{" "}
                        {q.topWrongDistractor.percent}%)
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {q.isSuspect ? (
                      <div className="space-y-1">
                        <Badge
                          variant="terracotta"
                          icon={
                            <AlertTriangle
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          }
                        >
                          Suspect
                        </Badge>
                        <p className="text-[11px] text-terracotta leading-snug">
                          {q.suspectReasons[0]}
                        </p>
                      </div>
                    ) : (
                      <Badge variant="pine">Healthy</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
