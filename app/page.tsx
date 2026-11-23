import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  BadgeDollarSign,
  BarChart3,
  ChefHat,
  ClipboardList,
  Lock,
  Package,
  TriangleAlert,
} from "lucide-react";
import { computeDashboardStats } from "@/src/lib/dashboard";
import { getSheetRows, SheetsError } from "@/src/lib/google-sheets";
import { parseOrders } from "@/src/lib/orders";
import { hasSession } from "@/src/lib/session";
import { logout } from "./login/actions";
import { BakeDateFilter, RefreshButton } from "./_components/controls";
import { BottomNav } from "./_components/bottom-nav";
import { PageHeader } from "./_components/page-header";
import { StatCard } from "./_components/stat-card";
import { ProductBreakdown } from "./_components/product-breakdown";
import { ShortcutList } from "./_components/shortcut-list";
import { DismissibleWarning } from "./_components/dismissible-warning";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <PageHeader title="Dashboard" subtitle="Ilao&apos;s Microbakery">
          <form action={logout}>
            <button
              aria-label="Lock"
              className="flex size-11 items-center justify-center rounded-full bg-card text-brand shadow-sm ring-1 ring-separator transition active:scale-90 active:opacity-70"
            >
              <Lock className="size-5" aria-hidden />
            </button>
          </form>
        </PageHeader>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  if (!(await hasSession())) redirect("/login");

  const { bakeDate: raw } = await searchParams;
  // ?bakeDate=all is "All dates"; no param at all defaults to the most recent bake date.
  const isAll = raw === "all";
  const requested = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;

  let stats;
  try {
    const { rows } = await getSheetRows();
    const orders = parseOrders(rows);
    stats = computeDashboardStats(orders, requested);
    if (!requested && !isAll) {
      const latest = stats.availableBakeDates.at(-1) ?? null;
      if (latest) stats = computeDashboardStats(orders, latest);
    }
  } catch (err) {
    const message =
      err instanceof SheetsError ? err.message : "Something went wrong loading orders.";
    return (
      <div role="alert" className="rounded-xl border border-separator bg-card p-4 shadow-sm">
        <div className="flex items-start gap-2 text-[15px] text-red-600">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {message}
        </div>
        <div className="mt-4">
          <RefreshButton variant="solid" />
        </div>
      </div>
    );
  }

  const query = `?bakeDate=${stats.bakeDate ?? "all"}`;

  return (
    <div className="flex animate-ios-in flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <BakeDateFilter dates={stats.availableBakeDates} value={stats.bakeDate} />
        </div>
        <RefreshButton />
      </div>

      <section className="grid grid-cols-2 gap-3" aria-label="Summary">
        <StatCard label="Total orders" value={String(stats.totalOrders)} Icon={Package} />
        <StatCard label="Total sales" value={peso.format(stats.totalSales)} Icon={BadgeDollarSign} />
      </section>

      <ProductBreakdown items={stats.productBreakdown} />

      {stats.warnings.duplicateInvoiceIds.length > 0 && (
        <DismissibleWarning>
          {stats.warnings.duplicateInvoiceIds.length} duplicate Invoice ID(s) found and counted as
          separate orders: {stats.warnings.duplicateInvoiceIds.join(", ")}
        </DismissibleWarning>
      )}

      <ShortcutList
        items={[
          { label: "View orders", Icon: ClipboardList, href: `/orders${query}` },
          { label: "Recipe calculator", Icon: ChefHat, href: `/recipe-calculator${query}` },
          { label: "Sales reports", Icon: BarChart3 },
        ]}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy aria-label="Loading">
      <div className="h-11 rounded-xl bg-fill" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[116px] rounded-xl bg-fill" />
        <div className="h-[116px] rounded-xl bg-fill" />
      </div>
      <div className="h-64 rounded-xl bg-fill" />
    </div>
  );
}
