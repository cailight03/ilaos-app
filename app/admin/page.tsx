import { Suspense } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  ChefHat,
  ClipboardList,
  Package,
  TriangleAlert,
  Users,
} from "lucide-react";
import { canManageUsers } from "@/src/lib/authorization";
import { USER_MANAGEMENT_HREF } from "@/src/lib/modules";
import { computeDashboardStats } from "@/src/lib/dashboard";
import { getSheetRows, SheetsError } from "@/src/lib/google-sheets";
import { parseOrders } from "@/src/lib/orders";
import { requireModule } from "@/src/lib/session";
import { ProfileCard } from "./_components/profile-card";
import { BakeDateFilter, RefreshButton } from "./_components/controls";
import { ThemeToggle } from "./_components/theme-toggle";
import { PageMain } from "./_components/page-main";
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

export default function Home({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <PageMain>
        <div className="lg:hidden">
          <PageHeader title="Dashboard" subtitle="Ilao&apos;s Microbakery">
            <ThemeToggle />
          </PageHeader>
        </div>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard searchParams={searchParams} />
        </Suspense>
      </PageMain>
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const user = await requireModule("dashboard");

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
    <div className="flex animate-ios-in flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
      <div className="flex items-center gap-3 lg:col-span-3 lg:max-w-xl">
        <div className="min-w-0 flex-1">
          <BakeDateFilter dates={stats.availableBakeDates} value={stats.bakeDate} />
        </div>
        <RefreshButton />
      </div>

      <div className="flex flex-col gap-5 lg:col-span-2">
        <section className="grid grid-cols-2 gap-3 lg:gap-5" aria-label="Summary">
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
      </div>

      <div className="flex flex-col gap-5">
      <ShortcutList
        items={[
          { key: "orders", label: "View orders", Icon: ClipboardList, href: `/admin/orders${query}` },
          {
            key: "recipe_calculator",
            label: "Recipe calculator",
            Icon: ChefHat,
            href: `/admin/recipe-calculator${query}`,
          },
          { key: "sales_reports", label: "Sales reports", Icon: BarChart3, href: "/admin/reports" },
        ]
          .filter((item) => user.modules.includes(item.key))
          .concat(
            canManageUsers(user)
              ? [{ key: "users", label: "User management", Icon: Users, href: USER_MANAGEMENT_HREF }]
              : [],
          )}
      />

      <div className="lg:hidden">
        <ProfileCard user={user} />
      </div>
      </div>
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
