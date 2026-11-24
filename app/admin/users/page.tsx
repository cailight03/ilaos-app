import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { MODULES } from "@/src/lib/modules";
import { requireOwner } from "@/src/lib/session";
import { listUsers } from "@/src/lib/users";
import { BottomNav } from "../_components/bottom-nav";
import { PageHeader } from "../_components/page-header";
import { UsersManager, type UserRow } from "./users-manager";

export default function UsersPage() {
  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] md:max-w-3xl">
        <Suspense fallback={<UsersSkeleton />}>
          <Content />
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}

const dateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});
const dateOnly = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

async function Content() {
  const me = await requireOwner();

  let users: UserRow[];
  try {
    users = (await listUsers()).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatar_url,
      role: u.role,
      isActive: u.is_active,
      modules: u.modules,
      addedAt: dateOnly.format(new Date(u.created_at)),
      lastLogin: u.last_login ? dateTime.format(new Date(u.last_login)) : null,
    }));
  } catch (err) {
    console.error("[users]", err);
    return (
      <>
        <PageHeader title="Users" subtitle="Ilao's Microbakery" />
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-separator bg-card p-4 text-[15px] text-red-600 shadow-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          Couldn&apos;t load users. Check that the latest database migration has been run.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Ilao's Microbakery" />
      <UsersManager
        users={users}
        currentUserId={me.id}
        modules={MODULES.map((m) => ({ key: m.key, name: m.name }))}
      />
    </>
  );
}

function UsersSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading users">
      <div className="h-14 w-40 rounded-xl bg-fill" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-20 rounded-xl bg-fill" />
        <div className="h-20 rounded-xl bg-fill" />
        <div className="h-20 rounded-xl bg-fill" />
      </div>
      <div className="h-11 rounded-xl bg-fill" />
      <div className="h-40 rounded-xl bg-fill" />
    </div>
  );
}
