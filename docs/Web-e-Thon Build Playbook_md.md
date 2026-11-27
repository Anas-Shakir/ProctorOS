# Web-e-Thon Build Playbook

**Secure Examination Management System, Technoverse 5.0** *Incremental build stages with a check at the end of every stage*

---

## 0. How to use this document

Work top to bottom. Each stage has three parts:

- **Build:** what to create.
- **Check:** how to prove it works before moving on.
- **Done when:** the exit gate. Do not start the next stage until you pass it.

**Rule 1:** A feature that has a UI but no working backend scores nothing. Every stage ends with a manual test, not a screenshot. **Rule 2:** Commit at the end of every stage with a meaningful message. The judges see version history. **Rule 3:** Deploy early (Stage 0) and redeploy after every stage. Never discover deployment problems in the last hour.

## 0.1 What changed in v2 (read this first)

I re-audited v1 against the problem statement and found ten defects. Each is fixed below.

| # | Problem in v1 | Fix in v2 |
| --- | --- | --- |
| 1 | Database pick ignored your Supabase experience | Supabase, used as plain Postgres, with guardrails (section 1.1a) |
| 2 | Exam status was stored as ONGOING and COMPLETED but also derived from time: two sources of truth | Store only DRAFT or PUBLISHED; compute ONGOING and COMPLETED from server time |
| 3 | A unique attempt where isSandbox is false cannot be written in a Prisma schema | Nullable unique `realKey` column, NULL for sandbox attempts |
| 4 | The audit hash chain could fork under concurrent writes | Chain writes take a Postgres advisory lock inside one transaction |
| 5 | Deadline enforcement leaned on a cron sweep, and Vercel Hobby cron runs once a day at most | Lazy finalization on every read and write, plus an on-demand sweep |
| 6 | Dispute regrading would have forced a grader rewrite in Stage 11 | Stage 6 builds the grader ruling-aware from the start |
| 7 | Candidate import only enrolled existing users | Import creates missing candidate accounts with one-time passwords, then enrolls |
| 8 | No attempt review page (required: retain and review) and no admin operations view | Both added in Stage 8 |
| 9 | The time plan looked sequential but assumed three people, and filled all 30 person-hours with no slack | Priority tiers, a time-boxed solo plan, checkpoints and a cut line (section 5) |
| 10 | No automated safety net for the integrity checks | One script, rerun against production after every deploy |

### Priority tiers

| Tier | Meaning | Contents |
| --- | --- | --- |
| P0 | Must work flawlessly; the 30 core marks and most of the 20 technical marks live here | Stages 0 to 6, publication, candidate results, backend authorization |
| P1 | Secondary features and the innovation core | Monitoring, announcements, analytics, PDF and verify, sandbox, bulk import, network pill, text scratchpad, workspace preferences, disputes with rulings and regrade diff, audit chain |
| P2 | Only after P0 and P1 are deployed and green | Scratchpad drawing, fairness blueprint (5.2), extra workspace options, Realtime nudges, PDF styling |

When time runs short, cut from the bottom of P1 upward. Never cut P0.

---

## 1. Final decisions (locked)

### 1.1 Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js (App Router) + TypeScript** | One repo, one deploy, API routes and UI together. Pin versions on day 0 and do not upgrade mid-event |
| Database | **PostgreSQL on Supabase (free plan), used as plain Postgres** | You already know it. Section 1.1a has the comparison and the guardrails |
| ORM | **Prisma** | Fast schema iteration, migrations, seed script. Pooled URL for the app, direct URL for migrations |
| Auth | **Custom session auth:** `bcryptjs` + signed JWT in an httpOnly cookie (`jose`) | Full control of three roles, explainable to judges. Not Supabase Auth (section 1.1a) |
| Validation | **Zod** (shared between frontend and backend) | Satisfies validate on both sides cheaply |
| Styling | **Tailwind CSS** + a small custom design-token layer | Fast, but customizable enough to avoid a template look |
| PDF | **pdf-lib** (pure JS, works on serverless) | No headless browser needed |
| QR | **qrcode** npm package | Generates a PNG buffer that pdf-lib embeds; offline and free |
| CSV | **papaparse** | Reliable parsing with error rows |
| Charts | **Recharts** | Quick analytics visuals |
| Hosting | **Vercel** (app) + **Supabase** (DB), regions chosen close together | Every autosave does a database round trip, so function-to-database latency matters more than user-to-function latency |

**Real-time strategy:** Polling (every 5 s for monitoring and announcements, every 15 s for autosave heartbeat). Vercel serverless has no persistent websockets, and polling is simpler to make reliable. If you are asked, say it was a deliberate trade-off.

### 1.1a Database choice: Supabase vs Neon

Use Supabase, as plain Postgres through Prisma. Neon is a close second, and the gap is small enough that your existing experience decides it: in a 10-hour build, a console you already know saves more time than any technical difference below. Figures are as of November 27, 2026.

| Factor | Supabase free plan | Neon free plan | Edge |
| --- | --- | --- | --- |
| Free limits | 2 active projects, 500 MB database, shared CPU, 500 MB RAM | 100 projects, 1 GB storage and 100 CU-hours a month per project | Neon on paper; a demo database is a few MB, so it does not matter |
| When idle | Pauses after a week of low activity | Scales to zero after 5 minutes of inactivity and wakes on the next connection | Neon: it recovers by itself |
| Your speed | Dashboard, SQL editor and connection strings already familiar | New console and connection settings to learn | Supabase, clearly |
| Prisma on Vercel | Pooled connection for the app, direct connection for migrations | Same pattern: the `-pooler` host for the app, the direct host for migrations | Tie |
| Tamper demo (Stage 11) | Table editor makes editing one audit row quick | SQL editor works but is less visual | Supabase, slightly |
| Backups | No automatic backups on the free plan | Instant restore window of 6 hours | Neon; the seed script covers us |
| Extras | Realtime, Auth and Storage included | Branching | Supabase has more, but this build uses none of them |

