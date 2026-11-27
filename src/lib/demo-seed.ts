import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
  Difficulty,
  MultiMode,
  PrismaClient,
  QuestionType,
  Role,
} from "@prisma/client";
import { appendAuditLog } from "@/lib/audit";
import { gradeQuestion } from "@/lib/grading";
import { signReportPayload } from "@/lib/verify";

export const DEMO_PASSWORDS = {
  ADMIN: "Admin123!",
  EXAMINER: "Examiner123!",
  CANDIDATE: "Candidate123!",
} as const;

export const COMPLETED_EXAM_TITLE = "CS-401 Systems & Database Mid-Term";
export const ONGOING_EXAM_TITLE = "CS-412 Live Concurrency Quiz";
export const UPCOMING_EXAM_TITLE = "CS-499 Final Practical Assessment";

interface SeedQuestionSpec {
  key: string;
  topic:
    | "Distributed Systems"
    | "Database Internals"
    | "Concurrency Control"
    | "Applied Cryptography";
  difficulty: Difficulty;
  type: QuestionType;
  marks: number;
  multiMode?: MultiMode;
  text: string;
  options: Array<{ text: string; isCorrect: boolean }>;
  isAmbiguousDemo?: boolean;
}

const DEMO_QUESTIONS: SeedQuestionSpec[] = [
  // --- Distributed Systems (8: 3 EASY, 3 MEDIUM, 2 HARD) ---
  {
    key: "ds-1",
    topic: "Distributed Systems",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "According to the CAP theorem, when a network partition occurs in a distributed store, a system must choose between which two properties?",
    options: [
      { text: "Linearizable consistency and total availability", isCorrect: true },
      { text: "Durability and zero replication lag", isCorrect: false },
      { text: "Monotonic reads and write amplification", isCorrect: false },
      { text: "Eventual consistency and disk compression", isCorrect: false },
    ],
  },
  {
    key: "ds-2-ambiguous",
    topic: "Distributed Systems",
    difficulty: "MEDIUM",
    type: "SINGLE",
    marks: 4,
    isAmbiguousDemo: true,
    text: "In a replicated consensus system under asynchronous network partitions, which guarantee is strictly enforced by Raft before a newly elected leader serves new client writes?",
    options: [
      { text: "Log matching and leader completeness safety", isCorrect: true },
      {
        text: "Majority quorum intersection across consecutive terms",
        isCorrect: false,
      },
      {
        text: "Wait-free linearizable reads without leader leases",
        isCorrect: false,
      },
      { text: "Bounded physical wall-clock skew across nodes", isCorrect: false },
    ],
  },
  {
    key: "ds-3",
    topic: "Distributed Systems",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "Why are Lamport logical clocks insufficient on their own to determine whether event A caused event B?",
    options: [
      {
        text: "L(A) < L(B) does not imply A happened before B for concurrent events",
        isCorrect: true,
      },
      { text: "Lamport clocks require synchronized NTP servers", isCorrect: false },
      { text: "Lamport timestamps reset whenever a packet drops", isCorrect: false },
      { text: "Lamport clocks only track local thread IDs", isCorrect: false },
    ],
  },
  {
    key: "ds-4",
    topic: "Distributed Systems",
    difficulty: "MEDIUM",
    type: "MULTI",
    marks: 4,
    multiMode: "PARTIAL_PENALTY",
    text: "Which mechanisms directly help prevent duplicate side effects when retrying non-idempotent RPC calls over unreliable networks?",
    options: [
      { text: "Client-generated idempotency keys persisted with results", isCorrect: true },
      { text: "Monotonic request sequence numbers per session", isCorrect: true },
      { text: "Disabling TCP checksums on internal links", isCorrect: false },
      { text: "Increasing UDP packet MTU beyond 9000 bytes", isCorrect: false },
    ],
  },
  {
    key: "ds-5",
    topic: "Distributed Systems",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "In consistent hashing with virtual nodes, what primary benefit do virtual nodes provide?",
    options: [
      {
        text: "Uniform key distribution and smoother rebalancing when nodes join or leave",
        isCorrect: true,
      },
      { text: "Eliminating the need for any failure detector", isCorrect: false },
      { text: "Guaranteeing zero network hops for every lookup", isCorrect: false },
      { text: "Replacing replication with single-node storage", isCorrect: false },
    ],
  },
  {
    key: "ds-6",
    topic: "Distributed Systems",
    difficulty: "MEDIUM",
    type: "SINGLE",
    marks: 2,
    text: "Why can two-phase commit (2PC) block indefinitely if the coordinator crashes after participants vote YES?",
    options: [
      {
        text: "Participants hold locks while waiting to learn whether the coordinator committed or aborted",
        isCorrect: true,
      },
      { text: "Participants discard their write-ahead logs immediately", isCorrect: false },
      { text: "TCP closes all sockets permanently after 500ms", isCorrect: false },
      { text: "2PC executes without durable storage on coordinators", isCorrect: false },
    ],
  },
  {
    key: "ds-7",
    topic: "Distributed Systems",
    difficulty: "HARD",
    type: "SINGLE",
    marks: 3,
    text: "When using fencing tokens alongside a distributed lock service to protect storage writes against GC pauses, what must the storage server verify?",
    options: [
      {
        text: "Reject any write carrying a token lower than the highest token already processed",
        isCorrect: true,
      },
      { text: "Ping the client JVM garbage collector before every write", isCorrect: false },
      { text: "Accept only tokens matching the client MAC address", isCorrect: false },
      { text: "Extend lease TTL automatically on every stale write", isCorrect: false },
    ],
  },
  {
    key: "ds-8",
    topic: "Distributed Systems",
    difficulty: "HARD",
    type: "WRITTEN",
    marks: 4,
    text: "Briefly explain how read-repair and hinted handoff work together in a Dynamo-style leaderless store, and identify one failure mode they do not solve alone.",
    options: [],
  },

  // --- Database Internals (8: 3 EASY, 3 MEDIUM, 2 HARD) ---
  {
    key: "db-1",
    topic: "Database Internals",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "What is the primary durability invariant enforced by Write-Ahead Logging (WAL)?",
    options: [
      {
        text: "Log records describing a modification reach stable storage before the corresponding dirty data pages",
        isCorrect: true,
      },
      { text: "Indexes are rebuilt from scratch on every checkpoint", isCorrect: false },
      { text: "Tables are locked exclusively during read-only queries", isCorrect: false },
      { text: "Buffer pool pages are never cached in memory", isCorrect: false },
    ],
  },
  {
    key: "db-2",
    topic: "Database Internals",
    difficulty: "MEDIUM",
    type: "SINGLE",
    marks: 2,
    text: "Why do LSM-tree storage engines typically sustain higher random-write throughput than in-place B+Tree engines?",
    options: [
      {
        text: "Writes append sequentially to a WAL and memory table before batched sorted flushes",
        isCorrect: true,
      },
      { text: "LSM-trees never keep indexes or bloom filters", isCorrect: false },
      { text: "B+Trees cannot store fixed-length integer keys", isCorrect: false },
      { text: "LSM-trees bypass OS file durability semantics", isCorrect: false },
    ],
  },
  {
    key: "db-3",
    topic: "Database Internals",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "What role do Bloom filters serve inside an SSTable-based storage engine?",
    options: [
      {
        text: "Quickly ruling out SSTables that definitely do not contain a target key",
        isCorrect: true,
      },
      { text: "Sorting variable-length strings on disk", isCorrect: false },
      { text: "Encrypting primary key columns with AES-GCM", isCorrect: false },
      { text: "Compressing cold WAL segments losslessly", isCorrect: false },
    ],
  },
  {
    key: "db-4",
    topic: "Database Internals",
    difficulty: "MEDIUM",
    type: "MULTI",
    marks: 4,
    multiMode: "PARTIAL_PENALTY",
    text: "Which statements accurately describe PostgreSQL's Multi-Version Concurrency Control (MVCC) tuple storage?",
    options: [
      { text: "Readers do not block writers and writers do not block readers", isCorrect: true },
      { text: "Dead row versions accumulate until reclaimed by VACUUM", isCorrect: true },
      { text: "Updates overwrite the old heap tuple strictly in place", isCorrect: false },
      { text: "Transactions share a single mutable rollback segment only", isCorrect: false },
    ],
  },
  {
    key: "db-5",
    topic: "Database Internals",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "Which type of SQL scan becomes possible when every column referenced in a query exists inside a single B+Tree index?",
    options: [
      { text: "Index-only scan (covering index)", isCorrect: true },
      { text: "Nested loop cross join", isCorrect: false },
      { text: "Full heap sequential vacuum", isCorrect: false },
      { text: "Hash spill partition", isCorrect: false },
    ],
  },
  {
    key: "db-6",
    topic: "Database Internals",
    difficulty: "MEDIUM",
    type: "SINGLE",
    marks: 2,
    text: "In a composite B+Tree index on (tenant_id, created_at), which predicate benefits least from index ordering?",
    options: [
      { text: "WHERE created_at >= '2026-01-01' without tenant_id", isCorrect: true },
      { text: "WHERE tenant_id = 'acme' AND created_at >= '2026-01-01'", isCorrect: false },
      { text: "WHERE tenant_id = 'acme' ORDER BY created_at DESC LIMIT 20", isCorrect: false },
      { text: "WHERE tenant_id = 'acme'", isCorrect: false },
    ],
  },
  {
    key: "db-7",
    topic: "Database Internals",
    difficulty: "HARD",
    type: "SINGLE",
    marks: 3,
    text: "During ARIES crash recovery, why does the Redo phase repeat history even for transactions that eventually rolled back?",
    options: [
      {
        text: "To reconstruct the exact database page state before undoing loser transactions cleanly via CLRs",
        isCorrect: true,
      },
      { text: "To preserve uncommitted rows permanently after recovery", isCorrect: false },
      { text: "Because WAL records contain no transaction identifiers", isCorrect: false },
      { text: "To avoid flushing checkpoints during normal operation", isCorrect: false },
    ],
  },
  {
    key: "db-8",
    topic: "Database Internals",
    difficulty: "HARD",
    type: "WRITTEN",
    marks: 4,
    text: "Explain why write amplification occurs in leveled compaction compared with size-tiered compaction, and name one workload suited to each.",
    options: [],
  },

  // --- Concurrency Control (7: 2 EASY, 3 MEDIUM, 2 HARD) ---
  {
    key: "cc-1",
    topic: "Concurrency Control",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "Which anomaly is prevented by Repeatable Read under snapshot isolation while still leaving write skew possible?",
    options: [
      { text: "Non-repeatable reads of the same row within one transaction", isCorrect: true },
      { text: "Disjoint writes constrained by cross-row invariants", isCorrect: false },
      { text: "Clock synchronization drift across replicas", isCorrect: false },
      { text: "Hardware ECC memory bit flips", isCorrect: false },
    ],
  },
  {
    key: "cc-2",
    topic: "Concurrency Control",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "What does a conditional UPDATE ... WHERE status = 'IN_PROGRESS' guarantee under two simultaneous Submit requests?",
    options: [
      {
        text: "At most one transaction matches the predicate and transitions the row",
        isCorrect: true,
      },
      { text: "Both requests fail with HTTP 500 deadlock", isCorrect: false },
      { text: "Both transactions merge their scores together", isCorrect: false },
      { text: "Postgres pauses both requests for 60 seconds", isCorrect: false },
    ],
  },
  {
    key: "cc-3",
    topic: "Concurrency Control",
    difficulty: "MEDIUM",
    type: "SINGLE",
    marks: 2,
    text: "Why does Serializable Snapshot Isolation (SSI) track rw-antidependency cycles instead of locking every read range upfront?",
    options: [
      {
        text: "It detects dangerous two-edge structures optimistically while keeping snapshot reads non-blocking",
        isCorrect: true,
      },
      { text: "It silently relaxes serializability to Read Committed", isCorrect: false },
      { text: "It disables transaction aborts completely", isCorrect: false },
      { text: "It prevents multi-statement transactions", isCorrect: false },
    ],
  },
  {
    key: "cc-4",
    topic: "Concurrency Control",
    difficulty: "MEDIUM",
    type: "MULTI",
    marks: 4,
    multiMode: "ALL_OR_NOTHING",
    text: "Select ALL techniques that preserve monotonic revision ordering when offline autosave requests arrive out of order.",
    options: [
      { text: "Ignoring writes whose revision <= stored revision", isCorrect: true },
      { text: "Performing conditional update WHERE revision < incomingRevision", isCorrect: true },
      { text: "Blindly overwriting with whichever HTTP request arrives last", isCorrect: false },
      { text: "Trusting the browser wall clock timestamp alone", isCorrect: false },
    ],
  },
  {
    key: "cc-5",
    topic: "Concurrency Control",
    difficulty: "MEDIUM",
    type: "SINGLE",
    marks: 2,
    text: "How does PostgreSQL transaction-scoped advisory locking (pg_advisory_xact_lock) behave when a transaction commits or rolls back?",
    options: [
      {
        text: "The lock releases automatically at transaction end with no manual unlock needed",
        isCorrect: true,
      },
      { text: "The lock persists across server restarts until dropped", isCorrect: false },
      { text: "The lock blocks read-only SELECT queries on unrelated tables", isCorrect: false },
      { text: "It forces all clients to disconnect after commit", isCorrect: false },
    ],
  },
  {
    key: "cc-6",
    topic: "Concurrency Control",
    difficulty: "HARD",
    type: "SINGLE",
    marks: 3,
    text: "Two transactions both read the balance of a shared budget and insert new expense rows totaling more than the cap. Why does standard Snapshot Isolation allow this?",
    options: [
      {
        text: "They insert distinct rows into disjoint locations, avoiding first-committer-wins write conflicts",
        isCorrect: true,
      },
      { text: "Snapshot Isolation ignores INSERT statements completely", isCorrect: false },
      { text: "Snapshot Isolation commits transactions before reading", isCorrect: false },
      { text: "Unique indexes always cause phantom writes", isCorrect: false },
    ],
  },
  {
    key: "cc-7",
    topic: "Concurrency Control",
    difficulty: "HARD",
    type: "SINGLE",
    marks: 3,
    text: "Why can relying on SELECT ... FOR UPDATE fail to prevent write skew when inserting new rows matching an empty range predicate?",
    options: [
      {
        text: "Row-level locks cannot lock nonexistent rows returned by an empty range scan",
        isCorrect: true,
      },
      { text: "FOR UPDATE only locks nullable columns", isCorrect: false },
      { text: "FOR UPDATE immediately commits the outer transaction", isCorrect: false },
      { text: "FOR UPDATE disables primary key uniqueness checks", isCorrect: false },
    ],
  },

  // --- Applied Cryptography (7: 2 EASY, 3 MEDIUM, 2 HARD) ---
  {
    key: "ac-1",
    topic: "Applied Cryptography",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "Why should HMAC signatures be compared using a constant-time function such as crypto.timingSafeEqual?",
    options: [
      {
        text: "To prevent timing side-channel leaks from early-exit byte comparisons",
        isCorrect: true,
      },
      { text: "Because standard equality checks skip the first 8 bytes", isCorrect: false },
      { text: "To compress SHA-256 outputs to 64 bits", isCorrect: false },
      { text: "Because HMAC keys change on every request", isCorrect: false },
    ],
  },
  {
    key: "ac-2",
    topic: "Applied Cryptography",
    difficulty: "EASY",
    type: "SINGLE",
    marks: 2,
    text: "Why are passwords hashed with per-user salted bcrypt rather than raw SHA-256?",
    options: [
      {
        text: "Salts thwart precomputed rainbow tables and adaptive work factors slow brute-force attacks",
        isCorrect: true,
      },
      { text: "Bcrypt hashes can be decrypted back to plaintext by admins", isCorrect: false },
      { text: "SHA-256 cannot hash strings longer than 16 bytes", isCorrect: false },
      { text: "Bcrypt produces identical hashes for matching passwords", isCorrect: false },
    ],
  },
  {
    key: "ac-3",
    topic: "Applied Cryptography",
    difficulty: "MEDIUM",
    type: "SINGLE",
    marks: 2,
    text: "In an append-only hash-chained audit log, what does including prevHash inside each row's SHA-256 input prove upon verification?",
    options: [
      {
        text: "Any edit, deletion, or reordering of an earlier entry invalidates that entry and every subsequent hash",
        isCorrect: true,
      },
      { text: "That no administrator holds root database credentials", isCorrect: false },
      { text: "That every row payload is encrypted confidentially", isCorrect: false },
      { text: "That timestamps were issued by an external hardware HSM", isCorrect: false },
    ],
  },
  {
    key: "ac-4",
    topic: "Applied Cryptography",
    difficulty: "MEDIUM",
    type: "SINGLE",
    marks: 2,
    text: "Why must verification tokens printed on official PDF score reports contain a random unguessable 128-bit ID rather than sequential integers?",
    options: [
      {
        text: "Sequential IDs allow anyone to enumerate all issued candidate certificates",
        isCorrect: true,
      },
      { text: "PDF viewers cannot render QR codes containing digits", isCorrect: false },
      { text: "Random hex IDs eliminate the need for server lookup", isCorrect: false },
      { text: "Sequential integers break HMAC-SHA256 padding", isCorrect: false },
    ],
  },
  {
    key: "ac-5",
    topic: "Applied Cryptography",
    difficulty: "MEDIUM",
    type: "MULTI",
    marks: 4,
    multiMode: "PARTIAL_PENALTY",
    text: "Which practices are essential for storing JWT session tokens safely in a web examination platform?",
    options: [
      { text: "HttpOnly, SameSite=Lax cookies so scripts cannot steal tokens", isCorrect: true },
      { text: "Re-verifying active user status in Postgres on privileged routes", isCorrect: true },
      { text: "Embedding user password hashes inside JWT claims", isCorrect: false },
      { text: "Accepting JWT alg=none tokens during offline recovery", isCorrect: false },
    ],
  },
  {
    key: "ac-6",
    topic: "Applied Cryptography",
    difficulty: "HARD",
    type: "SINGLE",
    marks: 3,
    text: "What security risk exists if a server accepts canonical JSON audit payloads without sorting object keys before hashing?",
    options: [
      {
        text: "JSONB key reordering in Postgres can cause deterministic hash verification to fail falsely",
        isCorrect: true,
      },
      { text: "SHA-256 outputs non-hexadecimal binary strings", isCorrect: false },
      { text: "Advisory locks deadlock on sorted strings", isCorrect: false },
      { text: "JSON.stringify executes arbitrary functions in payloads", isCorrect: false },
    ],
  },
  {
    key: "ac-7",
    topic: "Applied Cryptography",
    difficulty: "HARD",
    type: "WRITTEN",
    marks: 4,
    text: "Describe one honest limitation of a hash-chained audit table stored inside the primary database, and explain how external hash anchoring mitigates it.",
    options: [],
  },
];

