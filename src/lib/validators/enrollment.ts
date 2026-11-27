import { z } from "zod";

export const candidateImportRowSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address").toLowerCase(),
});

export type CandidateImportRow = z.infer<typeof candidateImportRowSchema>;

export const enrollCandidatesSchema = z.object({
  candidateIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one candidate"),
});

export const removeEnrollmentSchema = z.object({
  candidateId: z.string().min(1, "Candidate ID is required"),
});

export const startAttemptSchema = z.object({
  examId: z.string().min(1, "Exam ID is required"),
});
