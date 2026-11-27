/**
 * ProctorOS Automated Integrity Check (Checkpoint 1)
 *
 * Pure HTTP regression suite runnable against localhost or production Vercel:
 *   npx tsx scripts/integrity-check.ts [BASE_URL]
 *
 * Verifies:
 *   1. Health endpoint & wrong-role / unauthenticated access blocks (401/403)
 *   2. Two simultaneous starts produce exactly one Attempt (unique realKey)
 *   3. Paper response contains zero correct-answer flags or password hashes
 *   4. Mid-attempt question edits never mutate active frozen snapshots
 *   5. Revision-ordered autosave ignores stale revisions
 *   6. Triple concurrent submit transitions once and returns consistent stored result
 *   7. Late save past deadlineAt + 3s grace is rejected (409) & auto-submitted
 */
import assert from "node:assert/strict";

const BASE_URL = (
  process.argv[2] ??
  process.env.INTEGRITY_BASE_URL ??
  "http://127.0.0.1:3000"
).replace(/\/+$/, "");

interface ApiResult {
  status: number;
  headers: Headers;
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
}

async function req(path: string, opts: RequestInit = {}): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    ...opts,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Non-JSON response
  }
  return { status: res.status, headers: res.headers, text, json };
}

async function login(email: string, password: string): Promise<string> {
  const res = await req("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `Login failed for ${email}: ${res.text}`);
  const raw = res.headers.get("set-cookie") ?? "";
  const cookie = raw.split(";")[0];
  assert.ok(cookie, `Missing session cookie for ${email}`);
  return cookie;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[integrity-check] Target: ${BASE_URL}`);

  // 1. Health & Unauthenticated / Wrong-role guards
  const health = await req("/api/health");
  assert.equal(health.status, 200, `/api/health failed: ${health.text}`);
  assert.equal(health.json?.ok, true);
  console.log("  ✓ /api/health OK");

  const unauthStart = await req("/api/attempts/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ examId: "nonexistent" }),
  });
  assert.equal(unauthStart.status, 401, "Unauthenticated start must be 401");

  const [ex1Cookie, ex2Cookie, cand1Cookie, cand2Cookie] = await Promise.all([
    login("examiner1@proctoros.local", "Examiner123!"),
    login("examiner2@proctoros.local", "Examiner123!"),
    login("candidate1@proctoros.local", "Candidate123!"),
    login("candidate2@proctoros.local", "Candidate123!"),
  ]);

  const candToExaminer = await req("/api/examiner/exams", {
    headers: { cookie: cand1Cookie },
  });
  assert.equal(candToExaminer.status, 403, "Candidate -> examiner API must be 403");

  const candToAdmin = await req("/api/admin/users", {
    headers: { cookie: cand1Cookie },
  });
  assert.equal(candToAdmin.status, 403, "Candidate -> admin API must be 403");
  console.log("  ✓ Wrong-role & unauthenticated guards enforced (401/403)");

  // 2. Create a fresh question & open exam via Examiner 1 API
  const tag = `IC-${Date.now()}`;
  const originalPrompt = `[${tag}] Which isolation level prevents phantom reads?`;
  const qRes = await req("/api/examiner/questions", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ex1Cookie },
    body: JSON.stringify({
      topic: "Integrity",
      difficulty: "MEDIUM",
      type: "SINGLE",
      text: originalPrompt,
      marks: 4,
      multiMode: "PARTIAL_PENALTY",
      options: [
        { text: "Read Committed", isCorrect: false },
        { text: "Serializable", isCorrect: true },
      ],
    }),
  });
  assert.equal(qRes.status, 201, `Create question failed: ${qRes.text}`);
  const questionId: string = qRes.json.question.id;

  const serverNowMs = new Date(health.json.serverNow).getTime();
  const examRes = await req("/api/examiner/exams", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ex1Cookie },
    body: JSON.stringify({
      title: `[${tag}] Concurrent & Snapshot Integrity`,
      instructions: "Automated integrity test",
      startTime: new Date(serverNowMs - 60_000).toISOString(),
      endTime: new Date(serverNowMs + 3600_000).toISOString(),
      durationMin: 30,
      totalMarks: 4,
      shuffleQuestions: false,
      shuffleOptions: false,
      negativeMarking: 0,
    }),
  });
  assert.equal(examRes.status, 201, `Create exam failed: ${examRes.text}`);
  const examId: string = examRes.json.exam.id;

  // Cross-examiner isolation check
  const crossExaminer = await req(`/api/examiner/exams/${examId}`, {
    headers: { cookie: ex2Cookie },
  });
  assert.equal(crossExaminer.status, 403, "Examiner 2 -> Examiner 1 exam must be 403");

  const addQ = await req(`/api/examiner/exams/${examId}/questions`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ex1Cookie },
    body: JSON.stringify({ action: "add", questionIds: [questionId] }),
  });
  assert.equal(addQ.status, 200);

  const pub = await req(`/api/examiner/exams/${examId}/publish`, {
    method: "POST",
    headers: { cookie: ex1Cookie },
  });
  assert.equal(pub.status, 200);

  // Enroll candidate1 only (candidate2 must get 403)
  const enrollCsv = await req(`/api/examiner/exams/${examId}/enrollments/import`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ex1Cookie },
    body: JSON.stringify({
      content: "name,email\nCandidate 01,candidate1@proctoros.local\n",
    }),
  });
  assert.equal(enrollCsv.status, 200);

  const nonEnrolledStart = await req("/api/attempts/start", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cand2Cookie },
    body: JSON.stringify({ examId }),
  });
  assert.equal(nonEnrolledStart.status, 403, "Non-enrolled start must be 403");

  // 3. Two simultaneous starts -> must return the exact same attempt ID
  const [startA, startB] = await Promise.all([
    req("/api/attempts/start", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cand1Cookie },
      body: JSON.stringify({ examId }),
    }),
    req("/api/attempts/start", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cand1Cookie },
      body: JSON.stringify({ examId }),
    }),
  ]);
  assert.equal(startA.status, 200, `Start A failed: ${startA.text}`);
  assert.equal(startB.status, 200, `Start B failed: ${startB.text}`);
  assert.equal(
    startA.json.attempt.id,
    startB.json.attempt.id,
    "Two simultaneous starts created duplicate attempts!",
  );
  const attemptId: string = startA.json.attempt.id;
  console.log("  ✓ Two simultaneous starts yielded one attempt");

  // 4. Scan paper response for correct-answer flags / password hashes
  const paper = await req(`/api/attempts/${attemptId}/paper`, {
    headers: { cookie: cand1Cookie },
  });
  assert.equal(paper.status, 200);
  assert.equal(paper.text.includes("isCorrect"), false, "Paper leaked isCorrect!");
  assert.equal(paper.text.includes("passwordHash"), false, "Paper leaked passwordHash!");
  assert.equal(paper.json.questions.length, 1);
  const aq = paper.json.questions[0];
  assert.equal(aq.text, originalPrompt);
  const correctOpt = aq.options.find(
    (o: { text: string }) => o.text === "Serializable",
  );
  assert.ok(correctOpt);
  console.log("  ✓ Paper response free of isCorrect and passwordHash");

  // 5. Mid-attempt question edit does not mutate frozen snapshot
  const editQ = await req(`/api/examiner/questions/${questionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: ex1Cookie },
    body: JSON.stringify({
      topic: "Integrity",
      difficulty: "MEDIUM",
      type: "SINGLE",
      text: `[${tag}] MUTATED IN BANK MID-ATTEMPT`,
      marks: 4,
      multiMode: "PARTIAL_PENALTY",
      options: [
        { text: "Read Committed", isCorrect: false },
        { text: "Serializable", isCorrect: true },
      ],
    }),
  });
  assert.equal(editQ.status, 200);

  const paperAfterEdit = await req(`/api/attempts/${attemptId}/paper`, {
    headers: { cookie: cand1Cookie },
  });
  assert.equal(paperAfterEdit.json.questions[0].text, originalPrompt);
  console.log("  ✓ Mid-attempt question edit left frozen snapshot untouched");

  // 6. Revision-ordered autosave (rev 2 then stale rev 1)
  const saveRev2 = await req(`/api/attempts/${attemptId}/answers`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cand1Cookie },
    body: JSON.stringify({
      attemptQuestionId: aq.attemptQuestionId,
      selectedOptionIds: [correctOpt.id],
      markedForReview: false,
      revision: 2,
    }),
  });
  assert.equal(saveRev2.status, 200);
  assert.equal(saveRev2.json.ignored, false);

  const saveStaleRev1 = await req(`/api/attempts/${attemptId}/answers`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cand1Cookie },
    body: JSON.stringify({
      attemptQuestionId: aq.attemptQuestionId,
      selectedOptionIds: [],
      markedForReview: true,
      revision: 1,
    }),
  });
  assert.equal(saveStaleRev1.status, 200);
  assert.equal(saveStaleRev1.json.ignored, true, "Stale revision must be ignored");
  assert.equal(saveStaleRev1.json.revision, 2);
  console.log("  ✓ Revision idempotency ignored stale write");

  // 7. Triple concurrent submit -> single submission + consistent score
  const [sub1, sub2, sub3] = await Promise.all([
    req(`/api/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { cookie: cand1Cookie },
    }),
    req(`/api/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { cookie: cand1Cookie },
    }),
    req(`/api/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { cookie: cand1Cookie },
    }),
  ]);
  for (const s of [sub1, sub2, sub3]) {
    assert.equal(s.status, 200, `Concurrent submit failed: ${s.text}`);
    assert.equal(s.json.ok, true);
  }
  const freshTransitions = [sub1, sub2, sub3].filter(
    (s) => s.json.alreadySubmitted === false,
  ).length;
  assert.equal(
    freshTransitions,
    1,
    `Expected exactly 1 fresh transition, saw ${freshTransitions}`,
  );
  console.log("  ✓ Triple concurrent submit transitioned cleanly once");

  // 8. Late save after deadlineAt + 3s grace is rejected (409) & auto-submitted
  const healthNow = await req("/api/health");
  const baseNow = new Date(healthNow.json.serverNow).getTime();
  // 61s window so setup always finishes well inside [startTime, endTime]
  const shortExamRes = await req("/api/examiner/exams", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ex1Cookie },
    body: JSON.stringify({
      title: `[${tag}] Late Save Expiry Check`,
      instructions: "Short window test",
      startTime: new Date(baseNow - 5_000).toISOString(),
      endTime: new Date(baseNow + 56_000).toISOString(),
      durationMin: 1,
      totalMarks: 4,
      shuffleQuestions: false,
      shuffleOptions: false,
      negativeMarking: 0,
    }),
  });
  assert.equal(shortExamRes.status, 201, `Short exam failed: ${shortExamRes.text}`);
  const shortExamId: string = shortExamRes.json.exam.id;

  await Promise.all([
    req(`/api/examiner/exams/${shortExamId}/questions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ex1Cookie },
      body: JSON.stringify({ action: "add", questionIds: [questionId] }),
    }),
    req(`/api/examiner/exams/${shortExamId}/enrollments/import`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ex1Cookie },
      body: JSON.stringify({
        content: "name,email\nCandidate 01,candidate1@proctoros.local\n",
      }),
    }),
  ]);
  await req(`/api/examiner/exams/${shortExamId}/publish`, {
    method: "POST",
    headers: { cookie: ex1Cookie },
  });

  const shortStart = await req("/api/attempts/start", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cand1Cookie },
    body: JSON.stringify({ examId: shortExamId }),
  });
  assert.equal(shortStart.status, 200, `Short start failed: ${shortStart.text}`);
  const shortAttemptId: string = shortStart.json.attempt.id;

  const shortPaper = await req(`/api/attempts/${shortAttemptId}/paper`, {
    headers: { cookie: cand1Cookie },
  });
  const shortAqId: string = shortPaper.json.questions[0].attemptQuestionId;

  const remainingMs =
    new Date(shortStart.json.attempt.deadlineAt).getTime() -
    new Date(shortStart.json.serverNow).getTime();
  const waitMs = Math.max(0, remainingMs) + 3800; // past 3s grace
  console.log(
    `  … waiting ${(waitMs / 1000).toFixed(1)}s to verify post-grace late save rejection`,
  );
  await sleep(waitMs);

  const lateSave = await req(`/api/attempts/${shortAttemptId}/answers`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cand1Cookie },
    body: JSON.stringify({
      attemptQuestionId: shortAqId,
      selectedOptionIds: [],
      markedForReview: false,
      revision: 1,
    }),
  });
  assert.equal(lateSave.status, 409, `Late save must be 409, got ${lateSave.status}`);
  assert.equal(lateSave.json?.code, "ATTEMPT_FINALIZED");

  const postExpiryPaper = await req(`/api/attempts/${shortAttemptId}/paper`, {
    headers: { cookie: cand1Cookie },
  });
  assert.ok(
    postExpiryPaper.json.attempt.status === "AUTO_SUBMITTED" ||
      postExpiryPaper.json.attempt.status === "GRADED",
    `Expected AUTO_SUBMITTED or GRADED, got ${postExpiryPaper.json.attempt.status}`,
  );
  console.log("  ✓ Late save after deadline + 3s grace rejected & auto-submitted");

  console.log("\nALL INTEGRITY CHECKS PASSED");

  // Optional cleanup of [IC-...] artifacts when DATABASE_URL is available locally
  try {
    process.loadEnvFile();
  } catch {
    // Ignore when .env is absent
  }
  if (process.env.DATABASE_URL) {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      await prisma.exam.deleteMany({
        where: { title: { startsWith: "[IC-" } },
      });
      await prisma.question.deleteMany({
        where: { text: { startsWith: "[IC-" } },
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((err) => {
  console.error("\nINTEGRITY CHECK FAILED:", err);
  process.exit(1);
});
