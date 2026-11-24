import { Suspense } from "react";
import { canManageUsers } from "@/src/lib/authorization";
import { MODULES, USER_MANAGEMENT_HREF } from "@/src/lib/modules";
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

async function Tabs() {
  const user = await getAuthorizedUser();
  if (!user) return null;

  const tabs: NavTab[] = MODULES.filter((m) => user.modules.includes(m.key)).map((m) => ({
    key: m.key,
    href: m.href,
    label: m.name,
  }));
  if (canManageUsers(user)) {
    tabs.push({ key: "users", href: USER_MANAGEMENT_HREF, label: "Users" });
  }
  if (tabs.length === 0) return null;
  return <NavTabs tabs={tabs} />;
}
