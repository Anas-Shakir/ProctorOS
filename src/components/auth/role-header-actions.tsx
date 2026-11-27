"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Badge, Button, useToast } from "@/components/ui";
import type { AppRole } from "@/lib/validators/auth";

export function RoleHeaderActions({
  name,
  role,
}: {
  name: string;
  role: AppRole;
}) {
  const router = useRouter();
  const toast = useToast();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.warning("Sign out failed", "Please try again.");
      setSigningOut(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex items-center gap-2.5">
        <span className="text-sm text-ink-muted">{name}</span>
        <Badge variant={role === "ADMIN" ? "terracotta" : "pine"}>
          {role}
        </Badge>
      </div>
      <Button
        variant="secondary"
        size="sm"
        loading={signingOut}
        loadingLabel="Signing out..."
        onClick={handleSignOut}
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Sign Out</span>
      </Button>
    </div>
  );
}
