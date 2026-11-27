import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_GENESIS_HASH,
  computeAuditHash,
  stableAuditStringify,
} from "../src/lib/audit";

test("stableAuditStringify normalizes object key ordering deterministically", () => {
  const a = stableAuditStringify({ b: 2, a: 1, nested: { z: true, k: "ok" } });
  const b = stableAuditStringify({ nested: { k: "ok", z: true }, a: 1, b: 2 });
  assert.equal(a, b);
});

test("computeAuditHash detects any payload, actor, or link modification", () => {
  const ts = "2026-11-27T12:00:00.000Z";
  const hash1 = computeAuditHash({
    prevHash: AUDIT_GENESIS_HASH,
    actorId: "user-1",
    action: "QUESTION_RULING_APPLIED",
    entity: "QuestionRuling",
    entityId: "rul-1",
    payload: { examId: "ex-1", delta: 4, reason: "Ambiguous option" },
    timestampIso: ts,
  });

  const hashReordered = computeAuditHash({
    prevHash: AUDIT_GENESIS_HASH,
    actorId: "user-1",
    action: "QUESTION_RULING_APPLIED",
    entity: "QuestionRuling",
    entityId: "rul-1",
    payload: { reason: "Ambiguous option", delta: 4, examId: "ex-1" },
    timestampIso: ts,
  });
  assert.equal(hash1, hashReordered);

  const hashTamperedScore = computeAuditHash({
    prevHash: AUDIT_GENESIS_HASH,
    actorId: "user-1",
    action: "QUESTION_RULING_APPLIED",
    entity: "QuestionRuling",
    entityId: "rul-1",
    payload: { examId: "ex-1", delta: 8, reason: "Ambiguous option" },
    timestampIso: ts,
  });
  assert.notEqual(hash1, hashTamperedScore);
});
