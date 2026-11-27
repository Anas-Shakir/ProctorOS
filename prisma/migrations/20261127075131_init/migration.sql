-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EXAMINER', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE', 'MULTI', 'WRITTEN');

-- CreateEnum
CREATE TYPE "MultiMode" AS ENUM ('PARTIAL_PENALTY', 'ALL_OR_NOTHING');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('TAB_HIDDEN', 'BLUR', 'OFFLINE', 'PASTE', 'FULLSCREEN_EXIT');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('GRADING_ERROR', 'AMBIGUOUS', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'UPHELD', 'REJECTED');

-- CreateEnum
CREATE TYPE "RulingType" AS ENUM ('ACCEPT_ALTERNATE', 'VOID_QUESTION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CANDIDATE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "negativeMarking" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resultsPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "multiMode" "MultiMode" NOT NULL DEFAULT 'PARTIAL_PENALTY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "marksOverride" DOUBLE PRECISION,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "realKey" TEXT,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "totalScore" DOUBLE PRECISION,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptQuestion" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sourceQuestionId" TEXT NOT NULL,
    "textSnapshot" TEXT NOT NULL,
    "typeSnapshot" "QuestionType" NOT NULL,
    "marksSnapshot" DOUBLE PRECISION NOT NULL,
    "optionsSnapshot" JSONB,
    "multiModeSnapshot" "MultiMode" NOT NULL DEFAULT 'PARTIAL_PENALTY',

    CONSTRAINT "AttemptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "attemptQuestionId" TEXT NOT NULL,
    "selectedOptionIds" JSONB NOT NULL DEFAULT '[]',
    "writtenText" TEXT,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "attemptQuestionId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "gradedBy" TEXT,
    "rulingId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prefs" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scratchpad" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scratchpad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "attemptQuestionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "category" "DisputeCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionRuling" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "sourceQuestionId" TEXT NOT NULL,
    "type" "RulingType" NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionRuling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditHead" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastHash" TEXT NOT NULL,
    "lastId" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportToken" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "scoreAtIssue" DOUBLE PRECISION NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,
    "supersededBy" TEXT,

    CONSTRAINT "ReportToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Exam_ownerId_idx" ON "Exam"("ownerId");

-- CreateIndex
CREATE INDEX "Exam_status_startTime_endTime_idx" ON "Exam"("status", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Question_ownerId_topic_difficulty_idx" ON "Question"("ownerId", "topic", "difficulty");

-- CreateIndex
CREATE INDEX "Option_questionId_idx" ON "Option"("questionId");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_order_idx" ON "ExamQuestion"("examId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_questionId_key" ON "ExamQuestion"("examId", "questionId");

-- CreateIndex
CREATE INDEX "Enrollment_candidateId_idx" ON "Enrollment"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_examId_candidateId_key" ON "Enrollment"("examId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_realKey_key" ON "Attempt"("realKey");

-- CreateIndex
CREATE INDEX "Attempt_examId_isSandbox_status_idx" ON "Attempt"("examId", "isSandbox", "status");

-- CreateIndex
CREATE INDEX "Attempt_candidateId_isSandbox_idx" ON "Attempt"("candidateId", "isSandbox");

-- CreateIndex
CREATE INDEX "AttemptQuestion_attemptId_idx" ON "AttemptQuestion"("attemptId");

-- CreateIndex
CREATE INDEX "AttemptQuestion_sourceQuestionId_idx" ON "AttemptQuestion"("sourceQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptQuestion_attemptId_position_key" ON "AttemptQuestion"("attemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptQuestionId_key" ON "Answer"("attemptQuestionId");

-- CreateIndex
CREATE INDEX "Grade_attemptQuestionId_createdAt_idx" ON "Grade"("attemptQuestionId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_attemptId_at_idx" ON "Incident"("attemptId", "at");

-- CreateIndex
CREATE INDEX "Announcement_examId_createdAt_idx" ON "Announcement"("examId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPref_userId_key" ON "UserPref"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Scratchpad_attemptId_key" ON "Scratchpad"("attemptId");

-- CreateIndex
CREATE INDEX "Dispute_attemptQuestionId_idx" ON "Dispute"("attemptQuestionId");

-- CreateIndex
CREATE INDEX "Dispute_candidateId_idx" ON "Dispute"("candidateId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "QuestionRuling_examId_sourceQuestionId_idx" ON "QuestionRuling"("examId", "sourceQuestionId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ReportToken_attemptId_idx" ON "ReportToken"("attemptId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "AttemptQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "AttemptQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_gradedBy_fkey" FOREIGN KEY ("gradedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_rulingId_fkey" FOREIGN KEY ("rulingId") REFERENCES "QuestionRuling"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPref" ADD CONSTRAINT "UserPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scratchpad" ADD CONSTRAINT "Scratchpad_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "AttemptQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRuling" ADD CONSTRAINT "QuestionRuling_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRuling" ADD CONSTRAINT "QuestionRuling_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportToken" ADD CONSTRAINT "ReportToken_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
