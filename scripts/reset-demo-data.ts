/**
 * Reset & reseed ProctorOS to the clean judge demo baseline:
 *   - 1 Admin, 2 Examiners, 15 Candidates
 *   - 30 Questions across 4 topics & 3 difficulties (with 1 deliberately ambiguous question)
 *   - 1 COMPLETED exam (15 graded attempts, analytics spread, ReportTokens, open dispute)
 *   - 1 ONGOING exam (2 active attempts, 13 open for fresh start)
 *   - 1 PUBLISHED upcoming exam
 *   - Valid SHA-256 hash-chained AuditLog verified at completion
 *
 * Usage:
 *   npm run db:reset-demo
 */
try {
  process.loadEnvFile();
} catch {
  // Environment variables may already be injected by shell/CI.
}

import assert from "node:assert/strict";
import { verifyAuditChain } from "../src/lib/audit";
import { db } from "../src/lib/db";
import { seedDemoData } from "../src/lib/demo-seed";

async function main() {
  console.log("[reset-demo-data] Resetting demo dataset...");
  const result = await seedDemoData(db, { reset: true });
  const audit = await verifyAuditChain();
  assert.equal(audit.ok, true, `Audit chain verification failed: ${JSON.stringify(audit)}`);

  console.log(
    `[reset-demo-data] Done: ${result.usersCount} users, ${result.questionsCount} questions, ${result.examsCount} exams. Audit chain verified (${audit.totalChecked} rows).`,
  );
}

main()
  .catch((err) => {
    console.error("[reset-demo-data] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
