import { Suspense } from "react";
import { BottomNav, getNavContext } from "./_components/bottom-nav";
import { DesktopChrome } from "./_components/desktop-chrome";
import { ProductRegistry } from "./_components/product-registry";
import { loadProductRefs } from "@/src/lib/recipes-db";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense fallback={null}>
        <Registry>
          <div className="transition-[padding] duration-200 lg:pl-[var(--sidebar-w,0px)]">
            <Suspense fallback={null}>
              <Chrome />
            </Suspense>
            {children}
          </div>
        </Registry>
      </Suspense>
      <BottomNav />
    </>
  );
}

async function Registry({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProductRegistry products={await loadProductRefs()} />
      {children}
    </>
  );
}

async function Chrome() {
  const ctx = await getNavContext();
  if (!ctx || ctx.tabs.length === 0) return null;
  const { name, email, image } = ctx.user;
  return <DesktopChrome tabs={ctx.tabs} user={{ name, email, image }} />;
}
