import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { canManageUsers } from "@/src/lib/authorization";
import { MODULES, USER_MANAGEMENT_HREF } from "@/src/lib/modules";
import { getAuthorizedUser } from "@/src/lib/session";
import { logout } from "../login/actions";
import { BottomNav } from "../_components/bottom-nav";

export default function AccessDeniedPage() {
  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-sm animate-ios-in flex-col justify-center gap-6 px-4 pt-[env(safe-area-inset-top)] pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Suspense>
          <Content />
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}

async function Content() {
  const user = await getAuthorizedUser();
  if (!user) redirect("/admin/login");

  const links: { href: string; label: string }[] = MODULES.filter((m) =>
    user.modules.includes(m.key),
  ).map((m) => ({ href: m.href, label: m.name }));
  if (canManageUsers(user)) links.push({ href: USER_MANAGEMENT_HREF, label: "User Management" });

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-tint text-brand">
          <ShieldAlert className="size-8" aria-hidden />
        </span>
        <h1 className="text-[28px] leading-8 font-bold tracking-tight">Access denied</h1>
        <p className="text-[15px] text-label2">
          {links.length > 0
            ? "You don't have access to that page. Ask an owner if you need it."
            : "Your account doesn't have access to any modules yet. Ask an owner to grant access."}
        </p>
      </div>
      {links.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm">
          {links.map((l) => (
            <li key={l.href} className="border-b border-separator last:border-b-0">
              <Link href={l.href} className="flex min-h-12 items-center px-4 text-[17px] text-brand active:bg-fill">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form action={logout}>
        <button className="h-12 w-full rounded-xl bg-fill text-[17px] font-medium transition active:scale-[0.98] active:opacity-80">
          Sign out
        </button>
      </form>
    </>
  );
}
