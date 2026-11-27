"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Flag, ShieldAlert } from "lucide-react";
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
  PageShell,
  SegmentedTabs,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  useToast,
  type NetworkSyncState,
} from "@/components/ui";

const tabs = [
  { id: "controls", label: "Controls & Motion" },
  { id: "forms", label: "Forms & States" },
  { id: "table", label: "Results Table", count: 3 },
];

const syncCycle: NetworkSyncState[] = [
  "saved",
  "saving",
  "offline",
  "reconnecting",
];

const sampleAttempts = [
  {
    id: "ATT-104",
    candidate: "Amina Tariq",
    status: "GRADED",
    reviewFlag: false,
    score: "46 / 50",
    time: "38m 12s",
  },
  {
    id: "ATT-105",
    candidate: "Bilal Mahmood",
    status: "REVIEW",
    reviewFlag: true,
    score: "41 / 50",
    time: "44m 05s",
  },
  {
    id: "ATT-106",
    candidate: "Sara Siddiqui",
    status: "GRADED",
    reviewFlag: false,
    score: "49 / 50",
    time: "34m 50s",
  },
];

export default function DesignPreviewPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = React.useState("controls");
  const [syncIndex, setSyncIndex] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [examTitle, setExamTitle] = React.useState("CS-301 Midterm Assessment");
  const [notes, setNotes] = React.useState("");

  const currentSync = syncCycle[syncIndex];

  const handleSimulatedSave = () => {
    setIsSaving(true);
    window.setTimeout(() => {
      setIsSaving(false);
      toast.success(
        "Snapshot preferences saved",
        "All changes synced cleanly with 0 conflicts.",
      );
    }, 800);
  };

  const handleCycleSync = () => {
    const next = (syncIndex + 1) % syncCycle.length;
    setSyncIndex(next);
    if (syncCycle[next] === "offline") {
      toast.warning(
        "Connection interrupted",
        "Answers remain queued locally until you reconnect.",
      );
    }
  };

  return (
    <PageShell
      headerRight={
        <div className="flex items-center gap-3">
          <StatusPill state={currentSync} />
          <Link
            href="/"
            className="pressable focus-ring inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border-default bg-surface text-sm font-medium text-ink hover:border-border-strong"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </Link>
        </div>
      }
    >
      {/* Header block with generous spacing */}
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
          ProctorOS Design System
        </p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-medium text-ink tracking-[-0.02em]">
          Warm Paper &amp; Botanical Pine
        </h1>
        <p className="mt-3 text-sm sm:text-base text-ink-muted leading-relaxed">
          Interactive verification of our 6 base components, flat color tokens,
          tactile press physics, and GPU-composited transitions.
        </p>
      </div>

      {/* Segmented Tabs with Emil Kowalski clip-path transition */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <SegmentedTabs
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Design preview sections"
        />

        <Button variant="secondary" size="sm" onClick={handleCycleSync}>
          Cycle Network State
        </Button>
      </div>

      <div className="mt-8">
        {activeTab === "controls" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tactile Actions &amp; Blur Crossfade</CardTitle>
                <CardDescription>
                  Buttons compress subtly to scale(0.97) on press and crossfade
                  cleanly into loading states.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  loading={isSaving}
                  loadingLabel="Publishing..."
                  onClick={handleSimulatedSave}
                >
                  Publish Exam
                </Button>
                <Button variant="secondary" onClick={() => setModalOpen(true)}>
                  Open Review Modal
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    toast.warning(
                      "1 question marked for review",
                      "Terracotta alerts draw attention without harsh neon.",
                    )
                  }
                >
                  Flag Urgent
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    toast.info(
                      "Draft autosaved",
                      "Last synced a few seconds ago.",
                    )
                  }
                >
                  Silent Toast
                </Button>
              </CardContent>
              <CardFooter>
                <span className="text-xs text-ink-muted">
                  150ms cubic-bezier(0.23, 1, 0.32, 1)
                </span>
                <span className="font-mono text-xs text-ink">scale(0.97)</span>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Semantic Status Badges</CardTitle>
                <CardDescription>
                  Every state pairs flat tinted surfaces with an explicit icon
                  and label—never color alone.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="pine"
                  icon={
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                >
                  Published · Ongoing
                </Badge>
                <Badge
                  variant="terracotta"
                  icon={<Flag className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Marked for Review
                </Badge>
                <Badge
                  variant="terracotta"
                  icon={
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                >
                  00:54 Remaining
                </Badge>
                <Badge variant="neutral">Draft</Badge>
                <Badge variant="outline">Sandbox Preview</Badge>
              </CardContent>
              <CardFooter>
                <span className="text-xs text-ink-muted">
                  Zero gradients · 1px crisp hairlines
                </span>
                <span className="font-mono text-xs text-ink">#E5E5DF</span>
              </CardFooter>
            </Card>
          </div>
        )}

        {activeTab === "forms" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Exam Configuration Inputs</CardTitle>
              <CardDescription>
                Pure White inputs with #E5E5DF borders and focused Botanical
                Pine outlines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Input
                label="Exam Title"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                hint="Displayed on candidate dashboards and verifiable PDF reports."
              />
              <Input
                label="Duration (Minutes)"
                type="number"
                defaultValue="45"
                error={
                  examTitle.trim().length < 3
                    ? "Enter a descriptive exam title first."
                    : undefined
                }
              />
              <Textarea
                label="Candidate Instructions"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="No external references permitted. Scratchpad notes are saved automatically."
              />
            </CardContent>
            <CardFooter>
              <span className="text-xs text-ink-muted">
                Shared Zod validation ready
              </span>
              <Button variant="primary" onClick={handleSimulatedSave}>
                Save Draft
              </Button>
            </CardFooter>
          </Card>
        )}

        {activeTab === "table" && (
          <div className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleAttempts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs text-ink-muted tabular-nums">
                      {row.id}
                    </TableCell>
                    <TableCell className="font-medium">{row.candidate}</TableCell>
                    <TableCell>
                      {row.reviewFlag ? (
                        <Badge
                          variant="terracotta"
                          icon={
                            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                          }
                        >
                          Dispute Open
                        </Badge>
                      ) : (
                        <Badge
                          variant="pine"
                          icon={
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          }
                        >
                          Graded
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-muted tabular-nums">
                      {row.time}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium tabular-nums">
                      {row.score}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empty State Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableEmpty
                  colSpan={1}
                  title="No sandbox attempts recorded"
                  description="Launch Preview as Candidate to test the exam flow with zero effect on analytics."
                />
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm Exam Submission"
        description="Once submitted, your frozen snapshot is locked for grading. Unanswered questions receive zero marks."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Return to Exam
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                toast.success(
                  "Attempt submitted",
                  "Your answers have been recorded cleanly.",
                );
              }}
            >
              Confirm Submit
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-border-default bg-canvas p-4 space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Answered questions</span>
            <span className="font-mono font-medium tabular-nums text-ink">
              18 / 20
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Marked for review</span>
            <Badge
              variant="terracotta"
              icon={<Flag className="h-3 w-3" aria-hidden="true" />}
            >
              2 flagged
            </Badge>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
