import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SAFE_USER_SELECT } from "@/lib/auth";
import { getActiveSessionUser } from "@/lib/permissions";
import { getRoleHome } from "@/lib/session";
import { PageShell } from "@/components/ui";
import { RoleHeaderActions } from "@/components/auth/role-header-actions";
import { UserManagement } from "@/components/admin/user-management";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect(getRoleHome(user.role));

  const users = await db.user.findMany({
    select: SAFE_USER_SELECT,
    orderBy: [{ createdAt: "desc" }],
  });

  const serialized = users.map((item) => ({
    id: item.id,
    name: item.name,
    email: item.email,
    role: item.role,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <PageShell
      headerRight={<RoleHeaderActions name={user.name} role={user.role} />}
    >
      <UserManagement initialUsers={serialized} currentUserId={user.id} />
    </PageShell>
  );
}
