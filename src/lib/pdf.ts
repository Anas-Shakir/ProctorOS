import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getExamAnalytics } from "@/lib/analytics";
import { getExaminerGradingAndResults } from "@/lib/results";
import { issueOrGetReportToken } from "@/lib/verify";

const INK_PRIMARY = rgb(31 / 255, 41 / 255, 34 / 255); // #1F2922
const INK_MUTED = rgb(92 / 255, 102 / 255, 95 / 255); // #5C665F
const PINE = rgb(58 / 255, 90 / 255, 64 / 255); // #3A5A40
const BORDER = rgb(229 / 255, 229 / 255, 223 / 255); // #E5E5DF
const PAPER_TINT = rgb(250 / 255, 249 / 255, 244 / 255); // #FAF9F4

/** Sanitize strings to WinAnsi-safe ASCII/Latin-1 for pdf-lib StandardFonts. */
function safePdfText(input: string, maxLen = 120): string {
  const cleaned = input
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "-")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 3)}...`;
}

export async function buildCandidateResultPdf(params: {
  attemptId: string;
  baseUrl: string;
}): Promise<{ pdfBytes: Uint8Array; filename: string; tokenId: string }> {
  const { token, attempt, currentScore } = await issueOrGetReportToken(
    params.attemptId,
  );

  // Fetch topic metadata for per-section/topic breakdown
  const examQuestions = await db.examQuestion.findMany({
    where: { examId: attempt.exam.id },
    include: {
      question: { select: { id: true, topic: true } },
    },
  });
  const topicBySource = new Map(
    examQuestions.map((eq) => [eq.questionId, eq.question.topic]),
  );

  const sectionTotals = new Map<
    string,
    { count: number; scored: number; max: number }
  >();
  for (const aq of attempt.questions) {
    const topic = topicBySource.get(aq.sourceQuestionId) ?? "General";
    const prev = sectionTotals.get(topic) ?? { count: 0, scored: 0, max: 0 };
    const latestScore = aq.grades[0]?.score ?? 0;
    sectionTotals.set(topic, {
      count: prev.count + 1,
      scored: Math.round((prev.scored + latestScore) * 100) / 100,
      max: Math.round((prev.max + aq.marksSnapshot) * 100) / 100,
    });
  }

  const verifyUrl = `${params.baseUrl.replace(/\/+$/, "")}/verify/${token.id}`;
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    width: 180,
    margin: 1,
    color: {
      dark: "#1F2922",
      light: "#FFFFFF",
    },
  });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdfDoc.embedPng(qrBuffer);

  const margin = 48;
  const pageWidth = page.getWidth();
  let y = page.getHeight() - margin;

  // Header band
  page.drawRectangle({
    x: 0,
    y: page.getHeight() - 108,
    width: pageWidth,
    height: 108,
    color: PAPER_TINT,
  });
  page.drawLine({
    start: { x: 0, y: page.getHeight() - 108 },
    end: { x: pageWidth, y: page.getHeight() - 108 },
    thickness: 1,
    color: BORDER,
  });

  page.drawText("PROCTOROS OFFICIAL RESULT REPORT", {
    x: margin,
    y: y - 8,
    size: 10,
    font: fontBold,
    color: PINE,
  });
  page.drawText(safePdfText(attempt.exam.title, 70), {
    x: margin,
    y: y - 32,
    size: 18,
    font: fontBold,
    color: INK_PRIMARY,
  });
  page.drawText(
    `Issued: ${token.issuedAt.toISOString().slice(0, 10)}   |   Verification ID: ${token.id}`,
    {
      x: margin,
      y: y - 52,
      size: 9,
      font: fontRegular,
      color: INK_MUTED,
    },
  );

  y = page.getHeight() - 142;

  // Summary Box
  const pct =
    attempt.exam.totalMarks > 0
      ? Math.round((currentScore / attempt.exam.totalMarks) * 1000) / 10
      : 0;

  page.drawRectangle({
    x: margin,
    y: y - 86,
    width: pageWidth - margin * 2 - 120,
    height: 86,
    borderColor: BORDER,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  page.drawText("Candidate", {
    x: margin + 14,
    y: y - 20,
    size: 9,
    font: fontRegular,
    color: INK_MUTED,
  });
  page.drawText(safePdfText(attempt.candidate.name, 48), {
    x: margin + 14,
    y: y - 36,
    size: 13,
    font: fontBold,
    color: INK_PRIMARY,
  });

  page.drawText("Final Score", {
    x: margin + 14,
    y: y - 56,
    size: 9,
    font: fontRegular,
    color: INK_MUTED,
  });
  page.drawText(
    `${currentScore} / ${attempt.exam.totalMarks} (${pct}%)   [${attempt.status}]`,
    {
      x: margin + 14,
      y: y - 72,
      size: 12,
      font: fontBold,
      color: PINE,
    },
  );

  // Embedded QR Code on top right of summary row
  const qrSize = 86;
  page.drawImage(qrImage, {
    x: pageWidth - margin - qrSize,
    y: y - qrSize,
    width: qrSize,
    height: qrSize,
  });

  y -= 118;

  // Per-section / topic breakdown
  page.drawText("Per-Section Breakdown", {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: INK_PRIMARY,
  });
  y -= 16;

  page.drawRectangle({
    x: margin,
    y: y - 22,
    width: pageWidth - margin * 2,
    height: 22,
    color: PAPER_TINT,
    borderColor: BORDER,
    borderWidth: 1,
  });
  page.drawText("Topic / Section", {
    x: margin + 10,
    y: y - 15,
    size: 9,
    font: fontBold,
    color: INK_MUTED,
  });
  page.drawText("Questions", {
    x: margin + 270,
    y: y - 15,
    size: 9,
    font: fontBold,
    color: INK_MUTED,
  });
  page.drawText("Score", {
    x: margin + 390,
    y: y - 15,
    size: 9,
    font: fontBold,
    color: INK_MUTED,
  });
  y -= 22;

  for (const [topic, stats] of sectionTotals.entries()) {
    if (y < 120) break;
    page.drawRectangle({
      x: margin,
      y: y - 24,
      width: pageWidth - margin * 2,
      height: 24,
      borderColor: BORDER,
      borderWidth: 1,
    });
    page.drawText(safePdfText(topic, 40), {
      x: margin + 10,
      y: y - 16,
      size: 10,
      font: fontRegular,
      color: INK_PRIMARY,
    });
    page.drawText(String(stats.count), {
      x: margin + 270,
      y: y - 16,
      size: 10,
      font: fontRegular,
      color: INK_PRIMARY,
    });
    page.drawText(`${stats.scored} / ${stats.max}`, {
      x: margin + 390,
      y: y - 16,
      size: 10,
      font: fontBold,
      color: INK_PRIMARY,
    });
    y -= 24;
  }

  // Footer with verification URL
  page.drawLine({
    start: { x: margin, y: 74 },
    end: { x: pageWidth - margin, y: 74 },
    thickness: 1,
    color: BORDER,
  });
  page.drawText(
    "Scan the QR code or open the link below to verify report authenticity:",
    {
      x: margin,
      y: 56,
      size: 9,
      font: fontRegular,
      color: INK_MUTED,
    },
  );
  page.drawText(safePdfText(verifyUrl, 96), {
    x: margin,
    y: 42,
    size: 9,
    font: fontBold,
    color: PINE,
  });

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    filename: `proctoros-result-${attempt.id.slice(0, 8)}.pdf`,
    tokenId: token.id,
  };
}

export async function buildExamSummaryPdf(examId: string): Promise<{
  pdfBytes: Uint8Array;
  filename: string;
}> {
  const [analytics, grading] = await Promise.all([
    getExamAnalytics(examId),
    getExaminerGradingAndResults(examId),
  ]);

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const pageWidth = page.getWidth();
  let y = page.getHeight() - margin;

  page.drawText("PROCTOROS EXAM SUMMARY REPORT", {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: PINE,
  });
  y -= 24;
  page.drawText(safePdfText(analytics.exam.title, 70), {
    x: margin,
    y,
    size: 17,
    font: fontBold,
    color: INK_PRIMARY,
  });
  y -= 18;
  page.drawText(
    `Generated: ${new Date().toISOString().slice(0, 10)}   |   Finalized Real Attempts: ${analytics.summary.attemptCount}`,
    {
      x: margin,
      y,
      size: 9,
      font: fontRegular,
      color: INK_MUTED,
    },
  );
  y -= 28;

  const { summary } = analytics;
  page.drawRectangle({
    x: margin,
    y: y - 54,
    width: pageWidth - margin * 2,
    height: 54,
    color: PAPER_TINT,
    borderColor: BORDER,
    borderWidth: 1,
  });
  page.drawText(
    `Average: ${summary.averageScore}/${analytics.exam.totalMarks}   |   Median: ${summary.medianScore}   |   High: ${summary.highestScore}   |   Low: ${summary.lowestScore}`,
    {
      x: margin + 12,
      y: y - 22,
      size: 10,
      font: fontBold,
      color: INK_PRIMARY,
    },
  );
  page.drawText(
    `Pass Rate (>=50%): ${summary.passRate}%   |   Average Time: ${summary.averageTimeMinutes} min`,
    {
      x: margin + 12,
      y: y - 40,
      size: 9,
      font: fontRegular,
      color: INK_MUTED,
    },
  );
  y -= 78;

  page.drawText("Candidate Scores", {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: INK_PRIMARY,
  });
  y -= 16;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: margin,
      y: y - 22,
      width: pageWidth - margin * 2,
      height: 22,
      color: PAPER_TINT,
      borderColor: BORDER,
      borderWidth: 1,
    });
    page.drawText("Candidate", {
      x: margin + 8,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: INK_MUTED,
    });
    page.drawText("Status", {
      x: margin + 230,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: INK_MUTED,
    });
    page.drawText("Obj / Written", {
      x: margin + 335,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: INK_MUTED,
    });
    page.drawText("Total", {
      x: margin + 435,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: INK_MUTED,
    });
    y -= 22;
  };

  drawTableHeader();

  for (const row of grading.results) {
    if (y < 80) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
      drawTableHeader();
    }
    page.drawRectangle({
      x: margin,
      y: y - 22,
      width: pageWidth - margin * 2,
      height: 22,
      borderColor: BORDER,
      borderWidth: 1,
    });
    page.drawText(safePdfText(row.candidateName, 32), {
      x: margin + 8,
      y: y - 15,
      size: 9,
      font: fontRegular,
      color: INK_PRIMARY,
    });
    page.drawText(row.status, {
      x: margin + 230,
      y: y - 15,
      size: 8,
      font: fontRegular,
      color: INK_MUTED,
    });
    page.drawText(`${row.objectiveScore} / ${row.writtenScore}`, {
      x: margin + 335,
      y: y - 15,
      size: 9,
      font: fontRegular,
      color: INK_PRIMARY,
    });
    page.drawText(`${row.totalScore}/${analytics.exam.totalMarks}`, {
      x: margin + 435,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: PINE,
    });
    y -= 22;
  }

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    filename: `proctoros-summary-${examId.slice(0, 8)}.pdf`,
  };
}
