import { db } from "@/lib/db";
import {
  DEFAULT_WORKSPACE_PREFS,
  workspacePrefsSchema,
  type WorkspacePrefs,
} from "@/lib/validators/prefs";

export async function getUserWorkspacePrefs(
  userId: string,
): Promise<WorkspacePrefs> {
  const row = await db.userPref.findUnique({
    where: { userId },
    select: { prefs: true },
  });

  if (!row) return DEFAULT_WORKSPACE_PREFS;
  const parsed = workspacePrefsSchema.safeParse(row.prefs);
  return parsed.success ? parsed.data : DEFAULT_WORKSPACE_PREFS;
}

export async function saveUserWorkspacePrefs(
  userId: string,
  prefs: WorkspacePrefs,
): Promise<WorkspacePrefs> {
  const saved = await db.userPref.upsert({
    where: { userId },
    update: { prefs },
    create: { userId, prefs },
    select: { prefs: true },
  });

  const parsed = workspacePrefsSchema.safeParse(saved.prefs);
  return parsed.success ? parsed.data : prefs;
}
