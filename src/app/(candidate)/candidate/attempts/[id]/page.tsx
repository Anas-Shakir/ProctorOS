import { notFound, redirect } from "next/navigation";
import { getAttemptPaper } from "@/lib/attempts";
import {
  getActiveSessionUser,
  HttpError,
  requireAttemptOwner,
} from "@/lib/permissions";
import { getRoleHome } from "@/lib/session";
import { AttemptWorkspace } from "@/components/candidate/attempt-workspace";

export const dynamic = "force-dynamic";

export default async function CandidateAttemptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" && user.role !== "EXAMINER" && user.role !== "ADMIN") {
    redirect(getRoleHome(user.role));
  }

  const { id } = await params;

  try {
    await requireAttemptOwner(id);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      notFound();
    }
    redirect(getRoleHome(user.role));
  }

  const paper = await getAttemptPaper(id);

  return <AttemptWorkspace initialPaper={paper} />;
}
