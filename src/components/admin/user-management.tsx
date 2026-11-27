"use client";

import * as React from "react";
import { Plus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Modal,
  SegmentedTabs,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from "@/components/ui";
import {
  createUserSchema,
  RoleValues,
  type AppRole,
} from "@/lib/validators/auth";

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  createdAt: string;
}

export function UserManagement({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserItem[];
  currentUserId: string;
}) {
  const toast = useToast();
  const [users, setUsers] = React.useState<AdminUserItem[]>(initialUsers);
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

  // Create user modal state
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<AppRole>("CANDIDATE");
  const [creating, setCreating] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const filteredUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "ALL" && user.role !== roleFilter) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, search]);

  const counts = React.useMemo(
    () => ({
      ALL: users.length,
      ADMIN: users.filter((u) => u.role === "ADMIN").length,
      EXAMINER: users.filter((u) => u.role === "EXAMINER").length,
      CANDIDATE: users.filter((u) => u.role === "CANDIDATE").length,
    }),
    [users],
  );

  const tabs = [
    { id: "ALL", label: "All", count: counts.ALL },
    { id: "ADMIN", label: "Admins", count: counts.ADMIN },
    { id: "EXAMINER", label: "Examiners", count: counts.EXAMINER },
    { id: "CANDIDATE", label: "Candidates", count: counts.CANDIDATE },
  ];

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = createUserSchema.safeParse({ name, email, password, role });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check form fields");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create user");
        setCreating(false);
        return;
      }

      setUsers((prev) => [
        { ...data.user, createdAt: data.user.createdAt },
        ...prev,
      ]);
      toast.success(
        "User created",
        `${data.user.name} (${data.user.role}) can now sign in.`,
      );
      setName("");
      setEmail("");
      setPassword("");
      setRole("CANDIDATE");
      setModalOpen(false);
    } catch {
      setFormError("Network error while creating user");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (
    userId: string,
    patch: { role?: AppRole; isActive?: boolean },
  ) => {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning("Update refused", data.error ?? "Could not update user");
        return;
      }
      setUsers((prev) =>
        prev.map((item) =>
          item.id === userId ? { ...item, ...data.user } : item,
        ),
      );
      toast.success("Account updated", `${data.user.name} saved.`);
    } catch {
      toast.warning("Network error", "Could not update account.");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
            Administration
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-ink tracking-[-0.02em]">
            User Accounts &amp; Roles
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Create accounts, assign roles, or deactivate access immediately.
          </p>
        </div>

        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New User</span>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <SegmentedTabs
          tabs={tabs}
          value={roleFilter}
          onChange={setRoleFilter}
          ariaLabel="Filter users by role"
        />
        <div className="w-full md:w-72">
          <Input
            aria-label="Search users"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Access</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.length === 0 ? (
            <TableEmpty
              colSpan={5}
              title="No matching users"
              description="Adjust your filter or create a new user account."
            />
          ) : (
            filteredUsers.map((user) => {
              const isSelf = user.id === currentUserId;
              const isBusy = busyUserId === user.id;

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <span>{user.name}</span>
                    {isSelf && (
                      <span className="ml-2 font-mono text-[11px] text-ink-muted">
                        (you)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink-muted">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <select
                      aria-label={`Role for ${user.name}`}
                      value={user.role}
                      disabled={isSelf || isBusy}
                      onChange={(e) =>
                        handleUpdateUser(user.id, {
                          role: e.target.value as AppRole,
                        })
                      }
                      className="focus-ring h-8 px-2.5 rounded-md border border-border-default bg-surface text-xs font-medium text-ink disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {RoleValues.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge
                        variant="pine"
                        icon={
                          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        }
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="terracotta"
                        icon={<UserX className="h-3.5 w-3.5" aria-hidden="true" />}
                      >
                        Deactivated
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={user.isActive ? "secondary" : "primary"}
                      size="sm"
                      disabled={isSelf || isBusy}
                      onClick={() =>
                        handleUpdateUser(user.id, { isActive: !user.isActive })
                      }
                    >
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create User Account"
        description="Assign an institutional role and initial password."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-user-form"
              variant="primary"
              loading={creating}
              loadingLabel="Creating..."
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Create Account</span>
            </Button>
          </>
        }
      >
        <form
          id="create-user-form"
          onSubmit={handleCreateUser}
          className="space-y-4"
          noValidate
        >
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-terracotta/30 bg-terracotta-tint px-3.5 py-2.5 text-sm text-terracotta"
            >
              {formError}
            </div>
          )}

          <Input
            label="Full Name"
            placeholder="Dr. Nadia Hassan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={creating}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="nadia@proctoros.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={creating}
          />

          <Input
            label="Initial Password"
            type="password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={creating}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-user-role"
              className="text-sm font-medium text-ink tracking-[-0.01em]"
            >
              Role
            </label>
            <select
              id="new-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              disabled={creating}
              className="focus-ring h-10 px-3 rounded-lg border border-border-default bg-surface text-sm text-ink"
            >
              {RoleValues.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
