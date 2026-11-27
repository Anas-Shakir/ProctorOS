import test from "node:test";
import assert from "node:assert/strict";
import { gradeQuestion, type QuestionSnapshotInput } from "../src/lib/grading";

const multiPartialSnapshot: QuestionSnapshotInput = {
  sourceQuestionId: "q-multi-1",
  typeSnapshot: "MULTI",
  marksSnapshot: 4,
  multiModeSnapshot: "PARTIAL_PENALTY",
  optionsSnapshot: [
    { id: "opt-1", text: "Correct A", isCorrect: true },
    { id: "opt-2", text: "Correct B", isCorrect: true },
    { id: "opt-3", text: "Wrong C", isCorrect: false },
    { id: "opt-4", text: "Wrong D", isCorrect: false },
  ],
};

test("MULTI partial: all correct options selected awards full marks", () => {
  const res = gradeQuestion(
    multiPartialSnapshot,
    { selectedOptionIds: ["opt-1", "opt-2"], writtenText: null },
    [],
    0,
  );
  assert.equal(res.pending, false);
  assert.equal(res.score, 4);
});

test("MULTI partial: one of two correct selected awards half marks", () => {
  const res = gradeQuestion(
    multiPartialSnapshot,
    { selectedOptionIds: ["opt-1"], writtenText: null },
    [],
    0,
  );
  assert.equal(res.score, 2);
});

test("MULTI partial: one wrong option only clamps to zero (never negative)", () => {
  const res = gradeQuestion(
    multiPartialSnapshot,
    { selectedOptionIds: ["opt-3"], writtenText: null },
    [],
    0,
  );
  assert.equal(res.score, 0);
});

test("MULTI partial: no options selected awards zero", () => {
  const res = gradeQuestion(
    multiPartialSnapshot,
    { selectedOptionIds: [], writtenText: null },
    [],
    0,
  );
  assert.equal(res.score, 0);
});

test("MULTI partial: both correct plus one wrong applies penalty formula", () => {
  // (2 correct - 1 wrong) / 2 * 4 = 2
  const res = gradeQuestion(
    multiPartialSnapshot,
    { selectedOptionIds: ["opt-1", "opt-2", "opt-3"], writtenText: null },
    [],
    0,
  );
  assert.equal(res.score, 2);
});

test("MULTI all-or-nothing: requires exact match", () => {
  const snapshot: QuestionSnapshotInput = {
    ...multiPartialSnapshot,
    multiModeSnapshot: "ALL_OR_NOTHING",
  };
  const partial = gradeQuestion(
    snapshot,
    { selectedOptionIds: ["opt-1"], writtenText: null },
    [],
  );
  assert.equal(partial.score, 0);

  const exact = gradeQuestion(
    snapshot,
    { selectedOptionIds: ["opt-1", "opt-2"], writtenText: null },
    [],
  );
  assert.equal(exact.score, 4);
});

test("SINGLE choice: supports correct, wrong with negative marking, and unanswered", () => {
  const snapshot: QuestionSnapshotInput = {
    sourceQuestionId: "q-single-1",
    typeSnapshot: "SINGLE",
    marksSnapshot: 3,
    multiModeSnapshot: "PARTIAL_PENALTY",
    optionsSnapshot: [
      { id: "a", text: "A", isCorrect: false },
      { id: "b", text: "B", isCorrect: true },
    ],
  };

  assert.equal(
    gradeQuestion(snapshot, { selectedOptionIds: ["b"], writtenText: null }, [], 0.5).score,
    3,
  );
  assert.equal(
    gradeQuestion(snapshot, { selectedOptionIds: ["a"], writtenText: null }, [], 0.5).score,
    -0.5,
  );
  assert.equal(
    gradeQuestion(snapshot, { selectedOptionIds: [], writtenText: null }, [], 0.5).score,
    0,
  );
});

test("WRITTEN remains pending until manually graded unless voided by ruling", () => {
  const snapshot: QuestionSnapshotInput = {
    sourceQuestionId: "q-written-1",
    typeSnapshot: "WRITTEN",
    marksSnapshot: 5,
    multiModeSnapshot: "PARTIAL_PENALTY",
    optionsSnapshot: null,
  };

  const pending = gradeQuestion(
    snapshot,
    { selectedOptionIds: [], writtenText: "My essay" },
    [],
  );
  assert.equal(pending.pending, true);
  assert.equal(pending.score, null);

  const voided = gradeQuestion(
    snapshot,
    { selectedOptionIds: [], writtenText: "" },
    [
      {
        id: "r-1",
        sourceQuestionId: "q-written-1",
        type: "VOID_QUESTION",
        detail: {},
      },
    ],
  );
  assert.equal(voided.pending, false);
  assert.equal(voided.score, 5);
});

test("ACCEPT_ALTERNATE ruling awards marks for alternate option without editing snapshot", () => {
  const snapshot: QuestionSnapshotInput = {
    sourceQuestionId: "q-alt-1",
    typeSnapshot: "SINGLE",
    marksSnapshot: 2,
    multiModeSnapshot: "PARTIAL_PENALTY",
    optionsSnapshot: [
      { id: "a", text: "Option A", isCorrect: true },
      { id: "b", text: "Option B", isCorrect: false },
    ],
  };

  const res = gradeQuestion(
    snapshot,
    { selectedOptionIds: ["b"], writtenText: null },
    [
      {
        id: "r-alt",
        sourceQuestionId: "q-alt-1",
        type: "ACCEPT_ALTERNATE",
        detail: { acceptedOptionIds: ["b"] },
      },
    ],
  );
  assert.equal(res.score, 2);
  assert.equal(res.rulingId, "r-alt");
});
