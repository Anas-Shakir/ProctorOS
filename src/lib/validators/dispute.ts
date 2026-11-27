import { z } from "zod";

export const createDisputeSchema = z.object({
  attemptQuestionId: z.string().min(1, "Question reference is required"),
  category: z.enum(["GRADING_ERROR", "AMBIGUOUS", "TECHNICAL"]),
  message: z
    .string()
    .trim()
    .min(5, "Please explain the issue in at least 5 characters")
    .max(2000, "Dispute message is too long"),
});

export const resolveDisputeSchema = z
  .object({
    decision: z.enum(["UNDER_REVIEW", "REJECT", "UPHOLD"]),
    resolution: z
      .string()
      .trim()
      .max(1500, "Resolution note is too long")
      .optional(),
    newScore: z.coerce
      .number({ error: "Score must be a valid number" })
      .min(0, "Score cannot be negative")
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (
      (val.decision === "REJECT" || val.decision === "UPHOLD") &&
      (!val.resolution || val.resolution.trim().length < 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a resolution reason (at least 3 characters)",
        path: ["resolution"],
      });
    }
    if (val.decision === "UPHOLD" && val.newScore === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide the updated score when upholding a dispute",
        path: ["newScore"],
      });
    }
  });

export const createRulingSchema = z
  .object({
    sourceQuestionId: z.string().min(1, "Source question ID is required"),
    type: z.enum(["ACCEPT_ALTERNATE", "VOID_QUESTION"]),
    acceptedOptionIds: z.array(z.string().min(1)).default([]),
    reason: z
      .string()
      .trim()
      .min(4, "Provide a clear reason for this ruling (at least 4 characters)")
      .max(1500, "Reason is too long"),
    disputeId: z.string().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.type === "ACCEPT_ALTERNATE" &&
      val.acceptedOptionIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one alternate option to accept",
        path: ["acceptedOptionIds"],
      });
    }
  });
