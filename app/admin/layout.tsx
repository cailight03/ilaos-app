import { Suspense } from "react";
import { BottomNav, getNavContext } from "./_components/bottom-nav";
import { DesktopChrome } from "./_components/desktop-chrome";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <div className="transition-[padding] duration-200 lg:pl-[var(--sidebar-w,0px)]">
        <Suspense fallback={null}>
          <Chrome />
        </Suspense>
        {children}
      </div>
      <BottomNav />
    </>
  );
}

async function Chrome() {
  const ctx = await getNavContext();
  if (!ctx || ctx.tabs.length === 0) return null;
  const { name, email, image } = ctx.user;
  return <DesktopChrome tabs={ctx.tabs} user={{ name, email, image }} />;
}