function buildUsersSpec(
  adminHash: string,
  examinerHash: string,
  candidateHash: string,
): Array<{
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}> {
  return [
    {
      name: "System Administrator",
      email: "admin@proctoros.local",
      role: Role.ADMIN,
      passwordHash: adminHash,
    },
    {
      name: "Dr. Nadia Hassan",
      email: "examiner1@proctoros.local",
      role: Role.EXAMINER,
      passwordHash: examinerHash,
    },
    {
      name: "Prof. Tariq Javed",
      email: "examiner2@proctoros.local",
      role: Role.EXAMINER,
      passwordHash: examinerHash,
    },
    ...Array.from({ length: 15 }, (_, idx) => {
      const n = idx + 1;
      return {
        name: `Candidate ${String(n).padStart(2, "0")}`,
        email: `candidate${n}@proctoros.local`,
        role: Role.CANDIDATE,
        passwordHash: candidateHash,
      };
    }),
  ];
}

export async function seedDemoData(
  prisma: PrismaClient,
  opts: { reset: boolean } = { reset: false },
) {
  const [adminHash, examinerHash, candidateHash] = await Promise.all([
    bcrypt.hash(DEMO_PASSWORDS.ADMIN, 10),
    bcrypt.hash(DEMO_PASSWORDS.EXAMINER, 10),
    bcrypt.hash(DEMO_PASSWORDS.CANDIDATE, 10),
  ]);

  const userSpecs = buildUsersSpec(adminHash, examinerHash, candidateHash);

  if (opts.reset) {
    await prisma.$transaction(
      async (tx) => {
        await tx.auditLog.deleteMany({});
        await tx.auditHead.deleteMany({});
        await tx.exam.deleteMany({});
        await tx.question.deleteMany({});
        await tx.userPref.deleteMany({});
      },
      { maxWait: 15000, timeout: 45000 },
    );
  }

  // Upsert all 18 users cleanly (1 Admin, 2 Examiners, 15 Candidates)
  const upsertedUsers = await Promise.all(
    userSpecs.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          role: user.role,
          passwordHash: user.passwordHash,
          isActive: true,
        },
        create: {
          name: user.name,
          email: user.email,
          role: user.role,
          passwordHash: user.passwordHash,
          isActive: true,
        },
        select: { id: true, email: true, role: true, name: true },
      }),
    ),
  );

  const examiner1 = upsertedUsers.find(
    (u) => u.email === "examiner1@proctoros.local",
  )!;
  const candidates = upsertedUsers
    .filter((u) => u.role === "CANDIDATE")
    .sort((a, b) => {
      const numA = Number(a.email.match(/\d+/)?.[0] ?? 0);
      const numB = Number(b.email.match(/\d+/)?.[0] ?? 0);
      return numA - numB;
    });

  // Skip full exam/question seeding on idempotent `db:seed` if demo exams already exist
  if (!opts.reset) {
    const existingDemoExam = await prisma.exam.findFirst({
      where: { title: COMPLETED_EXAM_TITLE, ownerId: examiner1.id },
      select: { id: true },
    });
    if (existingDemoExam) {
      return {
        skippedContent: true,
        usersCount: upsertedUsers.length,
        questionsCount: 0,
        examsCount: 0,
      };
    }
  }

  // Create all 30 questions in batches of 5 for crisp Supabase RTT performance
  type CreatedQuestion = {
    spec: SeedQuestionSpec;
    id: string;
    options: Array<{ id: string; text: string; isCorrect: boolean }>;
  };

  const createdQuestions: CreatedQuestion[] = [];
  for (let i = 0; i < DEMO_QUESTIONS.length; i += 5) {
    const chunk = DEMO_QUESTIONS.slice(i, i + 5);
    const createdChunk = await Promise.all(
      chunk.map(async (spec) => {
        const q = await prisma.question.create({
          data: {
            ownerId: examiner1.id,
            topic: spec.topic,
            difficulty: spec.difficulty,
            type: spec.type,
            text: spec.text,
            marks: spec.marks,
            multiMode: spec.multiMode ?? "PARTIAL_PENALTY",
            options: {
              create: spec.options.map((opt, idx) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
                order: idx,
              })),
            },
          },
          include: {
            options: { orderBy: { order: "asc" } },
          },
        });
        return {
          spec,
          id: q.id,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        };
      }),
    );
    createdQuestions.push(...createdChunk);
  }

  const byKey = new Map(createdQuestions.map((q) => [q.spec.key, q]));
  const now = Date.now();

  // ---------------------------------------------------------------------------
  // 1. COMPLETED EXAM (15 graded attempts + incidents + ambiguous dispute)
  // ---------------------------------------------------------------------------
  const completedKeys = [
    "ds-1",
    "ds-2-ambiguous",
    "ds-3",
    "ds-4",
    "db-1",
    "db-2",
    "db-4",
    "cc-1",
    "cc-3",
    "ac-1",
    "ac-3",
    "db-8",
  ];
  const completedQuestions = completedKeys.map((k) => byKey.get(k)!);
  const completedTotalMarks = completedQuestions.reduce(
    (sum, q) => sum + q.spec.marks,
    0,
  );

  const completedExam = await prisma.exam.create({
    data: {
      ownerId: examiner1.id,
      title: COMPLETED_EXAM_TITLE,
      instructions:
        "Answer all 12 questions within 45 minutes. Written explanations are graded manually before publication.",
      startTime: new Date(now - 4 * 24 * 3600_000),
      endTime: new Date(now - 2 * 24 * 3600_000),
      durationMin: 45,
      totalMarks: completedTotalMarks,
      shuffleQuestions: false,
      shuffleOptions: false,
      negativeMarking: 0,
      status: "PUBLISHED",
      resultsPublished: true,
      examQuestions: {
        create: completedQuestions.map((q, idx) => ({
          questionId: q.id,
          order: idx,
        })),
      },
      enrollments: {
        create: candidates.map((c) => ({ candidateId: c.id })),
      },
    },
  });

  // 8 candidates specifically select the strong distractor on ds-2-ambiguous
  // so analytics flags it as SUSPECT (8x distractor > 5x original key) and a live ruling updates 8 attempts
  const alternatePickerIndices = new Set([0, 2, 3, 5, 7, 8, 10, 13]);

  const ambiguousSourceId = byKey.get("ds-2-ambiguous")!.id;
  let candidate1AmbiguousAqId = "";
  let candidate7TechnicalAqId = "";

  const baseStarted = now - 3 * 24 * 3600_000;

  for (let cIdx = 0; cIdx < candidates.length; cIdx += 1) {
    const candidate = candidates[cIdx];
    const startedAt = new Date(baseStarted + cIdx * 120_000);
    const deadlineAt = new Date(startedAt.getTime() + 45 * 60_000);
    const submittedAt = new Date(
      startedAt.getTime() + (26 + (cIdx % 14)) * 60_000,
    );

    const attempt = await prisma.attempt.create({
      data: {
        examId: completedExam.id,
        candidateId: candidate.id,
        isSandbox: false,
        realKey: `${completedExam.id}:${candidate.id}`,
        status: "GRADED",
        startedAt,
        deadlineAt,
        submittedAt,
        totalScore: 0,
      },
    });

    const createdAqs = await Promise.all(
      completedQuestions.map(async (cq, qPos) => {
        const optionsSnapshot = cq.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
        }));

        let selectedOptionIds: string[] = [];
        let writtenText: string | null = null;

        if (cq.spec.type === "WRITTEN") {
          writtenText =
            cIdx % 4 === 0
              ? "Leveled compaction maintains bounded space amplification by merging non-overlapping SSTable levels, while size-tiered compaction minimizes write amplification for append-heavy workloads."
              : cIdx % 3 === 0
                ? "Leveled compaction trades extra background rewrites for predictable point-lookup latency; size-tiered suits high-ingest logging."
                : "Size-tiered groups similarly sized SSTables; leveled compaction caps level size ratios.";
        } else if (cq.spec.key === "ds-2-ambiguous") {
          if (alternatePickerIndices.has(cIdx)) {
            selectedOptionIds = [cq.options[1].id];
          } else if (cIdx % 7 === 6) {
            selectedOptionIds = [cq.options[2].id];
          } else {
            selectedOptionIds = [cq.options[0].id];
          }
        } else if (cq.spec.type === "MULTI") {
          const correctOpts = cq.options.filter((o) => o.isCorrect);
          const wrongOpts = cq.options.filter((o) => !o.isCorrect);
          if (cIdx % 5 === 0) {
            selectedOptionIds = [correctOpts[0].id];
          } else if (cIdx % 6 === 4) {
            selectedOptionIds = [correctOpts[0].id, wrongOpts[0].id];
          } else {
            selectedOptionIds = correctOpts.map((o) => o.id);
          }
        } else {
          const missThis =
            (cIdx + qPos) % (cIdx < 4 ? 7 : cIdx < 10 ? 4 : 3) === 2;
          const target = missThis
            ? cq.options.find((o) => !o.isCorrect)!
            : cq.options.find((o) => o.isCorrect)!;
          selectedOptionIds = [target.id];
        }

        const graded = gradeQuestion(
          {
            sourceQuestionId: cq.id,
            typeSnapshot: cq.spec.type,
            marksSnapshot: cq.spec.marks,
            multiModeSnapshot: cq.spec.multiMode ?? "PARTIAL_PENALTY",
            optionsSnapshot,
          },
          { selectedOptionIds, writtenText },
          [],
          0,
        );

        const awardedScore =
          cq.spec.type === "WRITTEN"
            ? cIdx % 4 === 0
              ? 4
              : cIdx % 3 === 0
                ? 3
                : 2
            : (graded.score ?? 0);

        const aq = await prisma.attemptQuestion.create({
          data: {
            attemptId: attempt.id,
            position: qPos + 1,
            sourceQuestionId: cq.id,
            textSnapshot: cq.spec.text,
            typeSnapshot: cq.spec.type,
            marksSnapshot: cq.spec.marks,
            optionsSnapshot,
            multiModeSnapshot: cq.spec.multiMode ?? "PARTIAL_PENALTY",
            answer: {
              create: {
                selectedOptionIds,
                writtenText,
                markedForReview: false,
                revision: 1,
                savedAt: new Date(submittedAt.getTime() - 30_000),
              },
            },
            grades: {
              create: {
                score: awardedScore,
                gradedBy: cq.spec.type === "WRITTEN" ? examiner1.id : null,
                reason:
                  cq.spec.type === "WRITTEN"
                    ? "Rubric match on compaction trade-offs"
                    : graded.reason,
                createdAt: new Date(submittedAt.getTime() + 5_000),
              },
            },
          },
        });

        return { aqId: aq.id, cqId: cq.id, qPos, awardedScore };
      }),
    );

    let runningTotal = 0;
    for (const item of createdAqs) {
      runningTotal += item.awardedScore;
      if (cIdx === 0 && item.cqId === ambiguousSourceId) {
        candidate1AmbiguousAqId = item.aqId;
      }
      if (cIdx === 6 && item.qPos === 0) {
        candidate7TechnicalAqId = item.aqId;
      }
    }

    const roundedTotal = Math.round(runningTotal * 100) / 100;
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { totalScore: roundedTotal },
    });

    // Attach realistic session incidents for a few candidates
    if (cIdx === 0 || cIdx === 6 || cIdx === 11) {
      await prisma.incident.createMany({
        data: [
          {
            attemptId: attempt.id,
            type: "OFFLINE",
            detail: "Network dropped for 12s; outbox replayed rev 1",
            at: new Date(startedAt.getTime() + 10 * 60_000),
          },
          ...(cIdx === 6
            ? [
                {
                  attemptId: attempt.id,
                  type: "TAB_HIDDEN" as const,
                  detail: "Browser tab hidden during attempt",
                  at: new Date(startedAt.getTime() + 18 * 60_000),
                },
              ]
            : []),
        ],
      });
    }

    // Issue verifiable ReportTokens for top 3 candidates if REPORT_SECRET is configured
    if (cIdx < 3 && (process.env.REPORT_SECRET?.length ?? 0) >= 16) {
      const tokenId = crypto.randomBytes(16).toString("hex");
      const issuedAt = new Date(submittedAt.getTime() + 60 * 60_000);
      const signature = signReportPayload({
        tokenId,
        attemptId: attempt.id,
        scoreAtIssue: roundedTotal,
        issuedAtIso: issuedAt.toISOString(),
      });
      await prisma.reportToken.create({
        data: {
          id: tokenId,
          attemptId: attempt.id,
          scoreAtIssue: roundedTotal,
          issuedAt,
          signature,
        },
      });
    }
  }

  // Create 2 demo disputes + hash-chained audit entries on Exam 1
  await prisma.$transaction(
    async (tx) => {
      await appendAuditLog(tx, {
        actorId: examiner1.id,
        action: "RESULTS_PUBLISHED",
        entity: "Exam",
        entityId: completedExam.id,
        payload: {
          examId: completedExam.id,
          override: false,
          attemptCount: candidates.length,
        },
      });

      const d1 = await tx.dispute.create({
        data: {
          attemptQuestionId: candidate1AmbiguousAqId,
          candidateId: candidates[0].id,
          category: "AMBIGUOUS",
          message:
            "Option B ('Majority quorum intersection across consecutive terms') is also strictly enforced by Raft before leader write commitment. Could both answers be accepted?",
          status: "OPEN",
        },
      });

      await appendAuditLog(tx, {
        actorId: candidates[0].id,
        action: "DISPUTE_FILED",
        entity: "Dispute",
        entityId: d1.id,
        payload: {
          examId: completedExam.id,
          attemptQuestionId: candidate1AmbiguousAqId,
          sourceQuestionId: ambiguousSourceId,
          category: "AMBIGUOUS",
        },
      });

      const d7 = await tx.dispute.create({
        data: {
          attemptQuestionId: candidate7TechnicalAqId,
          candidateId: candidates[6].id,
          category: "TECHNICAL",
          message:
            "Wi-Fi briefly disconnected mid-question; checking whether my CAP answer saved.",
          status: "REJECTED",
          resolution:
            "Verified saved answer revision #1 in the evidence pack; answer matched submitted response cleanly.",
          resolvedBy: examiner1.id,
        },
      });

      await appendAuditLog(tx, {
        actorId: candidates[6].id,
        action: "DISPUTE_FILED",
        entity: "Dispute",
        entityId: d7.id,
        payload: {
          examId: completedExam.id,
          attemptQuestionId: candidate7TechnicalAqId,
          category: "TECHNICAL",
        },
      });

      await appendAuditLog(tx, {
        actorId: examiner1.id,
        action: "DISPUTE_REJECTED",
        entity: "Dispute",
        entityId: d7.id,
        payload: {
          examId: completedExam.id,
          attemptQuestionId: candidate7TechnicalAqId,
          resolution:
            "Verified saved answer revision #1 in the evidence pack; answer matched submitted response cleanly.",
        },
      });
    },
    { maxWait: 15000, timeout: 30000 },
  );

  // ---------------------------------------------------------------------------
  // 2. ONGOING EXAM (window open now + 2 live IN_PROGRESS attempts)
  // ---------------------------------------------------------------------------
  const ongoingKeys = [
    "cc-1",
    "cc-2",
    "cc-3",
    "cc-4",
    "cc-5",
    "cc-6",
    "ds-5",
    "ac-1",
  ];
  const ongoingQuestions = ongoingKeys.map((k) => byKey.get(k)!);
  const ongoingTotalMarks = ongoingQuestions.reduce(
    (sum, q) => sum + q.spec.marks,
    0,
  );

  const ongoingExam = await prisma.exam.create({
    data: {
      ownerId: examiner1.id,
      title: ONGOING_EXAM_TITLE,
      instructions:
        "Live concurrency assessment. Navigation keys N/P and Arrow keys work between questions; answers sync offline automatically.",
      startTime: new Date(now - 30 * 60_000),
      endTime: new Date(now + 90 * 60_000),
      durationMin: 45,
      totalMarks: ongoingTotalMarks,
      shuffleQuestions: false,
      shuffleOptions: false,
      negativeMarking: 0.5,
      status: "PUBLISHED",
      resultsPublished: false,
      examQuestions: {
        create: ongoingQuestions.map((q, idx) => ({
          questionId: q.id,
          order: idx,
        })),
      },
      enrollments: {
        create: candidates.map((c) => ({ candidateId: c.id })),
      },
      announcements: {
        create: {
          authorId: examiner1.id,
          message:
            "Reminder: Questions 1–3 assume Snapshot Isolation unless Serializable (SSI) is explicitly stated.",
        },
      },
    },
  });

  // 2 active attempts (Candidate 01 & Candidate 02) so Monitor shows live progress immediately
  for (let activeIdx = 0; activeIdx < 2; activeIdx += 1) {
    const candidate = candidates[activeIdx];
    const startedAt = new Date(now - (12 - activeIdx * 4) * 60_000);
    const deadlineAt = new Date(startedAt.getTime() + 45 * 60_000);

    const attempt = await prisma.attempt.create({
      data: {
        examId: ongoingExam.id,
        candidateId: candidate.id,
        isSandbox: false,
        realKey: `${ongoingExam.id}:${candidate.id}`,
        status: "IN_PROGRESS",
        startedAt,
        deadlineAt,
      },
    });

    const answeredLimit = activeIdx === 0 ? 4 : 2;
    for (let qPos = 0; qPos < ongoingQuestions.length; qPos += 1) {
      const cq = ongoingQuestions[qPos];
      const optionsSnapshot = cq.options.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect,
      }));
      const shouldAnswer = qPos < answeredLimit && cq.options.length > 0;
      await prisma.attemptQuestion.create({
        data: {
          attemptId: attempt.id,
          position: qPos + 1,
          sourceQuestionId: cq.id,
          textSnapshot: cq.spec.text,
          typeSnapshot: cq.spec.type,
          marksSnapshot: cq.spec.marks,
          optionsSnapshot,
          multiModeSnapshot: cq.spec.multiMode ?? "PARTIAL_PENALTY",
          ...(shouldAnswer
            ? {
                answer: {
                  create: {
                    selectedOptionIds: [cq.options[0].id],
                    markedForReview: qPos === 1,
                    revision: 1,
                  },
                },
              }
            : {}),
        },
      });
    }

    await prisma.scratchpad.create({
      data: {
        attemptId: attempt.id,
        content:
          activeIdx === 0
            ? "Q4 check: ignore stale revision <= storedRevision."
            : "Checking Snapshot Isolation vs SSI anomalies.",
      },
    });

    if (activeIdx === 0) {
      await prisma.incident.create({
        data: {
          attemptId: attempt.id,
          type: "TAB_HIDDEN",
          detail: "Browser tab hidden during attempt",
          at: new Date(now - 5 * 60_000),
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. PUBLISHED UPCOMING EXAM
  // ---------------------------------------------------------------------------
  const upcomingKeys = ["db-3", "db-5", "db-6", "db-7", "ac-2", "ac-7"];
  const upcomingQuestions = upcomingKeys.map((k) => byKey.get(k)!);
  const upcomingTotalMarks = upcomingQuestions.reduce(
    (sum, q) => sum + q.spec.marks,
    0,
  );

  await prisma.exam.create({
    data: {
      ownerId: examiner1.id,
      title: UPCOMING_EXAM_TITLE,
      instructions:
        "Final synthesis examination covering storage engines, crash recovery, and audit verification.",
      startTime: new Date(now + 24 * 3600_000),
      endTime: new Date(now + 28 * 3600_000),
      durationMin: 60,
      totalMarks: upcomingTotalMarks,
      shuffleQuestions: true,
      shuffleOptions: true,
      negativeMarking: 0,
      status: "PUBLISHED",
      resultsPublished: false,
      examQuestions: {
        create: upcomingQuestions.map((q, idx) => ({
          questionId: q.id,
          order: idx,
        })),
      },
      enrollments: {
        create: candidates.map((c) => ({ candidateId: c.id })),
      },
    },
  });

  return {
    skippedContent: false,
    usersCount: upsertedUsers.length,
    questionsCount: createdQuestions.length,
    examsCount: 3,
  };
}
