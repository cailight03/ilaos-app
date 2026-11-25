import { Suspense } from "react";
import { PageMain } from "../_components/page-main";
import { TriangleAlert } from "lucide-react";
import { SheetsError } from "@/src/lib/google-sheets";
import { fetchReportOrders, type ReportScope } from "@/src/lib/reports-service";
import { loadProfitInputs, type ProfitInputs } from "@/src/lib/profitability-service";
import { todayInManila, type ReportOrder } from "@/src/lib/sales-report";
import { getUserForModule, requireModule } from "@/src/lib/session";
import { RefreshButton } from "../_components/controls";
import { PageHeader } from "../_components/page-header";
import { ReportsView } from "./reports-view";

export default function ReportsPage() {
  return (
    <>
      <PageMain>
        <Suspense fallback={<ReportsSkeleton />}>
          <Content />
        </Suspense>
      </PageMain>
    </>
  );
}

async function Content() {
  await requireModule("sales_reports");
  // Profit needs cost and expense data, so it also requires the Costing & Expenses module.
  const costingUser = await getUserForModule("costing_expenses");
  let orders: ReportOrder[];
  let scope: ReportScope;
  try {
    ({ orders, scope } = await fetchReportOrders());
  } catch (err) {
    const message =
      err instanceof SheetsError ? err.message : "Something went wrong loading sales data.";
    return (
      <>
        <PageHeader title="Sales Report" subtitle="Ilao's Microbakery" />
        <div role="alert" className="rounded-xl border border-separator bg-card p-4 shadow-sm">
          <div className="flex items-start gap-2 text-[15px] text-red-600">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            {message}
          </div>
          <div className="mt-4">
            <RefreshButton variant="solid" />
          </div>
        </div>
      </>
    );
  }

  let profit: ProfitInputs | null = null;
  let profitError = false;
  if (costingUser) {
    try {
      profit = await loadProfitInputs(orders, costingUser.email);
    } catch (err) {
      console.error("[reports] profitability data failed", err);
      profitError = true;
    }
  }

  return (
    <ReportsView
      orders={orders}
      scope={scope}
      profit={profit}
      profitError={profitError}
      today={todayInManila()}
    />
  );
}

function ReportsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading sales report">
      <div className="h-14 w-48 rounded-xl bg-fill" />
      <div className="h-9 rounded-full bg-fill" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[116px] rounded-xl bg-fill" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-fill" />
      <div className="h-64 rounded-xl bg-fill" />
    </div>
  );
}