**Guardrails when you use Supabase**

1. **Pause risk.** A free project pauses after a week of low activity and must be restored by hand. Ask the organizers when judging happens. If it could be more than 6 days after your last activity, schedule a daily ping to `/api/health` (a Vercel Hobby cron may run once a day, set up before the deadline; confirm with the organizers that this is acceptable) and check the project shows Active on judging day.
2. **Use Supabase only as Postgres.** Skip Supabase Auth, Row Level Security and Storage. Judges grade backend authorization you can explain, and a second authorization layer (RLS) doubles what you must debug in 10 hours. Your own JWT session plus route guards stays in code you control and can test.
3. **Two connection strings.** Copy the pooled string and the direct string from the dashboard's Connect panel. The app uses the pooled one and `prisma migrate` uses the direct one. Test both in Stage 0.
4. **Realtime is P2, not a plan.** Polling every 5 seconds is enough and adds no failure modes. If time remains, a Realtime broadcast can nudge clients to refetch sooner.

**Pick Neon instead if** you have never used Prisma against Supabase's pooler, or you cannot confirm the judging date and want the database to recover from idle on its own.

Sources: [Supabase FAQ on free-plan limits](https://supabase.com/kb/faqs/platform/database-only-cost) and [Neon free-plan overview](https://neon.com/faqs/simplest-postgres-setup-for-startups), both opened. The backup rows come from search snippets of the vendors' plan pages, so recheck them before relying on them.

### 1.2 Innovation choice

- **Primary: 5.4 Trust & Dispute Resolution.** A full dispute workflow, question-level rulings with automatic regrade, append-only grade history and a hash-chained audit log.
- **Integration, not a second innovation:** the dispute evidence pack reuses the frozen paper, the connectivity and incident timeline, and the question-analytics suspect flag. This respects the rule that one implementation is not rewarded twice.
- **Stretch (P2): 5.2 Fairness.** Blueprint-based paper generation. Starts only after everything else is deployed and green.
- **Not pursued:** 5.1 (weak evidence, and incidents are already logged as indicators) and 5.3 (it overlaps the required refresh recovery and network indicator).

### 1.3 Policy decisions to hard-code now

Judges will test these. Decide once, document in the README.

1. **Multiple-select grading:** configurable per question, default **partial credit with penalty**: `score = max(0, (correctSelected − wrongSelected) / totalCorrect) × marks`. The alternative mode is all-or-nothing.
2. **Single MCQ:** full marks or zero (optional negative marking setting per exam).
3. **Written questions:** ungraded until the examiner grades them; the grade must be between 0 and the question marks.
4. **Deadline:** `deadline = min(startedAt + durationMinutes, exam.endTime)`. Server time only.
5. **Late save:** any answer arriving after the deadline plus a 3-second grace window is rejected. The attempt is finalized with answers accepted before that.
6. **Result visibility:** candidates see results only after the examiner publishes them.
7. **Rulings are an overlay, not an edit.** Snapshots never change. Grading takes the snapshot plus the exam's rulings (accepted alternate answers, voided questions) and computes the effective result. A regrade is a recomputation with the new rulings that appends new Grade rows.
8. **Audit scope.** The chain records privileged and score-changing events only: grade changes, publication, disputes, rulings and role changes. Never autosaves, incidents or routine reads.

---

## 2. Architecture

### 2.1 Folder structure

```
/prisma          schema.prisma, seed.ts
/src/lib         db.ts, auth.ts, session.ts, permissions.ts, time.ts, grading.ts,
                 attempts.ts (engine), audit.ts (hash chain), pdf.ts, verify.ts, validators/
/src/app/api     route handlers: thin. They validate, authorize, then call lib services
/src/app/(admin) (examiner) (candidate)   role-specific pages
/src/app/verify/[id]   public verification page (minimal data)
/src/components  design system + feature components
```

**Separation of responsibilities:** route handler = validate + authorize + call service. Business rules live in `lib/` services only. This is what you explain under "clear separation of responsibilities".

### 2.2 Authorization model (backend)

One reusable guard, used by every route:

- `requireRole(['EXAMINER'])`
- `requireExamOwner(examId)`: an examiner touches only exams they created (admin can view all)
- `requireEnrollment(examId)`: a candidate enters only enrolled exams
- `requireAttemptOwner(attemptId)`: a candidate touches only their own attempt

UI hiding is cosmetic. Every API test must be tried with the wrong role.

### 2.3 Data model (tables)

| Table | Purpose and key fields |
| --- | --- |
| `User` | id, name, email (unique), passwordHash, role (ADMIN/EXAMINER/CANDIDATE), isActive |
| `Exam` | id, ownerId, title, instructions, startTime, endTime, durationMin, totalMarks, **status (DRAFT or PUBLISHED, stored)**, publishedAt, shuffleQuestions, shuffleOptions, negativeMarking, resultsPublished. ONGOING and COMPLETED are computed from server time and never stored |
| `Question` | id, ownerId, topic, difficulty (EASY/MEDIUM/HARD), type (SINGLE/MULTI/WRITTEN), text, marks, multiMode, version |
| `Option` | id, questionId, text, isCorrect |
| `ExamQuestion` | examId, questionId, order, marksOverride |
| `Enrollment` | examId, candidateId, unique(examId, candidateId) |
| `Attempt` | id, examId, candidateId, isSandbox, **realKey** (`examId:candidateId` for real attempts, NULL for sandbox; unique, so Postgres allows many sandbox rows but only one real attempt), status (IN\_PROGRESS/SUBMITTED/AUTO\_SUBMITTED/GRADED), startedAt, deadlineAt, submittedAt, totalScore |
| `AttemptQuestion` | **Frozen snapshot:** attemptId, position, sourceQuestionId, textSnapshot, typeSnapshot, marksSnapshot, optionsSnapshot (JSON with shuffled order and correct flags, never sent to the client), multiModeSnapshot |
| `Answer` | attemptQuestionId (unique), selectedOptionIds (JSON), writtenText, markedForReview, revision (int), savedAt |
| `Grade` | attemptQuestionId, score, gradedBy (null = auto), rulingId (null unless caused by a ruling), reason, createdAt. **Append-only; latest row wins** |
| `Incident` | attemptId, type (TAB\_HIDDEN, BLUR, OFFLINE, PASTE, FULLSCREEN\_EXIT), at, detail |
| `Announcement` | examId, authorId, message, createdAt |
| `UserPref` | userId, JSON (workspace layout, font size, theme) |
| `Scratchpad` | attemptId, content, updatedAt |
| `Dispute` | id, attemptQuestionId, candidateId, category (GRADING\_ERROR/AMBIGUOUS/TECHNICAL), message, status (OPEN/UNDER\_REVIEW/UPHELD/REJECTED), resolution, resolvedBy |
| `QuestionRuling` | examId, sourceQuestionId, type (ACCEPT\_ALTERNATE/VOID\_QUESTION), detail JSON (the accepted option ids), reason, createdBy, createdAt |
| `AuditLog` | id (sequence), actorId, action, entity, entityId, payload, prevHash, hash, createdAt |
| `AuditHead` | One row: lastHash, lastId. Locked while an audit entry is written, so the chain cannot fork |
| `ReportToken` | id (random 128-bit), attemptId, scoreAtIssue, issuedAt, signature, supersededBy |

### 2.4 Exam lifecycle

```
DRAFT -> PUBLISHED -> ONGOING -> COMPLETED
```

- **Stored status is only DRAFT or PUBLISHED.** Publishing is the examiner action and is validated: at least 1 question, question marks sum to the exam total, a valid window, and a warning if no candidate is enrolled.
- **Displayed status is computed on every read** from server time: PUBLISHED before startTime is Upcoming, between startTime and endTime is ONGOING, after endTime is COMPLETED. One helper, `getExamStatus(exam, serverNow)`, is used everywhere, so the state can never drift.

### 2.5 Attempt lifecycle

```
(start) -> IN_PROGRESS -> SUBMITTED | AUTO_SUBMITTED -> GRADED
```

Every transition is a conditional update: `UPDATE attempt SET status='SUBMITTED' WHERE id=? AND status='IN_PROGRESS'`. If 0 rows change, the action was already done. Return the existing result, do not error. This is your duplicate-submission and double-grading protection.

---

## 3. Requirement coverage map

Use this as your tick-sheet. Nothing is optional.

| Area | Requirement | Built in stage |
| --- | --- | --- |
| 3.1 | Auth, 3 roles, admin user management, backend permissions | 1 |
| 3.2 | Exam CRUD, config, lifecycle, review before publish | 2 |
| 3.3 | Question bank, topics, difficulty, 3 types, randomization | 3 |
| 3.4 | Enrollment, candidate dashboard, access restrictions | 4 |
| 3.5 | Exam interface, autosave, refresh recovery, timer, auto-submit | 5 |
| 3.6 | Monitoring, incidents, announcements | 7 |
| 3.7 | Auto + manual grading, consistent scores | 6 |
| 3.8 | Publish results, candidate results, analytics, history | 8 |
| 4.1 | Network-aware interface | 5 |
| 4.2 | PDF reports | 9 |
| 4.3 | Sandbox | 10 |
| 4.4 | Bulk import | 3 |
| 4.5 | Question analytics | 8 |
| 4.6 | Verifiable reports | 9 |
| 4.7 | Customizable workspace | 5 |
| 4.8 | Digital scratchpad | 5 |
| 5.4 | Dispute resolution (innovation) | 11 |
| 5.2 | Fairness (P2 stretch) | 12 |

---

## 4. Build stages

### Stage 0: Foundation and early deploy (0:00 to 0:45)

**Build**

1. Create the Git repo and the Next.js + TypeScript + Tailwind project. Pin dependency versions. Commit.
2. Create the Supabase project in the nearest region offered. Copy both the pooled and the direct connection strings into `.env` as `DATABASE_URL` and `DIRECT_URL`.
3. Write the **full Prisma schema** from section 2.3. Run the migration using the direct URL.
4. Create the Vercel project, connect the repo, set the function region next to the database, and add env vars (`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `REPORT_SECRET`).
5. Create the design tokens: colors, type scale (pick one strong font pair), spacing, radius. Build 6 base components: Button, Input, Card, Badge, Modal, Table.
6. Write a `/api/health` route that queries the DB. The keepalive ping uses it too.
7. Write the API contracts (request and response shapes for attempt start, fetch paper, autosave and submit) in `docs/api.md`, so AI-generated handlers and screens stay consistent from hour 1.

**Check**

- Open the deployed URL and `/api/health`. It must return OK from the production DB.
- Everyone on the team can run the project locally.

**Done when:** a deployed app talks to a deployed database. Commit: `chore: foundation, schema, deploy`.

---

### Stage 1: Authentication and authorization (0:45 to 1:45)

**Build**

1. `register` is disabled publicly. Admin creates users. (One seeded admin to start.)
2. `login` verifies bcrypt hash, issues JWT in an httpOnly, secure, SameSite cookie. `logout` clears it.
3. `lib/permissions.ts` with `requireRole`, `requireExamOwner`, `requireEnrollment`, `requireAttemptOwner`.
4. Next.js middleware redirects unauthenticated users. Role-based redirect after login (admin, examiner, candidate dashboards).
5. Admin screen: list users, create user, change role, deactivate. Deactivated users cannot log in.
6. Seed: 1 admin, 2 examiners, 10 candidates, with known passwords.
7. Rate-limit login attempts (simple in-memory counter is fine, and say so).

**Check (the wrong-role test)**

- Logged in as candidate, call an examiner API with curl or the browser console. Expect **403**.
- Examiner A requests Examiner B's exam. Expect **403 or 404**.
- Deactivated user cannot log in, and an existing session stops working.
- Passwords are never present in any API response.

**Done when:** every role lands on its own empty dashboard and the wrong-role tests fail correctly. Commit: `feat: auth and rbac`.

---

### Stage 2: Exam management (1:45 to 2:30)

**Build**

1. Examiner exam list with status badges. Create / edit form: title, instructions, start, end, duration, total marks, shuffle toggles, negative marking.
2. Zod validation shared client and server: end after start, duration at most the window length, marks greater than 0.
3. Status derivation helper `getExamStatus(exam, serverNow)`.
4. Publish action with a pre-publish **review screen** (summary plus validation checklist).
5. Editing rules: after publish, block changes to marks, questions and time window (or show a warning and block once ONGOING).

**Check**

- Create a draft and confirm candidates cannot see it.
- Publish with zero questions. It must be refused with a clear message.
- Change the system clock on your laptop. The status must not change (server decides).

**Done when:** the full draft to published flow works with validation. Commit: `feat: exam management`.

---

### Stage 3: Question bank, import and exam assembly (2:30 to 3:30)

**Build**

1. Question bank page: filter by topic and difficulty, create / edit questions of three types. Options editor with correct-answer toggles. Written questions have max marks.
2. Validation: a SINGLE question must have exactly 1 correct option, a MULTI question at least 1, a question has at least 2 options, marks must be greater than 0.
3. Versioning: editing a question increments `version`. This is not allowed to touch already-started attempts, which will be guaranteed in Stage 5 by snapshots.
4. Assign questions to an exam (picker with search, reorder, marks override). Show running total vs the exam total marks.
5. **Bulk import (4.4):** upload CSV or JSON for questions, and the same importer pattern for candidates in Stage 4. The importer validates each row, returns a report: `{ imported: n, failed: [{row, field, message}] }`. Import valid rows, show a table of rejected rows with reasons. Provide a downloadable sample file.

**Check**

- Import a file with 8 valid rows and 3 deliberately broken rows (missing correct answer, bad difficulty, empty text). Exactly 8 land and the 3 errors name the row and reason.
- Try to publish an exam whose question marks do not sum to the exam total. It must be flagged.

**Done when:** you can build a complete 10-question exam from imported data. Commit: `feat: question bank and import`.

---

### Stage 4: Candidate management and candidate dashboard (3:30 to 4:00)

**Build**

1. Enrollment screen: add existing candidates by search, or import a CSV (`name,email`). The import **creates missing candidate accounts** with generated one-time passwords, enrolls everyone, and offers a credentials CSV to download once. Invalid or duplicate rows are listed with the reason, never silently skipped. Reuse the Stage 3 importer. Show an enrollment table.
2. Candidate dashboard with three tabs: **Upcoming, Available now, Completed**. Each card shows instructions summary, window, duration and an access status (Not open yet / Open / Closed / Submitted).
3. Server-side entry rule: `POST /api/attempts/start` checks the role, the enrollment, status PUBLISHED, and that server time is inside the window.

**Check**

- A non-enrolled candidate calling start directly gets 403.
- Start one minute before the window opens, which is refused. Start after the window closes, which is refused.
- Enrollment table counts match the database.

**Done when:** the candidate sees accurate exam states and can only start eligible exams. Commit: `feat: enrollment and candidate dashboard`.

---

### Stage 5: The attempt engine and exam interface (4:00 to 6:15). **The most important stage**

**Build, backend first**

1. **Start:** in one transaction, look up the candidate's real attempt by `realKey = examId:candidateId`. If it exists and is IN\_PROGRESS, return it (this is refresh recovery). If it exists and is finished, refuse. Otherwise create the attempt with `deadlineAt = min(now + duration, exam.endTime)` and its `AttemptQuestion` snapshots: shuffled question order and options if enabled; text, marks and correct flags frozen. Two simultaneous starts must end as one attempt: the unique `realKey` guarantees it, so catch the unique violation and return the existing attempt.
2. **Fetch paper:** returns questions and options **without `isCorrect`**. Also returns `serverNow` and `deadlineAt` so the client computes remaining time as an offset from server time, not from the device clock.
3. **Autosave:** `PUT /answers` with `{attemptQuestionId, selected, text, markedForReview, revision}`. The server rejects if status is not IN\_PROGRESS or now is past the deadline plus grace, ignores a write with an older `revision` (idempotent), and returns `{ok, serverNow, deadlineAt}`.
4. **Submit:** conditional transition. A second call returns the existing result. Triggers auto-grading (Stage 6 function).
5. **Finalization without a scheduler.** Any read or write on an attempt past its deadline finalizes it as AUTO\_SUBMITTED and grades it. Add `finalizeExpired(examId)` and call it whenever the examiner opens the monitor, results, analytics or candidate list. Do not depend on cron: a Vercel Hobby cron runs at most once a day, with timing only within the hour.

**Build, frontend**

1. Exam workspace: question panel, navigator grid (colors: answered / unanswered / marked), marks display, prev/next, mark for review, submit with a review summary confirmation.
2. Countdown timer driven by the server offset. Re-syncs on every autosave response. Warning colors at 5 min and 1 min. Auto-submit call at zero (the server decides regardless).
3. **Autosave with a local queue:** on every change, debounce 500 ms, write to a `localStorage` outbox, send. If the request fails, retry with backoff, and the outbox replays when the connection returns. Never lose a keystroke.
4. **Network-aware interface (4.1):** a persistent status pill with four states: *Saved*, *Saving...*, *Offline, answers stored locally*, *Reconnecting...*. Use `navigator.onLine` plus real request failures. Offline events are logged as incidents when reconnected.
5. **Digital scratchpad (4.8):** a side panel with a text area (optionally a simple drawing canvas). Autosaves to the `Scratchpad` table through the same debounced pipeline. It is never graded.
6. **Customizable workspace (4.7):** font size, theme (light/dark), layout (navigator left or right, single or split pane), scratchpad dock position. Saved to `UserPref` on the server and cached locally. Reapplied on load.
7. Incident capture hooks: visibility change, window blur, paste events, fullscreen exit. Each sends a lightweight `POST /incidents`. Wording in the UI must say "recorded events", never "cheating".

**Check (the judge tests; do all of them)**

- Answer 3 questions, hard-refresh. Answers and the correct remaining time are back.
- Open the same attempt in two tabs. There must be exactly one attempt and no duplicates.
- Set your laptop clock one hour forward or back. The remaining time must not change.
- Turn on DevTools offline mode, answer 2 questions, turn it back on. The pill goes Offline then Saved, and both answers are on the server.
- Click Submit three times quickly, and fire the request twice from the console. One submission, one grade.
- Let the timer expire and do nothing. The attempt is AUTO\_SUBMITTED with the previously saved answers.
- Send an answer to the API after the deadline using curl. It is rejected.
- Edit a question in the bank mid-attempt. The running attempt is unchanged.
- Inspect the paper response in the Network tab. No correct-answer flags anywhere.

**Done when:** every check above passes. Commit: `feat: attempt engine and exam workspace`.

**Automate the checks.** Turn the API-level checks above into `scripts/integrity-check.ts`, a plain Node script that calls the API: double submit, late save, wrong-role calls, two simultaneous starts, and a scan of the paper response for correct-answer flags. Run it against production after every deploy. It is your fastest regression test and a strong answer to how you know it works.

---

### Stage 6: Grading engine and manual grading (6:15 to 6:50)

**Build**

1. `lib/grading.ts`: pure functions, unit-testable, working from the frozen snapshot only (never the live question bank). The entry point is `gradeQuestion(snapshot, answer, rulings)`. The `rulings` argument is empty until Stage 11, but build and unit-test every branch now:
   - SINGLE: correct = full marks, wrong = 0 (or negative if enabled), unanswered = 0.
   - MULTI: formula from section 1.3, or all-or-nothing by setting.
   - WRITTEN: pending until graded.
   - ACCEPT\_ALTERNATE: the accepted option counts as correct. VOID\_QUESTION: full marks to every candidate who was given the question.
2. Auto-grade on finalize, writing `Grade` rows (gradedBy = null).
3. Manual grading screen: the examiner sees the list of written answers per exam, scores with validation (0 to marks), optional feedback. Each save inserts a new `Grade` row (append-only) and writes an audit log entry.
4. Total score = sum of the latest grade per question. Attempt status becomes GRADED when no written answers are pending.
5. Examiner results review table (before publishing): candidate, objective score, written score, total, status.

**Check**

- Hand-calculate a 5-question attempt, including one multi-select with a partially correct answer, and compare to the system.
- Grade a written answer with a score above its marks. It is rejected on both client and server.
- Re-grade the same answer. There are two Grade rows, and the total uses the newest one.
- Write at least 4 unit tests for the multi-select cases (all correct, partial, one wrong, none).

**Done when:** scores are provably correct and consistent. Commit: `feat: grading engine`.

---

### Stage 7: Monitoring and announcements (6:50 to 7:30)

**Build**

1. Examiner live monitor, polling every 5 s: table of attempts with candidate, status, progress (answered / total), time remaining, last activity, incident count.
2. Incident timeline drawer per attempt, with a visible disclaimer: *"These are automated indicators and are not evidence of misconduct."* No auto-penalty.
3. Announcements: the examiner posts a message. Candidates poll every 10 s and see a toast plus a persistent announcement tray.
4. Exam status banner (time to start, running, ended).

**Check**

- Run two candidate browsers and one examiner browser. Progress and incidents appear within about 5 s.
- Post an announcement and see it on both candidate screens.
- A candidate cannot read another candidate's incident list or the monitor API (403).

**Done when:** a live exam can be watched end to end. Commit: `feat: monitoring and announcements`.

---

### Stage 8: Results, publication, analytics (7:30 to 8:15)

**Build**

1. **Controlled publication:** `resultsPublished` toggle on the exam, with a confirmation modal showing how many results are pending manual grading. Block publishing while written grading is incomplete (or require an explicit override).
2. Candidate results page: score, per-question breakdown with their answer, the correct answer and marks, only after publication and only their own.
3. Examiner analytics: average, median, highest and lowest, a score-distribution histogram, pass rate, and average time taken.
4. **Question analytics (4.5):** per question: percentage correct, skip rate, most-chosen wrong option (distractor analysis), and a difficulty index (stated vs observed). Flag suspect questions (for example, under 15 percent correct or one distractor chosen more than the correct answer). **The suspect flag feeds the dispute flow in Stage 11.**
5. **Attempt review page:** examiner and admin open any completed, non-sandbox attempt and see the frozen paper, the candidate's answers, the grades and the incident timeline. This meets the retain-and-review requirement and is the base of the dispute evidence pack.
6. **Admin operations view (P2 when solo):** counts of users, exams and attempts, plus recent audit entries (the integrity check button arrives in Stage 11).
7. **Sandbox attempts excluded** from every query (use one shared `realAttempts()` helper so nothing is missed).

**Check**

- Run 5 candidates with different answers, then compare the dashboard figures with a manual spreadsheet. They must match.
- Candidate A cannot open candidate B's result URL.
- Before publication, the candidate sees "Results not yet published".

**Done when:** analytics are computed from real data and publication is gated. Commit: `feat: results and analytics`.

---

### Stage 9: PDF reports and verifiable reports (8:15 to 8:45)

**Build**

1. On results publication or request, create a `ReportToken` with a random 128-bit ID and an HMAC signature over the attempt id, score and issue date.
2. PDF with pdf-lib: exam title, candidate name, score, percentage, per-section breakdown, issue date, verification ID, and a **QR code** linking to `/verify/{id}`. Two report types: candidate result report (candidate or examiner or admin, access controlled) and exam summary report (examiner or admin only).
3. Public `/verify/[id]` page, which needs no login and shows **minimal data only**: Valid / Not found / Superseded, exam title, issue date, score band (for example "70 to 80%") and a masked name (such as "A\*\*\* K\*\*\*"). No email, no ID number.
4. Supersession: if a regrade changes the score, the old token is marked superseded and the verify page says so. This also shows off the dispute system.

**Check**

- Download the PDF, scan the QR with a phone, and the verify page loads.
- Alter one character in the verification ID. It shows Not found.
- Open another candidate's report URL while logged in as a candidate. It is refused.
- Confirm that the verify page's network response contains no email.

**Done when:** the PDF is readable and verification works end to end. Commit: `feat: pdf reports and verification`.

---

### Stage 10: Examination sandbox (8:45 to 9:05)

**Build**

1. "Preview as candidate" button on the examiner's exam page. It creates an `Attempt` with `isSandbox = true` that **skips the enrollment and window checks** (only for the owner) and uses a frozen snapshot like a real attempt.
2. A visible banner: *"Sandbox mode. Nothing is saved to real results."*
3. Sandbox attempts can be reset and restarted. They are never counted in the monitor, analytics, exports or publication.

**Check**

- Take a sandbox attempt. The real analytics, results table, monitor and PDF summaries are unchanged.
- Candidates cannot use the sandbox endpoint (403).

**Done when:** an examiner can experience the exam with zero side effects. Commit: `feat: sandbox`.

---

### Stage 11: Innovation. Trust and Dispute Resolution (9:05 to 10:00)

**Why this is the differentiator:** every platform grades. Very few can *prove* a grade is right, or fix a bad question fairly for everyone.

**Build**

1. **Append-only audit chain.** Each `AuditLog` row stores `hash = SHA256(prevHash + actor + action + entity + payload + timestamp)`. Write every entry inside a transaction that first takes `pg_advisory_xact_lock` (or locks the single `AuditHead` row), reads the true latest hash, inserts, and updates the head. Without the lock, two simultaneous writes can read the same previous hash and fork the chain. Log only privileged and score-changing events (policy 8). Add an examiner or admin **Verify integrity** button that recomputes the chain and shows OK or the first broken row.
2. **Candidate dispute screen.** After results are published, the candidate can open a dispute on a question: category (Grading error / Ambiguous question / Technical incident) plus a message. The candidate sees their own **evidence pack**: their frozen question and options, their answer, the marks awarded, and their event timeline (offline periods, save failures).
3. **Examiner dispute queue.** Each case shows the same evidence, a note field, and decisions: **Reject** (with a reason), **Uphold: re-grade this candidate**, or **Question ruling** (below).
4. **Question-level rulings** (the strong demo moment). For an ambiguous question the examiner chooses *Accept alternate answer* (mark additional option(s) as correct) or *Void question* (everyone gets the marks). The system stores the ruling, then **regrades every affected attempt** by recomputing from snapshots plus rulings with the Stage 6 grader, inserting new append-only `Grade` rows in one transaction, and shows a **before/after diff table** (candidate, old score, new score, delta). Every change is attributed in the audit log with the reason.
5. **Integrity of results:** old grades are never edited or deleted, and a ruling is its own row that never touches a snapshot. Superseded report tokens are flagged (Stage 9).
6. **Candidate-facing transparency:** a grade history panel on the result page: Original 42, regraded to 45 on ruling #3, reason: ambiguous wording.
7. Status tracking: a disputing candidate sees the status change (Open to Under review to Upheld / Rejected) plus the examiner's resolution note.

**Check**

- Candidate disputes a question, and the examiner rejects it with a reason. The candidate sees the reason and the score is unchanged.
- The examiner issues an Accept-alternate ruling affecting 6 attempts. All 6 are regraded, the diff table is correct and each total recalculates correctly.
- The old grade rows still exist. Candidates see the history.
- Tamper with one audit row directly in the database, then run Verify integrity. It names the broken row.
- Candidate B cannot see candidate A's dispute.

**Done when:** a dispute can travel from filing to ruling to regrade to audit verification. Commit: `feat: dispute resolution and audit chain`.

---

### Stage 12 (P2 stretch, only after everything else is deployed and green): Fairness add-on

Do this *only* with spare time. A half-working add-on scores worse than none.

**Build:** a paper blueprint on the exam (for example: 3 easy + 4 medium + 3 hard, split by topic). At attempt start, draw questions per slot from the bank so every paper has the same difficulty profile. Show a **fairness panel** for the examiner: sample 50 generated papers and display the spread of total expected difficulty (target: low variance).

**Check:** two candidates' papers differ in questions but have an identical difficulty distribution.

---

### Stage 13: Polish, data, README (parallel, final hour)

Polish is not a last-hour job. Schedule one person on it from Stage 4 onwards and finish with a full pass.

**UI/UX checklist (20 marks)**

- One consistent design language: tokens, one type pairing, consistent spacing and radius.
- Role-specific dashboards with clear primary actions, not generic card grids.
- Empty states, loading skeletons and error states on every list.
- Mobile-responsive candidate flows (check the exam workspace at 390 px width).
- Accessibility: visible focus rings, keyboard navigation in the exam (arrow keys or N/P for next/previous), aria labels, contrast, never color alone for question states (use icons or shapes too).
- Toasts for every success and failure.

**Seed data for the demo**

- 1 admin, 2 examiners, 15 candidates, 30 questions across 4 topics and 3 difficulties.
- One COMPLETED exam with 15 graded attempts (so analytics look real).
- One ONGOING exam with 2 active attempts.
- One PUBLISHED upcoming exam.
- At least one deliberately ambiguous question with a poor distractor pattern, ready for the dispute demo.
- Provide a **reset-demo-data** script.

**README must include:** setup steps, env vars, test credentials for each role, architecture summary, the grading policy, the timing policy, and a section on the innovation (what, why, how, trade-offs).

**Freeze:** Do not push after the deadline. Do the final deploy early and test the production URL, not localhost.

---

## 5. Time plan at a glance

You are solo, so the plan is one sequence of time-boxed slots, 10 hours in total with no slack. Every slot has a hard stop: at the stop, ship what works, write the gap under Known limitations in the README, and move on. Polish is built in as you go with one design system, not saved for the end.

| Slot | Time | Build (stage) | Exit gate |
| --- | --- | --- | --- |
| 1 | 0:00 to 0:30 | Foundation: repo, Supabase, schema, deploy, health route, design tokens (Stage 0) | Deployed app reads the production database |
| 2 | 0:30 to 1:15 | Auth, guards, user admin, seed data (Stage 1) | Wrong-role tests fail correctly |
| 3 | 1:15 to 2:15 | Exams, question bank, assembly, question import (Stages 2 and 3) | A 10-question exam built from an imported file |
| 4 | 2:15 to 2:45 | Enrollment, candidate import, candidate dashboard (Stage 4) | Access rules enforced |
| 5 | 2:45 to 4:00 | Attempt engine backend plus the integrity script (Stage 5, backend) | **Checkpoint 1:** the script passes locally and on production |
| 6 | 4:00 to 5:15 | Exam workspace UI, timer, autosave queue, network pill (Stage 5, UI) | Refresh, offline and expiry tests pass in the browser |
| 7 | 5:15 to 6:00 | Grading, manual grading, publication, candidate results (Stages 6 and 8) | Hand-calculated scores match |
| 8 | 6:00 to 6:30 | Monitor, announcements, incidents (Stage 7) | A live attempt appears within 5 seconds |
| 9 | 6:30 to 7:00 | Analytics and question analytics (Stage 8) | Numbers match a manual spreadsheet |
| 10 | 7:00 to 7:30 | Scratchpad, preferences, sandbox (Stages 5 and 10) | Sandbox leaves real statistics untouched |
| 11 | 7:30 to 8:00 | PDF reports and verify page (Stage 9) | **Checkpoint 2:** QR scan opens the verify page, and everything except disputes works on production |
| 12 | 8:00 to 9:15 | Disputes, rulings, regrade diff, audit chain (Stage 11) | The full dispute demo works |
| 13 | 9:15 to 10:00 | Freeze: demo seed data, README, polish, final deploy, rehearsal | The section 9 checklist is green |

### Checkpoints and cut line

- **Checkpoint 1 (hour 4):** the attempt engine passes the integrity script. If not, stop everything else until it does; this is the core of the grade.
- **Checkpoint 2 (hour 8):** everything except disputes works on production.
- **Feature freeze (hour 9:15):** only seed data, README, bug fixes and rehearsal.
- **Cut order if behind, earliest first:** P2 items; the admin operations view; workspace options beyond font size, theme and navigator side; the histogram chart (keep the tables); the exam summary PDF (keep the candidate report); the hash-chain verify button (fall back to a plain append-only audit table).
- **Never cut:** P0, the integrity script, or the question ruling with regrade diff.

**Solo scope: the minimum version of each feature that still counts as working**

| Feature | Solo version |
| --- | --- |
| Workspace customization | Font size, theme and navigator side, saved to the server and reapplied on load |
| Scratchpad | A text area autosaved with the attempt; no drawing canvas |
| Incidents | Tab hidden, window blur, offline and online, paste |
| Monitor | Polling table with progress, time left and incident count |
| Analytics | Summary statistics, one histogram, question analytics as a table with flags |
| PDF | Candidate report with QR code, plus a plain exam summary |
| Sandbox | A flagged attempt on the same engine, with a banner and a reset button |
| Bulk import | CSV for questions and candidates, JSON for questions, with an error report |
| Admin | User list, create, change role, deactivate; no operations dashboard |
| Attempt review | One read-only page, reused as the dispute evidence pack |
| Disputes | File, queue, reject or uphold with single regrade, question ruling with diff |
| Audit | Hash chain with lock and verify button; logs only grade changes, publication, disputes and rulings |
| Fairness (5.2) | Not attempted |

---

## 6. Solo working rules

- **Follow the slot order in section 5**, not the stage numbers. Stages 5, 8 and 10 are split across slots.
- **Use AI assistance per slot.** Paste the stage's Build and Check lists as the prompt, ask for the tests first, and run the Check list yourself. Never assume generated code works.
- **Deploy and commit at the end of every slot.** From slot 5 on, run the integrity script against production each time.
- **One UI kit from slot 1.** Tailwind plus an open-source component set such as shadcn/ui gives dialogs, tables, tabs and toasts quickly. Retheme it with your own tokens and type pairing so it does not read as a template.
- **One examiner workspace page per exam with tabs** (Questions, Candidates, Monitor, Grading, Results, Analytics, Disputes) instead of many routes. It is faster to build and easier to demo.
- **Stay on one demo dataset** so every screen, report and test uses the same seeded exam.

Writing the API contracts in `docs/api.md` in slot 1 still pays off solo: it keeps AI-generated handlers and screens consistent with each other.

---

## 7. 15-minute demo script

| Min | Segment |
| --- | --- |
| 0:00 to 1:00 | One-line pitch: "An exam platform where every grade can be defended." Show the 3 roles. |
| 1:00 to 3:00 | Examiner creates and publishes an exam using imported questions. Show sandbox preview. |
| 3:00 to 6:30 | Candidate takes the exam: refresh recovery, offline mode with the status pill, scratchpad, preferences, auto-submit on timer. The examiner monitors live and sends an announcement. |
| 6:30 to 8:00 | Manual grading, publication, analytics and question analytics (point at the suspect question). |
| 8:00 to 12:00 | **Innovation:** the candidate disputes the ambiguous question. The examiner issues a ruling. Show the regrade diff for all affected candidates, the candidate's grade history, the audit chain Verify button, and the tampering demo. |
| 12:00 to 13:00 | PDF report plus QR verification on a phone. |
| 13:00 to 15:00 | Architecture slide and Q&A. |

**Demo safety**

- Open every role's dashboard 5 minutes before you present, so the database and the app are warm.
- Keep one browser profile per role, already logged in, and a phone ready for the QR scan.
- Run the reset-demo-data script before you start, never during the demo.
- Record a screen capture of the full flow as a fallback for venue Wi-Fi failure, and keep a local build running on a laptop as a second fallback.
- Keep the database dashboard open on the audit table for the tampering moment.

---

## 8. Likely judge questions and answers

- **How is the timer enforced if I change my system clock?** The server stores `deadlineAt`. The client only displays a countdown from the server offset. Late writes are rejected on the server.
- **What if I double-click Submit?** The submit is a conditional state transition (`WHERE status='IN_PROGRESS'`), so only one request succeeds and the rest return the stored result.
- **What if the question is edited mid-exam?** Each attempt stores a frozen snapshot of text, options and marks. Edits create a new version and never reach active attempts.
- **What if my internet drops?** Answers go to a local outbox and replay with revision numbers when the connection returns. The deadline does not extend, so there is no unfair advantage.
- **How do you know the audit log was not tampered with?** Each entry's hash includes the previous entry's hash, and a verification routine recomputes the chain. Honest limitation: someone with full DB access could rewrite the whole chain, and the mitigation is to anchor the latest hash externally.
- **Why polling rather than websockets?** Serverless hosting has no persistent connections, and a 5-second poll is sufficient for monitoring and far simpler to make reliable.
- **Are tab-switch alerts proof of cheating?** No. They are indicators, shown with a disclaimer, with no automatic penalty, which is what the problem statement requires.
- **What does the verify page expose?** Only validity, exam title, date, score band and a masked name.

**More questions to rehearse**

- **Why Supabase, and why not Supabase Auth?** We use it as managed Postgres. Our own JWT sessions and route guards keep all authorization in code we can explain and test; Row Level Security would add a second layer to debug.
- **Can two simultaneous starts create two attempts?** No. The unique `realKey` allows one real attempt per candidate and exam, and the losing request returns the existing attempt.
- **Can the audit chain fork under concurrent writes?** No. Each entry is written in a transaction holding an advisory lock, so it always reads the true latest hash.
- **Why a ruling overlay instead of editing the question?** Snapshots stay immutable so history is provable. A regrade is recomputed from the snapshot plus the rulings, and old grades remain.
- **What if the free database pauses?** Free Supabase projects pause after a week of low activity, so we confirmed the judging date and run a daily health ping.

---

## 9. Pre-submission checklist

- [ ] Production URL works for all three roles with the README credentials
- [ ] Every Stage check re-run on production, not localhost
- [ ] No correct answers visible in any candidate-facing response
- [ ] Sandbox excluded from every stat and export
- [ ] Seed or reset script reproduces the demo state
- [ ] Clean Git history with staged, meaningful commits
- [ ] README complete, including the innovation explanation and grading and timing policies
- [ ] No required feature depends on a paid service
- [ ] Final push done before the deadline, with nothing after

* [ ] Database project shows Active, and the health ping is scheduled (or the judging date is confirmed within a week)
* [ ] Pooled and direct connection strings both work, and production uses the pooled one
* [ ] `scripts/integrity-check.ts` passes against the production URL

---

**Next step:** tell me your team size and who is strongest at what, and I will adjust the split. Then begin Stage 0, and tell me when you reach it. I will give you the exact Prisma schema and project setup commands for that stage.
