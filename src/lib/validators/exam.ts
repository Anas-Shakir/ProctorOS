import { z } from "zod";

const dateField = z.coerce.date({
  error: "Enter a valid date and time",
});

export const examBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Exam title must be at least 3 characters")
    .max(160, "Exam title is too long"),
  instructions: z
    .string()
    .trim()
    .max(4000, "Instructions are too long")
    .default(""),
  startTime: dateField,
  endTime: dateField,
  durationMin: z.coerce
    .number()
    .int("Duration must be a whole number of minutes")
    .min(1, "Duration must be at least 1 minute")
    .max(600, "Duration cannot exceed 600 minutes"),
  totalMarks: z.coerce
    .number()
    .positive("Total marks must be greater than 0")
    .max(10000, "Total marks is too high"),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  negativeMarking: z.coerce
    .number()
    .min(0, "Negative marking cannot be negative")
    .max(100, "Negative marking is too high")
    .default(0),
});

export const createExamSchema = examBaseSchema.superRefine((data, ctx) => {
  if (data.endTime.getTime() <= data.startTime.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "End time must be after start time",
    });
    return;
  }

  const windowMin = Math.floor(
    (data.endTime.getTime() - data.startTime.getTime()) / 60000,
  );
  if (data.durationMin > windowMin) {
    ctx.addIssue({
      code: "custom",
      path: ["durationMin"],
      message: `Duration (${data.durationMin} min) cannot exceed the exam window (${windowMin} min)`,
    });
  }
});

export const updateExamSchema = examBaseSchema.partial().superRefine((data, ctx) => {
  if (data.startTime && data.endTime) {
    if (data.endTime.getTime() <= data.startTime.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time",
      });
      return;
    }
    if (data.durationMin !== undefined) {
      const windowMin = Math.floor(
        (data.endTime.getTime() - data.startTime.getTime()) / 60000,
      );
      if (data.durationMin > windowMin) {
        ctx.addIssue({
          code: "custom",
          path: ["durationMin"],
          message: `Duration (${data.durationMin} min) cannot exceed the exam window (${windowMin} min)`,
        });
      }
    }
  }
});

export const examQuestionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    questionIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    action: z.literal("remove"),
    examQuestionId: z.string().min(1),
  }),
  z.object({
    action: z.literal("reorder"),
    orderedIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    action: z.literal("setMarks"),
    examQuestionId: z.string().min(1),
    marksOverride: z.coerce.number().positive("Marks must be greater than 0").nullable(),
  }),
]);
