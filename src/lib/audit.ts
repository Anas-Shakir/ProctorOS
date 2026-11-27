import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const AUDIT_ADVISORY_LOCK_KEY = 948271635;
export const AUDIT_GENESIS_HASH = "GENESIS";

function normalizeJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== undefined) {
      sorted[key] = normalizeJsonValue(obj[key]);
    }
  }
  return sorted;
}

/** Deterministic canonical JSON stringifier safe across Postgres Json round-trips. */
export function stableAuditStringify(value: unknown): string {
  const plain = JSON.parse(JSON.stringify(value ?? {}));
  return JSON.stringify(normalizeJsonValue(plain));
}

export interface AuditHashInput {
  prevHash: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  payload: unknown;
  timestampIso: string;
}

export function computeAuditHash(input: AuditHashInput): string {
  const raw = [
    input.prevHash,
    input.actorId ?? "SYSTEM",
    input.action,
    input.entity,
    input.entityId,
    stableAuditStringify(input.payload),
    input.timestampIso,
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface AppendAuditInput {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  payload: unknown;
}

/**
 * Append a hash-chained row to AuditLog inside an active Prisma transaction.
 * Acquires a transaction-scoped Postgres advisory lock first so concurrent
 * transactions serialize around AuditHead and never fork the chain.
 */
export async function appendAuditLog(
  tx: Prisma.TransactionClient,
  input: AppendAuditInput,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_ADVISORY_LOCK_KEY})`;

  let head = await tx.auditHead.findUnique({ where: { id: 1 } });
  if (!head) {
    const latest = await tx.auditLog.findFirst({
      orderBy: { id: "desc" },
      select: { id: true, hash: true },
    });
    head = await tx.auditHead.create({
      data: {
        id: 1,
        lastHash: latest?.hash ?? AUDIT_GENESIS_HASH,
        lastId: latest?.id ?? 0,
      },
    });
  }

  const prevHash = head.lastHash;
  const createdAt = new Date();
  const normalizedPayload = JSON.parse(
    JSON.stringify(normalizeJsonValue(input.payload ?? {})),
  ) as Prisma.InputJsonValue;

  const hash = computeAuditHash({
    prevHash,
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    payload: normalizedPayload,
    timestampIso: createdAt.toISOString(),
  });

  const entry = await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      payload: normalizedPayload,
      prevHash,
      hash,
      createdAt,
    },
  });

  await tx.auditHead.update({
    where: { id: 1 },
    data: {
      lastHash: hash,
      lastId: entry.id,
    },
  });

  return entry;
}

export interface AuditVerifyResult {
  ok: boolean;
  totalChecked: number;
  headHash: string;
  lastId: number;
  verifiedAt: string;
  brokenRow?: {
    id: number;
    action: string;
    entity: string;
    entityId: string;
    reason: string;
  };
}

/**
 * Recompute every entry's SHA-256 hash sequentially from GENESIS and compare
 * against stored prevHash/hash and AuditHead.
 */
export async function verifyAuditChain(): Promise<AuditVerifyResult> {
  const [rows, head] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { id: "asc" },
    }),
    db.auditHead.findUnique({ where: { id: 1 } }),
  ]);

  let expectedPrev = AUDIT_GENESIS_HASH;
  let lastId = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    lastId = row.id;

    if (row.prevHash !== expectedPrev) {
      return {
        ok: false,
        totalChecked: i + 1,
        headHash: head?.lastHash ?? expectedPrev,
        lastId: head?.lastId ?? row.id,
        verifiedAt: new Date().toISOString(),
        brokenRow: {
          id: row.id,
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          reason: `Previous hash link mismatch at row #${row.id}`,
        },
      };
    }

    const recomputed = computeAuditHash({
      prevHash: row.prevHash,
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      payload: row.payload,
      timestampIso: row.createdAt.toISOString(),
    });

    if (row.hash !== recomputed) {
      return {
        ok: false,
        totalChecked: i + 1,
        headHash: head?.lastHash ?? expectedPrev,
        lastId: head?.lastId ?? row.id,
        verifiedAt: new Date().toISOString(),
        brokenRow: {
          id: row.id,
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          reason: `Hash digest mismatch at row #${row.id} (tampered row)`,
        },
      };
    }

    expectedPrev = row.hash;
  }

  if (rows.length > 0 && head && (head.lastHash !== expectedPrev || head.lastId !== lastId)) {
    const tail = rows[rows.length - 1];
    return {
      ok: false,
      totalChecked: rows.length,
      headHash: head.lastHash,
      lastId: head.lastId,
      verifiedAt: new Date().toISOString(),
      brokenRow: {
        id: tail.id,
        action: tail.action,
        entity: tail.entity,
        entityId: tail.entityId,
        reason: `AuditHead pointer mismatch against latest row #${tail.id}`,
      },
    };
  }

  return {
    ok: true,
    totalChecked: rows.length,
    headHash: expectedPrev,
    lastId,
    verifiedAt: new Date().toISOString(),
  };
}

export interface AuditLogEntryView {
  id: number;
  action: string;
  entity: string;
  entityId: string;
  payload: unknown;
  prevHash: string;
  hash: string;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export async function listAuditLogs(limit = 50): Promise<{
  entries: AuditLogEntryView[];
  headHash: string;
  lastId: number;
}> {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const [rows, head] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { id: "desc" },
      take: safeLimit,
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
    db.auditHead.findUnique({ where: { id: 1 } }),
  ]);

  return {
    entries: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      payload: row.payload,
      prevHash: row.prevHash,
      hash: row.hash,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor,
    })),
    headHash: head?.lastHash ?? rows[0]?.hash ?? AUDIT_GENESIS_HASH,
    lastId: head?.lastId ?? rows[0]?.id ?? 0,
  };
}
