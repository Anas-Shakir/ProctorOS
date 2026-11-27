import { z } from "zod";

export const manualGradeSchema = z.object({
  attemptQuestionId: z.string().min(1, "Question ID is required"),
  score: z.coerce
    .number({ error: "Score must be a valid number" })
    .min(0, "Score cannot be negative"),
  reason: z.string().trim().max(1000, "Feedback is too long").optional(),
});

export const publishResultsSchema = z.object({
  override: z.boolean().default(false),
});
