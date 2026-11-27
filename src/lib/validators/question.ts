import { z } from "zod";

export const DifficultyValues = ["EASY", "MEDIUM", "HARD"] as const;
export type AppDifficulty = (typeof DifficultyValues)[number];

export const QuestionTypeValues = ["SINGLE", "MULTI", "WRITTEN"] as const;
export type AppQuestionType = (typeof QuestionTypeValues)[number];

export const MultiModeValues = ["PARTIAL_PENALTY", "ALL_OR_NOTHING"] as const;
export type AppMultiMode = (typeof MultiModeValues)[number];

export const questionOptionSchema = z.object({
  text: z.string().trim().min(1, "Option text cannot be empty").max(500),
  isCorrect: z.boolean(),
});

export const questionInputSchema = z
  .object({
    topic: z
      .string()
      .trim()
      .min(1, "Topic is required")
      .max(80, "Topic is too long"),
    difficulty: z.enum(DifficultyValues, {
      error: "Difficulty must be EASY, MEDIUM, or HARD",
    }),
    type: z.enum(QuestionTypeValues, {
      error: "Type must be SINGLE, MULTI, or WRITTEN",
    }),
    text: z
      .string()
      .trim()
      .min(3, "Question text must be at least 3 characters")
      .max(4000, "Question text is too long"),
    marks: z.coerce
      .number({ error: "Marks must be a number" })
      .positive("Marks must be greater than 0")
      .max(1000, "Marks cannot exceed 1000"),
    multiMode: z.enum(MultiModeValues).default("PARTIAL_PENALTY"),
    options: z.array(questionOptionSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === "WRITTEN") {
      if (data.options.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "WRITTEN questions cannot have choice options",
        });
      }
      return;
    }

    if (data.options.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Choice questions require at least 2 options",
      });
      return;
    }

    const correctCount = data.options.filter((o) => o.isCorrect).length;
    if (data.type === "SINGLE" && correctCount !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "SINGLE choice questions must have exactly 1 correct option",
      });
    }
    if (data.type === "MULTI" && correctCount < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "MULTI select questions must have at least 1 correct option",
      });
    }
  });

export type QuestionInput = z.infer<typeof questionInputSchema>;
