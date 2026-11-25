import { Suspense } from "react";
import { canManageUsers, canViewAuditLog } from "@/src/lib/authorization";
import { AUDIT_LOG_HREF, MODULES, USER_MANAGEMENT_HREF } from "@/src/lib/modules";
import { getAuthorizedUser } from "@/src/lib/session";
import { NavTabs, type NavTab } from "./nav-tabs";

/** Bottom navigation showing only what the signed-in user may access. */
export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <Tabs />
    </Suspense>
  );
}

/** Nav entries the signed-in user may see, plus the user, or null when signed out. */
export async function getNavContext() {
  const user = await getAuthorizedUser();
  if (!user) return null;

  const tabs: NavTab[] = MODULES.filter((m) => user.modules.includes(m.key)).map((m) => ({
    key: m.key,
    href: m.href,
    label: m.name,
  }));
  if (canViewAuditLog(user)) {
    tabs.push({ key: "audit-log", href: AUDIT_LOG_HREF, label: "Audit Log" });
  }
  if (canManageUsers(user)) {
    tabs.push({ key: "users", href: USER_MANAGEMENT_HREF, label: "Users" });
  }
  return { user, tabs };
}

async function Tabs() {
  const ctx = await getNavContext();
  if (!ctx || ctx.tabs.length === 0) return null;
  const { name, email, image, role } = ctx.user;
  return <NavTabs tabs={ctx.tabs} user={{ name, email, image, role }} />;
}
