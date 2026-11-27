# ProctorOS API Contracts

Locked request/response shapes for Stage 0 through Stage 11 so route handlers and frontend clients stay consistent.

All protected endpoints read the signed `httpOnly` JWT session cookie and enforce backend guards (`requireRole`, `requireExamOwner`, `requireEnrollment`, `requireAttemptOwner`). Passwords and `isCorrect` flags on candidate-facing endpoints are **never** returned.

---

## 1. Health Check

### `GET /api/health`
Queries PostgreSQL (`SELECT 1`) and returns current server time. Used by Vercel / external keepalive pings.

**Response `200 OK`**
```json
{
  "ok": true,
  "db": "connected",
  "serverNow": "2026-11-27T07:45:00.000Z"
}
```
**Response `503 Service Unavailable`**
```json
{
  "ok": false,
  "db": "error",
  "error": "Database unreachable"
}
```

---

## 2. Authentication (Stage 1)

### `POST /api/auth/login`
**Request**
```json
{
  "email": "candidate1@proctoros.local",
  "password": "Password123!"
}
```
**Response `200 OK`** *(sets `httpOnly`, `secure`, `SameSite=Lax` cookie)*
```json
{
  "user": {
    "id": "usr_...",
    "name": "Candidate One",
    "email": "candidate1@proctoros.local",
    "role": "CANDIDATE"
  }
}
```
**Errors:** `401` invalid credentials, `403` account deactivated, `429` rate limit exceeded.

### `POST /api/auth/logout`
Clears session cookie. Returns `{ "ok": true }`.

---

## 3. Attempt Engine (Stage 5)

### `POST /api/attempts/start`
Creates or resumes a candidate's real attempt (or an examiner's `isSandbox = true` preview attempt). Uses `realKey = "${examId}:${candidateId}"` (unique when not sandbox) inside a transaction to prevent duplicate starts.

**Request**
```json
{
  "examId": "exm_...",
  "isSandbox": false
}
```
**Response `200 OK`**
```json
{
  "attempt": {
    "id": "att_...",
    "examId": "exm_...",
    "status": "IN_PROGRESS",
    "isSandbox": false,
    "startedAt": "2026-11-27T08:00:00.000Z",
    "deadlineAt": "2026-11-27T08:45:00.000Z"
  },
  "serverNow": "2026-11-27T08:00:01.120Z"
}
```
**Errors:** `403` not enrolled or sandbox requested by non-owner/non-examiner, `409` exam not open or real attempt already submitted.

---

### `GET /api/attempts/[id]/paper`
Returns the frozen `AttemptQuestion` snapshot, existing `Answer` state, `Scratchpad` content, and server clock anchors. **Never includes `isCorrect` inside `optionsSnapshot`.** If `serverNow > deadlineAt`, lazily finalizes as `AUTO_SUBMITTED` first.

**Response `200 OK`**
```json
{
  "attempt": {
    "id": "att_...",
    "examId": "exm_...",
    "examTitle": "CS-301 Midterm Assessment",
    "status": "IN_PROGRESS",
    "isSandbox": false,
    "startedAt": "2026-11-27T08:00:00.000Z",
    "deadlineAt": "2026-11-27T08:45:00.000Z"
  },
  "serverNow": "2026-11-27T08:02:10.000Z",
  "questions": [
    {
      "attemptQuestionId": "aq_...",
      "position": 1,
      "type": "SINGLE",
      "marks": 2,
      "text": "Which isolation level prevents phantom reads?",
      "options": [
        { "id": "opt_1", "text": "Read Committed" },
        { "id": "opt_2", "text": "Serializable" }
      ],
      "answer": {
        "selectedOptionIds": ["opt_2"],
        "writtenText": null,
        "markedForReview": false,
        "revision": 3,
        "savedAt": "2026-11-27T08:02:05.000Z"
      }
    }
  ],
  "scratchpad": {
    "content": "Check edge cases for serializable vs repeatable read",
    "updatedAt": "2026-11-27T08:02:00.000Z"
  }
}
```

---

### `PUT /api/attempts/[id]/answers`
Idempotent debounced autosave. Rejects writes if status is not `IN_PROGRESS` or `serverNow > deadlineAt + 3s` grace window (finalizing as `AUTO_SUBMITTED`). Ignores writes whose `revision <= current.revision`.

**Request**
```json
{
  "attemptQuestionId": "aq_...",
  "selectedOptionIds": ["opt_2"],
  "writtenText": null,
  "markedForReview": true,
  "revision": 4
}
```
**Response `200 OK`**
```json
{
  "ok": true,
  "ignored": false,
  "revision": 4,
  "savedAt": "2026-11-27T08:03:12.400Z",
  "serverNow": "2026-11-27T08:03:12.410Z",
  "deadlineAt": "2026-11-27T08:45:00.000Z"
}
```
**Errors:** `409` attempt already submitted/expired (`code: "ATTEMPT_FINALIZED"`).

---

### `PUT /api/attempts/[id]/scratchpad`
Saves candidate notes (never graded). Rejects after attempt is finalized.

**Request**
```json
{
  "content": "Rough calculation: 2^10 = 1024"
}
```
**Response `200 OK`**
```json
{
  "ok": true,
  "updatedAt": "2026-11-27T08:04:00.000Z"
}
```

---

### `POST /api/attempts/[id]/incidents`
Logs lightweight client telemetry (`TAB_HIDDEN`, `BLUR`, `OFFLINE`, `PASTE`, `FULLSCREEN_EXIT`). Never applies automatic penalties.

**Request**
```json
{
  "type": "OFFLINE",
  "detail": "Navigator went offline for 14s"
}
```
**Response `201 Created`**
```json
{
  "ok": true,
  "id": "inc_..."
}
```

---

### `POST /api/attempts/[id]/submit`
Conditional transition (`WHERE status = 'IN_PROGRESS'`). Duplicate calls return the stored submission result instead of failing. Triggers auto-grading (`Grade` rows with `gradedBy = null`).

**Response `200 OK`**
```json
{
  "ok": true,
  "alreadySubmitted": false,
  "attempt": {
    "id": "att_...",
    "status": "SUBMITTED",
    "submittedAt": "2026-11-27T08:41:00.000Z"
  }
}
```

---

## 4. Verification & Rulings (Stages 9 & 11)

### `GET /api/verify/[token]` (Public)
Exposes minimal verification metadata only (never email, never student ID).

**Response `200 OK`**
```json
{
  "status": "VALID",
  "examTitle": "CS-301 Midterm Assessment",
  "issuedAt": "2026-11-27T10:00:00.000Z",
  "scoreBand": "90 to 100%",
  "maskedName": "A*** T***"
}
```
Possible `status` values: `"VALID" | "SUPERSEDED" | "NOT_FOUND"`.
