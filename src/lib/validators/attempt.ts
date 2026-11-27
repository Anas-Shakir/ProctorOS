import { z } from "zod";

export const IncidentTypeValues = [
  "TAB_HIDDEN",
  "BLUR",
  "OFFLINE",
  "PASTE",
  "FULLSCREEN_EXIT",
] as const;

export const saveAnswerSchema = z.object({
  attemptQuestionId: z.string().min(1, "Question ID is required"),
  selectedOptionIds: z.array(z.string().min(1)).default([]),
  writtenText: z.string().max(20000).nullable().optional(),
  markedForReview: z.boolean().default(false),
  revision: z
    .number()
    .int("Revision must be an integer")
    .min(1, "Revision must be >= 1"),
});

export const saveScratchpadSchema = z.object({
  content: z.string().max(50000, "Scratchpad content is too large"),
});

export const recordIncidentSchema = z.object({
  type: z.enum(IncidentTypeValues),
  detail: z.string().max(500).optional(),
});
